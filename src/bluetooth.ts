
import { replHandleResponse,onDisconnect,colorText } from "./repl";
import { nordicDfuHandleControlResponse } from './nordicdfu';
import {writeEmitterRaw} from './extension';
import * as vscode from 'vscode';

var util = require('util');
let device:any = null;
var bluetooth = require('./ble/index').webbluetooth;
let nordicDfuControlCharacteristic:any = null;
let nordicDfuPacketCharacteristic:any = null;
const nordicDfuServiceUuid = 0xfe59;
const nordicDfuControlCharacteristicUUID = '8ec90001-f315-4f60-9fb8-838830daea50';
const nordicDfuPacketCharacteristicUUID = '8ec90002-f315-4f60-9fb8-838830daea50';

let replRxCharacteristic:any = null;
let replTxCharacteristic:any = null;
const replDataServiceUuid = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const replRxCharacteristicUuid = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const replTxCharacteristicUuid = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

let rawDataRxCharacteristic:any = null;
let rawDataTxCharacteristic = null;
const rawDataServiceUuid = "e5700001-7bac-429a-b4ce-57ff900f479d";
const rawDataRxCharacteristicUuid = "e5700002-7bac-429a-b4ce-57ff900f479d";
const rawDataTxCharacteristicUuid = "e5700003-7bac-429a-b4ce-57ff900f479d";

export const replDataTxQueue = [];
export const rawDataTxQueue = [];

let replTxTaskIntervalId:any = null;
let replDataTxInProgress = false;
let rawDataTxInProgress = false;

// Web-Bluetooth doesn't have any MTU API, so we just set it to something reasonable
const maxmtu:any = 100;

export function isConnected() {

    if (device && device.gatt.connected) {
        return true;
    }

    return false;
}
let connectionInProgress = false;
let currentSelectionTimeout:any;
export async function connect() {
    try {
        if(connectionInProgress){
            return Promise.resolve("inprogress");
        }
        connectionInProgress= true;
        setTimeout(()=>{
            bluetooth.cancelRequest();
            if(!isConnected() && !currentSelectionTimeout){
                onDisconnect();
                console.log("couldn't find device");
            }

        },10000);
        const quickPick = vscode.window.createQuickPick();
        quickPick.items = [];
        let allDevices:any = {};
        device = await bluetooth.requestDevice({
            filters: [
                { services: [replDataServiceUuid] },
                { services: [nordicDfuServiceUuid] },
            ],
            optionalServices: [rawDataServiceUuid],
            deviceFound:  function(bleDevice:any,selectFn:any){
                allDevices[bleDevice.id.toUpperCase()] = bleDevice;
                quickPick.items = [...quickPick.items, {label:bleDevice.name +' RSSI: '+bleDevice.adData.rssi||"can't detect",description:bleDevice.id.toUpperCase()}];
                quickPick.onDidChangeSelection(selection => {
                    if(selection[0] && selection[0].description){
                        selectFn(allDevices[selection[0]?.description]);
                        quickPick.dispose();
                    }
                });
                quickPick.onDidHide(() =>{
                    quickPick.dispose();
                });
                if(currentSelectionTimeout){
                    clearTimeout(currentSelectionTimeout);
                }
                currentSelectionTimeout = setTimeout(()=>{
                    if(Object.keys(allDevices).length>1){
                        quickPick.show();
                        
                    }else if(Object.keys(allDevices).length===1){
                        selectFn(allDevices[Object.keys(allDevices)[0]]);
                        allDevices = {};
                    }
                    clearTimeout(currentSelectionTimeout);
                },3000);
                
            }
        }).catch(console.log);
    // }

    const server = await device.gatt.connect();
    device.addEventListener('gattserverdisconnected', disconnect);
    const nordicDfuService = await server.getPrimaryService(nordicDfuServiceUuid)
        .catch(() => { });
    const replService = await server.getPrimaryService(replDataServiceUuid)
        .catch((err:any) => { console.log(err); });
    const rawDataService = await server.getPrimaryService(rawDataServiceUuid)
        .catch(() => { });

    if (nordicDfuService) {
        nordicDfuControlCharacteristic = await nordicDfuService.getCharacteristic(nordicDfuControlCharacteristicUUID);
        nordicDfuPacketCharacteristic = await nordicDfuService.getCharacteristic(nordicDfuPacketCharacteristicUUID);
        await nordicDfuControlCharacteristic.startNotifications();
        nordicDfuControlCharacteristic.addEventListener('characteristicvaluechanged', receiveNordicDfuControlData);
        connectionInProgress = false;
        return Promise.resolve("dfu connected");
    }

    if (replService) {
        replRxCharacteristic = await replService.getCharacteristic(replRxCharacteristicUuid);
        replTxCharacteristic = await replService.getCharacteristic(replTxCharacteristicUuid);
        await replTxCharacteristic.startNotifications();
        replTxCharacteristic.addEventListener('characteristicvaluechanged', receiveReplData);
        replTxTaskIntervalId = setInterval(transmitReplData);
    }

    
    if (rawDataService) {
        rawDataRxCharacteristic = await rawDataService.getCharacteristic(rawDataRxCharacteristicUuid);
        rawDataTxCharacteristic = await rawDataService.getCharacteristic(rawDataTxCharacteristicUuid);
        await rawDataTxCharacteristic.startNotifications();
        rawDataTxCharacteristic.addEventListener('characteristicvaluechanged', receiveRawData);
    }
    connectionInProgress = false;
    return Promise.resolve("repl connected");
    } catch (error) {
        connectionInProgress = false;
        console.log(error)
    }
    
        
}

export async function disconnect() {

    if (device && device.gatt.connected) {
        await device.gatt.disconnect();
    }

    // Stop transmitting data
    clearInterval(replTxTaskIntervalId);

    // Callback to main.js
    onDisconnect();
}

function receiveNordicDfuControlData(event:any) {
    nordicDfuHandleControlResponse(event.target.value);
}

export async function transmitNordicDfuControlData(bytes:any) {
    await nordicDfuControlCharacteristic.writeValue(new Uint8Array(bytes));
}

export async function transmitNordicDfuPacketData(bytes:any) {
    await nordicDfuPacketCharacteristic.writeValueWithoutResponse(new Uint8Array(bytes));
}

function receiveReplData(event:any) {
    // console.log(event);
    // Decode the byte array into a UTF-8 string
    const decoder = new util.TextDecoder('utf-8');

    replHandleResponse(decoder.decode(event.target.value));
}

async function transmitReplData() {

    if (replDataTxInProgress === true) {
        return;
    }

    if (replDataTxQueue.length === 0) {
        return;
    }

    replDataTxInProgress = true;

    const payload = replDataTxQueue.slice(0, maxmtu);

    await replRxCharacteristic.writeValueWithoutResponse(new Uint8Array(payload))
        .then(() => {
            replDataTxQueue.splice(0, payload.length);
            replDataTxInProgress = false;
            return;
        })
        .catch((error:any) => {
            if (error === "NetworkError: GATT operation already in progress.") {
                // Ignore busy errors. Just wait and try again later
            }
            else {
                // Discard data on other types of error
                replDataTxQueue.splice(0, payload.length);
                replDataTxInProgress = false;
                // return Promise.reject(error);
            }
        });

}

function bufferToHex (buffer:ArrayBuffer) {
    return [...new Uint8Array (buffer)]
        .map (b => b.toString (16).padStart (2, "0"));
}
function hexArrayToAscii(hexArray:string[],colorIndex:number) {
    let result = "";
    for (let i = 0; i < hexArray.length; i++) {
        let code = parseInt(hexArray[i], 16);
        if (code >= 32 && code <= 126) {
            result += colorText(String.fromCharCode(code),colorIndex);
            
        } else {
            result += colorText(".",1);
        }
    }
    return result;
}

export function receiveRawData(data:any){
    // console.log(data);
    printToRawChannel(data.target.value.buffer);
}


export async function sendRawData(data:string) {
    // let buffer = Buffer.from(data,'utf-8').buffer;
    const encoder = new util.TextEncoder('utf-8');
    let chars:any =[];
    chars.push.apply(chars, encoder.encode(data));
    await rawDataRxCharacteristic.writeValueWithoutResponse(new Uint8Array(chars))
        .then(() => {
            printToRawChannel(chars,false);
        })
        .catch((error:any) => {
            // return Promise.reject(error);
        });
}

const printToRawChannel = function(buff:ArrayBuffer,rx=true){

    let buffArray = bufferToHex(buff);
    let colorIndex = 2;
    let outputmsg = 'RX  ';
    if(!rx){
        colorIndex = 3;
        outputmsg='TX  ';
    }
    outputmsg  = colorText(outputmsg,colorIndex);
    for (let row = 0; row < buffArray.length; row +=8) {
        const thisRow = buffArray.slice(row,row+8);
        if(row!==0){
            outputmsg +='    ';
        }
        outputmsg += colorText(thisRow.join(' '),colorIndex);
        outputmsg += '  '+' '.repeat((8-thisRow.length)*3)+hexArrayToAscii(thisRow,colorIndex)+'\r\n';
        
    }
    // outputChannelData.appendLine(outputmsg);
    writeEmitterRaw.fire(outputmsg+'\r\n');
};