
import { replHandleResponse,onDisconnect,colorText, frameHandleResponse,setDeviceConnected } from "./repl";
import { nordicDfuHandleControlResponse } from './nordicdfu';
import {writeEmitter, writeEmitterRaw} from './extension';
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

let frameRxCharacteristic:any = null;
let frameTxCharacteristic:any = null;
const frameServiceUUID = "7a230001-5475-a6a4-654c-8431f6ad49c4";
const frameRxCharacteristicsUUID = "7a230002-5475-a6a4-654c-8431f6ad49c4";
const frameTxCharacteristicsUUID = "7a230003-5475-a6a4-654c-8431f6ad49c4";

let rawDataRxCharacteristic:any = null;
let rawDataTxCharacteristic = null;
const rawDataServiceUuid = "e5700001-7bac-429a-b4ce-57ff900f479d";
const rawDataRxCharacteristicUuid = "e5700002-7bac-429a-b4ce-57ff900f479d";
const rawDataTxCharacteristicUuid = "e5700003-7bac-429a-b4ce-57ff900f479d";

export const replDataTxQueue = [];
export const frameDataTxQueue = [];
export const rawDataTxQueue = [];
type DeviceInfo = {
    macAddress?:string,
    name?:string,
    fpgaStatu?:boolean,
    fpgaMessage?:string
};
export var deviceInfo:DeviceInfo = {};
let replTxTaskIntervalId:any = null;
let frameTxTaskIntervalId:any = null;
let replDataTxInProgress = false;
let frameDataTxInProgress = false;

// Web-Bluetooth doesn't have any MTU API, so we just set it to something reasonable
export const maxmtu:any = 100;
export function convertToLittleEndian(macAddress:string):string {
    // Split the MAC address into an array of hexadecimal values
    var macAddressBytes = macAddress.split(":").map((hex:any) => parseInt(hex, 16));
  
    // Check if the current endianness is big-endian
    var isBigEndian = (macAddressBytes[0] & 1) === 0;
  
    if (isBigEndian) {
      // Reverse the array to convert to little-endian
      macAddressBytes.reverse();
      
      // Join the array back into a string with colons
      var littleEndianMAC = macAddressBytes.map((byt:any) => {
        var hex = byt.toString(16).toUpperCase();
        return hex.length === 1 ? "0" + hex : hex;
      }).join(":");
  
      return littleEndianMAC;
    } else {
      // If it's already little-endian, no need to change anything
      return macAddress;
    }
  }

  
export function isConnected() {

    if (device && device.gatt.connected) {
        return true;
    }

    return false;
}
let connectionInProgress = 0;
let currentSelectionTimeout:any;
export async function connect() {
    try {
        // connection timeout = 10s
        if(connectionInProgress && (Date.now()-connectionInProgress)>10200){
            connectionInProgress = 0;
        }
        if(connectionInProgress){
            return Promise.resolve("inprogress");
        }
        connectionInProgress= Date.now();
        setTimeout(()=>{
            bluetooth.cancelRequest();
            if(!isConnected() && !currentSelectionTimeout){
                onDisconnect();
                vscode.window.showWarningMessage("No device found");
            }

        },10000);
        const quickPick = vscode.window.createQuickPick();
        quickPick.items = [];
        let allDevices:any = {};
        device = await bluetooth.requestDevice({
            filters: [
                { services: [replDataServiceUuid] },
                { services: [nordicDfuServiceUuid] },
                { services : [frameServiceUUID]}
            ],
            optionalServices: [rawDataServiceUuid],
            deviceFound:  function(bleDevice:any,selectFn:any){
                let mac = bleDevice.id.toUpperCase();
               
                if(bleDevice.id.length<20){
                    mac  = convertToLittleEndian(bleDevice.id).toUpperCase();
                }
                allDevices[mac] = bleDevice;
                quickPick.items = [...quickPick.items, {label:bleDevice.name +' RSSI: '+bleDevice.adData.rssi||"can't detect",description:mac}];
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
    deviceInfo.macAddress = device.id;
    if(String(device.id).length>20){
        deviceInfo.macAddress = "Uknown";
    }else{
        deviceInfo.macAddress = convertToLittleEndian(device.id).toUpperCase();
    }
    
    deviceInfo.name = device.name;
    const nordicDfuService = await server.getPrimaryService(nordicDfuServiceUuid)
        .catch(() => { });
    const replService = await server.getPrimaryService(replDataServiceUuid)
        .catch((err:any) => { console.log(err); });
    const frameService = await server.getPrimaryService(frameServiceUUID)
        .catch((err:any) => { console.log(err); });
    const rawDataService = await server.getPrimaryService(rawDataServiceUuid)
        .catch(() => { });

    if (nordicDfuService) {
        nordicDfuControlCharacteristic = await nordicDfuService.getCharacteristic(nordicDfuControlCharacteristicUUID);
        nordicDfuPacketCharacteristic = await nordicDfuService.getCharacteristic(nordicDfuPacketCharacteristicUUID);
        await nordicDfuControlCharacteristic.startNotifications();
        nordicDfuControlCharacteristic.addEventListener('characteristicvaluechanged', receiveNordicDfuControlData);
        connectionInProgress = 0;
        return Promise.resolve("dfu connected");
    }

    if (frameService) {
        setDeviceConnected("Frame");
        frameRxCharacteristic = await frameService.getCharacteristic(frameRxCharacteristicsUUID);
        frameTxCharacteristic = await frameService.getCharacteristic(frameTxCharacteristicsUUID);
        await frameTxCharacteristic.startNotifications();
        frameTxCharacteristic.addEventListener('characteristicvaluechanged', receiveFrameData);
        frameTxTaskIntervalId = setInterval(transmitFrameData);
        connectionInProgress = 0;
        return Promise.resolve("frame connected");
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
    connectionInProgress = 0;
    return Promise.resolve("repl connected");
    } catch (error) {
        connectionInProgress = 0;
        console.log(error);
    }
    
        
}

export async function disconnect() {

    if (device && device.gatt.connected) {
        await device.gatt.disconnect();
    }

    // Stop transmitting data
    clearInterval(replTxTaskIntervalId);
    clearInterval(frameTxTaskIntervalId);

	writeEmitter.fire("\r\nDisconnected \r\n");
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
function receiveFrameData(event:any){
    const decoder = new util.TextDecoder('utf-8');
   frameHandleResponse(decoder.decode(event.target.value));
}
async function transmitFrameData() {
    if (frameDataTxInProgress === true) {
        return;
    }

    if (frameDataTxQueue.length === 0) {
        return;
    }

    frameDataTxInProgress = true;

    const payload = frameDataTxQueue.slice(0, maxmtu);

    await frameRxCharacteristic.writeValueWithoutResponse(new Uint8Array(payload))
        .then(() => {
            frameDataTxQueue.splice(0, payload.length);
            frameDataTxInProgress = false;
            return;
        })
        .catch((error:any) => {
            console.log(error);
            if (error === "NetworkError: GATT operation already in progress.") {
                // Ignore busy errors. Just wait and try again later
            }
            else {
                // Discard data on other types of error
                frameDataTxQueue.splice(0, payload.length);
                frameDataTxInProgress = false;
                // return Promise.reject(error);
            }
        });
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