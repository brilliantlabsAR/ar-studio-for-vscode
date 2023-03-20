import { isConnected, replDataTxQueue,connect,disconnect } from './bluetooth';
import { checkForUpdates, startFirmwareUpdate, startFpgaUpdate } from "./update";
import { writeEmitter,updateStatusBarItem,outputChannel } from './extension';
import { startNordicDFU } from './nordicdfu'; 
import * as vscode from 'vscode';
let util = require('util');
let cursorPosition = 0;
let replRawModeEnabled = false;
let rawReplResponseString = '';
let rawReplResponseCallback:any;
let fileWriteStart = false;

export async function replRawMode(enable:boolean) {

    if (enable === true) {
        replRawModeEnabled = true;
        outputChannel.appendLine("Entering raw REPL mode");
        await replSend('\x03\x01');
        return;
    }

     outputChannel.appendLine("Leaving raw REPL mode");
    replRawModeEnabled = false;
    await replSend('\x02');

}

export async function replSend(string:string) {

    ensureConnected();

    // Strings will be thrown away if not connected
    if (!isConnected()) {
        return;
    }

    if (replRawModeEnabled) {

        // If string contains printable characters, append Ctrl-D
        if (/[\x20-\x7F]/.test(string)) {
            string += '\x04';
        }
        
        outputChannel.appendLine('Raw REPL ⬆️: ' +
        string
            .replaceAll('\n', '\\n')
            .replaceAll('\x01', '\\x01')
            .replaceAll('\x02', '\\x02')
            .replaceAll('\x03', '\\x03')
            .replaceAll('\x04', '\\x04'));

    }

    // Encode the UTF-8 string into an array and populate the buffer
    const encoder = new util.TextEncoder('utf-8');
    replDataTxQueue.push.apply(replDataTxQueue, encoder.encode(string));

    // Return a promise which calls a function that'll eventually run when the
    // response handler calls the function associated with rawReplResponseCallback
    return new Promise(resolve => {
        rawReplResponseCallback = function (responseString:string) {
            outputChannel.appendLine('Raw REPL ⬇️: ' + responseString.replaceAll('\r\n', '\\r\\n'));
            resolve(responseString);
        };
        setTimeout(() => {
            resolve(null);
        }, 3000);
    });
}

let initializedWorkspace = false;
export async function ensureConnected() {
    
    if (isConnected() === true) {
        return;
    }
    updateStatusBarItem("progress");
    try {
        let connectionResult = await connect();

        if (connectionResult === "dfu connected") {
            // infoText.innerHTML = "Starting firmware update..";
            updateStatusBarItem("connected","$(cloud-download) Updating");
            await startNordicDFU()
                .catch(() => {
                    disconnect();
                    throw Error("Bluetooth error. Reconnect or check console for details");
                });
            await disconnect();
            updateStatusBarItem("progress");
            
            // after 2 sec try to connect;
            setTimeout(ensureConnected,2000);
            
            // return;
        }

        if (connectionResult === "repl connected") {
            // infoText.innerHTML = "Connected";
            // replResetConsole();
            vscode.commands.executeCommand('setContext', 'monocle.deviceConnected', true);
                // writeEmitter.fire("Connected\r\n");
                updateStatusBarItem("connected");
            let allTerminals = vscode.window.terminals.filter(ter=>ter.name==='REPL');
            if(allTerminals.length>0){
                allTerminals[0].show();
                vscode.commands.executeCommand('workbench.action.terminal.clear');
            }
            
            let updateInfo = await checkForUpdates();
            
            if(!initializedWorkspace){
                // setupWorkSpace();
                // initializedWorkspace = true;
            }    
            // console.log(updateInfo);
            if (updateInfo !== "") {
                let items:string[] =["Update Now","Later"] ;
                const updateMsg = new vscode.MarkdownString(updateInfo);
                vscode.window.showInformationMessage(updateMsg.value,...items).then(op=>{
                    if(op==="Update Now"){
                         startFirmwareUpdate();
                    }
                });
                // infoText.innerHTML = updateInfo + " Click <a href='#' " +
                //     "onclick='update();return false;'>" +
                //     "here</a> to update.";
            }
        }
    }

    catch (error:any) {
        // Ignore User cancelled errors
        if (error.message && error.message.includes("cancelled")) {
            return;
        }
        // infoText.innerHTML = error;
        // console.error(error);
        updateStatusBarItem("Disconnected");
    }
}

export function replHandleResponse(string:string) {

    if (replRawModeEnabled === true) {

        // Combine the string until it's ready to handle
        rawReplResponseString += string;

        // Once the end of response '>' is received, run the callbacks
        if (string.endsWith('>') || string.endsWith('>>> ')) {
            rawReplResponseCallback(rawReplResponseString);
            rawReplResponseString = '';
        }

        // Don't show these strings on the console
        return;
    }
    if(fileWriteStart){
    writeEmitter.fire(string.slice(string.indexOf('>>>')));
        return;
    }
    writeEmitter.fire(string);

}

export async function sendFileUpdate(update:any){
    // console.log(JSON.stringify(update));
    fileWriteStart = true;
    const decoder = new util.TextDecoder('utf-8');
    await replRawMode(true);
    let response:any = await replSend(decoder.decode(update));
    // replDataTxQueue.push.apply(replDataTxQueue,update);
    if(response!==null && typeof(response)!=='undefined'){
        let textToEcho =response.slice(response.indexOf('OK')+2,response.indexOf('>'));
        if(typeof textToEcho!=='undefined' || textToEcho!==null){
            writeEmitter.fire("\r\n"+textToEcho);
        }
    }
    
    await replRawMode(false);
    fileWriteStart  = false;
  
}
export function onDisconnect() {
    vscode.commands.executeCommand('setContext', 'monocle.deviceConnected', false);
    updateStatusBarItem("disconnected");
	writeEmitter.fire("Disconnected \r\n");
}

export function reportUpdatePercentage(perc:any){
    updateStatusBarItem("updating", perc);
    
}
export function receiveRawData(data:any){
    console.log(data);
}

export async function triggerFpgaUpdate(){
    updateStatusBarItem("connected","$(cloud-download) Updating");
    await startFpgaUpdate();
    updateStatusBarItem("connected");
}

