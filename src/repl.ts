import { isConnected, replDataTxQueue,connect,disconnect } from './bluetooth';
import { checkForUpdates, startFirmwareUpdate, downloadLatestFpgaImage, updateFPGA } from "./update";
import { writeEmitter,updateStatusBarItem,outputChannel,updatePublishStatus, deviceTreeProvider, monocleFolder } from './extension';
import { startNordicDFU } from './nordicdfu'; 
import * as vscode from 'vscode';
import * as path from 'path';
let util = require('util');
let prevPerc = 0;
let updateInProgress:boolean = false;
let fpgaUpdateInProgress: any = false;
let progressReport:any;
export let replRawModeEnabled = false;
let rawReplResponseString = '';
let rawReplResponseCallback:any;
let fileWriteStart = false;
let internalOperation = false;
const decoder = new util.TextDecoder('utf-8');
const RESET_CMD = '\x03\x04';
const FILE_WRITE_MAX = 1000000;
let DIR_MAKE_CMD = `import os
def md(p):
    c=""
    for d in p.split("/"):
        c += "/"+d
        try:
            os.mkdir(c)
        except:
            pass
`;
export async function replRawMode(enable:boolean) {

    if (enable === true) {
        replRawModeEnabled = true;
        outputChannel.appendLine("Entering raw REPL mode");
        await replSend('\x03\x01');
        return;
    }

     outputChannel.appendLine("Leaving raw REPL mode");
    await replSend('\x03\x02');
    replRawModeEnabled = false;
    
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
        }, 5000);
    });
}

let initializedWorkspace = false;
export async function ensureConnected() {
    
    if (isConnected() === true) {
        updateStatusBarItem("connected");
        return;
    }
    updateStatusBarItem("progress");
    try {
        let connectionResult = await connect();

        if (connectionResult === "dfu connected") {
            // infoText.innerHTML = "Starting firmware update..";
            updateStatusBarItem("connected","$(cloud-download) Updating");
            updateInProgress = true;
            prevPerc = 0;
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                cancellable: true,
                title: 'Updating firmware',
            }, async (progress,canceled) => {
                canceled.onCancellationRequested(()=>{
                    disconnect();
                    vscode.window.showErrorMessage("Cancelled firmware update! connect to monocle after few moments \n or connect now to again update")
                });
                progress.report({message:"updating",increment:0});
                progressReport = progress;
                await new Promise(r => {
                    let clearIntervalId = setInterval(()=>{
                        if(updateInProgress===false){
                            clearInterval(clearIntervalId);
                            progressReport = null;
                            r("");
                        }
                    });
                });

            });
            let updateStatus = await startNordicDFU();
            if(updateStatus==='completed'){
                updateInProgress = false;
                await disconnect();
                vscode.window.showInformationMessage("Firmware Update done");
                updateStatusBarItem("progress");
                // after 2 sec try to connect;
                setTimeout(ensureConnected,2000);
            }else{
                console.log(updateStatus);
                vscode.window.showErrorMessage("firmware update failed");
                updateInProgress = false;
                disconnect();
            }
            progressReport = null;
            prevPerc = 0;
            
            // return;
        }

        if (connectionResult === "repl connected") {
            try {
                updatePublishStatus();
            } catch (error) {
                
            }
           
            // infoText.innerHTML = "Connected";
            // replResetConsole();
            vscode.commands.executeCommand('setContext', 'monocle.deviceConnected', true);
                // writeEmitter.fire("Connected\r\n");
                updateStatusBarItem("connected");
               let updateInfo = await checkForUpdates();
           
            if(!initializedWorkspace){
                // setupWorkSpace();
                // initializedWorkspace = true;
            }
           
            // console.log(updateInfo);
            if (updateInfo !== "") {
                let newFirmware = updateInfo?.includes('New firmware');
                let newFpga = updateInfo?.includes('New FPGA');
                let items:string[] =["Update Now","Later"] ;
                const updateMsg = new vscode.MarkdownString(updateInfo);
                vscode.commands.executeCommand('setContext', 'monocle.fpgaAvailable', newFpga);
                if(newFirmware){
                    vscode.window.showInformationMessage(updateMsg.value,...items).then(op=>{
                        if(op==="Update Now"){
                            // if(newFirmware){
                             startFirmwareUpdate();
                            // }else if(newFpga){
                                // triggerFpgaUpdate();
                            // }
                        }
                    });
                }else if(newFpga){
                    // vscode.commands.executeCommand('setContext', 'monocle.fpgaAvailable', newFpga);
                }else{
                    vscode.window.showInformationMessage(updateMsg.value);
                    await replRawMode(false);
                }
            }
            try {
                await vscode.commands.executeCommand('workbench.actions.treeView.fileExplorer.refresh');
            } catch (error) {
                
            }
            let allTerminals = vscode.window.terminals.filter(ter=>ter.name==='REPL');
            if(allTerminals.length>0){
                allTerminals[0].show();
                vscode.commands.executeCommand('workbench.action.terminal.clear');
                
            }  
            await replSend('\x02'); 
        }
    }

    catch (error:any) {
        // Ignore User cancelled errors
        if (error.message && error.message.includes("cancelled")) {
            return;
        }
        vscode.window.showErrorMessage(String(error));
        // infoText.innerHTML = error;
        // console.error(error);
        updateStatusBarItem("disconnected");
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
    if(internalOperation){
        return;
    }
    writeEmitter.fire(string);
}

export async function sendFileUpdate(update:any){
    // console.log(JSON.stringify(update));
    if(replRawModeEnabled){
        vscode.window.showInformationMessage("Device Busy");
        return [];
    }
    fileWriteStart = true;
    await replRawMode(true);
    let response:any = await replSend(decoder.decode(update));
    // replDataTxQueue.push.apply(replDataTxQueue,update);
    if(response!==null && typeof(response)!=='undefined'){
        let textToEcho =response.slice(response.indexOf('OK')+2,response.indexOf('>'));
        if(typeof textToEcho!=='undefined' || textToEcho!==null){
            writeEmitter.fire("\r\n"+textToEcho);
        }
    }
    replRawModeEnabled = false;
    await replRawMode(false);
    fileWriteStart  = false;
  
}
export async function onDisconnect() {
     prevPerc = 0;
     updateInProgress = false;
     replRawModeEnabled = false;
     fileWriteStart = false;
     internalOperation = false;
     progressReport =null;
    vscode.commands.executeCommand('setContext', 'monocle.deviceConnected', false);
    updateStatusBarItem("disconnected");
	writeEmitter.fire("\r\nDisconnected \r\n");
    await vscode.commands.executeCommand('workbench.actions.treeView.fileExplorer.refresh');
}


export function reportUpdatePercentage(perc:number){
    updateStatusBarItem("updating", perc.toFixed(2));
    progressReport?.report({message: perc.toFixed(2)+" %",increment:perc- prevPerc});
    prevPerc = perc;
}


export async function triggerFpgaUpdate(binPath?:vscode.Uri){
    if (!isConnected()) {
       vscode.window.showWarningMessage("Connect to Monocle first");
       return ;
    }
    if (fpgaUpdateInProgress === true) {
       vscode.window.showWarningMessage("FPGA update already in progress");
       return;
    }
    
    updateStatusBarItem("connected","$(cloud-download) Updating");
    updateInProgress = true;
    prevPerc = 0;
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        cancellable: true,
        title: 'Updating FPGA',
    }, async (progress,canceled) => {
        canceled.onCancellationRequested(()=>{
            disconnect();
            ensureConnected();
            // vscode.window.showErrorMessage("Cancelled FPGA update! connect to monocle after few moments \n or connect now to again update");
        });
        progress.report({message:"updating",increment:0});
        progressReport = progress;
        await new Promise(r => {
            let clearIntervalId = setInterval(()=>{
                if(updateInProgress===false){
                    clearInterval(clearIntervalId);
                    progressReport = null;
                    r("");
                }
            });
        });

    });
      try {
        await replRawMode(true);
    
          let file: ArrayBuffer;
          if (!binPath) {
            file = await downloadLatestFpgaImage();
          } else {
            file = await vscode.workspace.fs.readFile(binPath);
          }
        
        fpgaUpdateInProgress = true;
        await updateFPGA(file).catch(console.log);
        fpgaUpdateInProgress = false;
    
        await replRawMode(false);
        vscode.window.showInformationMessage("FPGA Update done");
      } catch (error) {
        fpgaUpdateInProgress = false;
        console.log(error);
        vscode.window.showInformationMessage("FPGA Update failed");
      }
     
    updateInProgress = false;
    prevPerc = 0;
    updateStatusBarItem("connected");
}

//  close the file operation and raw mode
async function exitRawReplInternal(){
    await replRawMode(false);
    internalOperation = false;
}

//  enter raw repl for file operation
async function enterRawReplInternal(){
    if (!isConnected()) {
        return false;
    }
    //  check if already a file operation going on
    if(replRawModeEnabled || internalOperation){
        await new Promise(r => {
            let interval = setInterval(()=>{
                if(!replRawModeEnabled && !internalOperation){
                    setTimeout(()=>{
                        r("");
                    },10);
                    clearInterval(interval);
                }
            },10);
        });
    }
    internalOperation = true;
    await replRawMode(true);
    await new Promise(r => setTimeout(r, 10));
    return true;
}

// list files and folders for the device under given path
export async function listFilesDevice(currentPath="/"):Promise<string[]>{

    if(!await enterRawReplInternal()){return[];};
    let cmd = `import os,ujson;
d="${currentPath}"
l =[]
if os.stat(d)[0] & 0x4000:
    for f in os.ilistdir(d):
        if f[0] not in ('.', '..'):
            l.append({"name":f[0],"file":not f[1] & 0x4000})
print(ujson.dumps(l))
del(os,l,d)`;
    let response:any = await replSend(cmd);

    await exitRawReplInternal();

    if(response){
        try{
            let strList = response.slice(response.indexOf('OK')+2,response.indexOf('\r\n\x04'));
            strList = JSON.parse(strList);
            // strList.push('main.py');
            return strList;
        }catch(error:any){
            outputChannel.appendLine(error);
            return [];
        }
    }
    return [];
}
export function colorText(text: string, colorIndex=4): string {
	let output = '';
	// let colorIndex = 4;
	for (let i = 0; i < text.length; i++) {
		const char = text.charAt(i);
		if (char === ' ' || char === '\r' || char === '\n') {
			output += char;
		} else {
			output += `\x1b[3${colorIndex}m${text.charAt(i)}\x1b[0m`;
			if (colorIndex > 6) {
				colorIndex = 1;
			}
		}
	}
	return output;
}
const updateToTerminal = function (msg:string,colorIndex=4){
    writeEmitter.fire('\n\r'+colorText(msg,colorIndex)+'\n\r>>> ');

};
//  create directory recursively
export async function createDirectoryDevice(devicePath:string):Promise<boolean>{
   
    if(!await enterRawReplInternal()){return false;};
    let dirMakeCmd = DIR_MAKE_CMD+`md('${devicePath}');del(md,os)`;
    let response:any = await replSend(dirMakeCmd);
    updateToTerminal(`Creating  ${devicePath} `);
    await exitRawReplInternal();
    if(response && !response.includes("Error")){
        return true;
    }
    return false;
}

//  upload files recursively to device
export async function uploadFileBulkDevice(uris:vscode.Uri[], devicePath:string):Promise<boolean>{
    
    if(!await enterRawReplInternal()){return false;};
    // if(devicePath!==''){
        let dirMakeCmd = DIR_MAKE_CMD+`md('${devicePath}')`;
        await replSend(dirMakeCmd);
    // }

    await new Promise(async (res,rej)=>{
        for (let index = 0; index < uris.length; index++) {
            const uri = uris[index];
            
        // uris.forEach(async (uri:vscode.Uri,index:number)=>{
            try {
                // let absPath = uri.path.replaceAll("\\","/");
                // let dPath = absPath.slice(absPath.indexOf(devicePath));
                // if(devicePath===''){
                //     dPath = absPath.slice(absPath.indexOf(monocleFolder)+monocleFolder.length+1);
                // }
                let dPath = devicePath + '/'+ path.posix.basename(uri.path);
                let segments = dPath.split('/');
                let fileWriteCmd = "";
                if(segments.length>1){
                    let newDirTocreate = segments.slice(0,segments.length-1).join("/");
                    if(newDirTocreate!==devicePath){
                        fileWriteCmd += `md('${newDirTocreate}')\n`;
                    }
                }
                let fileData = await vscode.workspace.fs.readFile(uri);
        
                if(fileData.byteLength===0){
                    
                    fileWriteCmd += "f = open('"+ dPath +"', 'w');f.write('');f.close()";
                    let response:any = await replSend(fileWriteCmd);
                    updateToTerminal(`Creating  ${dPath} `);
                    if(response &&  response.includes("Error")){
                        vscode.window.showInformationMessage('File Transfer failed for '+uri.path);
                    };
                }
                if(fileData.byteLength<=FILE_WRITE_MAX && fileData.byteLength>0){
                    
                    fileWriteCmd +=`f=open('${dPath}', 'w');f.write('''${decoder.decode(fileData)}''');f.close()`;
                    let response:any = await replSend(fileWriteCmd);
                    updateToTerminal(`Updating  ${dPath} `);
                    if(response &&  response.includes("Error")){
                        vscode.window.showInformationMessage('File Transfer failed for '+uri.path);
                    };
                }
                if(index===(uris.length-1)){
                    res("");
                }
            } catch (error) {
                console.log(error);
                if(index===(uris.length-1)){
                    res("");
                }
                continue;
            }
            
        }
       
    });
    await replSend("\x03");
    await exitRawReplInternal();
    // updateToTerminal(`Applying Reset (ctrl-D)`,3);
    // await replSend(RESET_CMD);
    return true;
}
//  Build (upload all mapped files)
export interface FileMaps {
    uri : vscode.Uri,
    devicePath: string
}
export async function buildMappedFiles(fileMaps:FileMaps[]):Promise<boolean>{
    
    if(!await enterRawReplInternal()){return false;}

    await new Promise(async (res,rej)=>{
        for (let index = 0; index < fileMaps.length; index++) {
            const fileMAp = fileMaps[index];
            
        // uris.forEach(async (uri:vscode.Uri,index:number)=>{
            try {
                // let absPath = uri.path.replaceAll("\\","/");
                // let dPath = absPath.slice(absPath.indexOf(devicePath));
                // if(devicePath===''){
                //     dPath = absPath.slice(absPath.indexOf(monocleFolder)+monocleFolder.length+1);
                // }
                let dPath = fileMAp.devicePath;
                let segments = dPath.split('/');
                let fileWriteCmd = "";
                if(segments.length>1){
                    let newDirTocreate = segments.slice(0,segments.length-1).join("/");
                    if(newDirTocreate!==fileMAp.devicePath){
                        fileWriteCmd += DIR_MAKE_CMD+`md('${newDirTocreate}')\n`;
                    }
                }
                let fileData = await vscode.workspace.fs.readFile(fileMAp.uri);
        
                if(fileData.byteLength===0){
                    
                    fileWriteCmd += "f = open('"+ dPath +"', 'w');f.write('');f.close()";
                    let response:any = await replSend(fileWriteCmd);
                    updateToTerminal(`Creating  ${dPath} `);
                    if(response &&  response.includes("Error")){
                        vscode.window.showInformationMessage('File Transfer failed for '+fileMAp.uri.path);
                    };
                }
                if(fileData.byteLength<=FILE_WRITE_MAX && fileData.byteLength>0){
                    
                    fileWriteCmd +=`f=open('${dPath}', 'w');f.write('''${decoder.decode(fileData)}''');f.close()`;
                    let response:any = await replSend(fileWriteCmd);
                    updateToTerminal(`Updating  ${dPath} `);
                    if(response &&  response.includes("Error")){
                        vscode.window.showInformationMessage('File Transfer failed for '+fileMAp.uri.path);
                    };
                }
                if(index===(fileMaps.length-1)){
                    res("");
                }
            } catch (error) {
                console.log(error);
                if(index===(fileMaps.length-1)){
                    res("");
                }
                continue;
            }
            
        }
       
    });
    await replSend("\x03");
    await exitRawReplInternal();
    updateToTerminal(`Applying Reset (ctrl-D)`,3);
    await replSend(RESET_CMD);
    return true;
}
//  create or update individual file on device
export async function creatUpdateFileDevice(uri:vscode.Uri, devicePath:string):Promise<boolean>{
    
    if(!await enterRawReplInternal()){return false;};
    // let absPath = uri.path.replaceAll("\\","/");
    // let dPath = absPath.slice(absPath.indexOf(devicePath));
    let segments = devicePath.split('/');
    if(segments.length>1){
        let newDirTocreate = segments.slice(0,segments.length-1).join("/");
            if(newDirTocreate!==devicePath){
                let dirCreate = DIR_MAKE_CMD+`md('${newDirTocreate}');del(os,md)`;
                    await replSend(dirCreate);
            }
    }
    let fileData = await vscode.workspace.fs.readFile(uri);

    if(fileData.byteLength===0){
        
         let response:any = await replSend("f = open('"+ devicePath +"', 'w');f.write('');f.close()");
         updateToTerminal(`Creating  ${devicePath} `);
        await exitRawReplInternal();
        if(response &&  !response.includes("Error")){
            return true;
        }
        else{
            vscode.window.showErrorMessage(response);
        };
    }
    if(fileData.byteLength<=FILE_WRITE_MAX){
        updateToTerminal(`Updating  ${devicePath} `);
        let response:any = await replSend(`f=open('${devicePath}', 'w');f.write('''${decoder.decode(fileData)}''');f.close()`);
      
        await exitRawReplInternal();
        // updateToTerminal(`Applying Reset (ctrl-D)`,3);
        // replSend(RESET_CMD);
        if(response &&  !response.includes("Error")){
            return true;
        }
        else{
            vscode.window.showErrorMessage(response);
        };
    }else{
        await exitRawReplInternal();
        vscode.window.showInformationMessage('Please keep files smaller. Meanwhile we are wroking to allow larger files');
        return false;
    }
    
    return false;
}
//  rename or move files and folders on device
export async function renameFileDevice(oldDevicePath:string, newDevicePath:string):Promise<boolean>{
    
    if(!await enterRawReplInternal()){return false;};
    
    let cmd = `import os;
os.rename('${oldDevicePath}','${newDevicePath}'); del(os)`;
    let response:any = await replSend(cmd);
    updateToTerminal(`Renaming ${oldDevicePath} To ${newDevicePath} `);
    

    await exitRawReplInternal();
    // updateToTerminal(`Applying Reset (ctrl-D)`,3);
    // replSend(RESET_CMD);
    if(response &&  !response.includes("Error")){return true;};
    return false;
}

//  reading a individual file data from device
export async function readFileDevice(devicePath:string):Promise<boolean|string>{
   
    if(!await enterRawReplInternal()){return false;};

    let cmd = `f=open('${devicePath}');print(f.read());f.close();del(f)`;
    let response:any = await replSend(cmd);
    await exitRawReplInternal();
    if(response &&  !response.includes("Error")){return response.slice(response.indexOf('OK')+2,response.indexOf('\r\n\x04'));};
    return false;
}

//  delete files/directory recursively from device
export async function deleteFilesDevice(devicePath:string):Promise<boolean>{

    if(!await enterRawReplInternal()){return false;};
    updateToTerminal(`Deleting  ${devicePath} `);
    let cmd = `import os;
def rm(d):
    try:
        if os.stat(d)[0] & 0x4000:
            for f in os.ilistdir(d):
                if f[0] not in ('.', '..'):
                    rm("/".join((d, f[0])))
            os.rmdir(d)
        else:
            os.remove(d)
    except Exception as e:
        print("rm of '%s' failed" % d,e)
rm('${devicePath}'); del(os);del(rm)`;
    let response:any = await replSend(cmd);
    
    await exitRawReplInternal();
    // updateToTerminal(`Applying Reset (ctrl-D)`,3);
    // replSend(RESET_CMD);
    if(response &&  !response.includes("failed")){return true;};
    return false;
}

// handle data from terminal input 
export async function terminalHandleInput(data:string){
    if(replRawModeEnabled || internalOperation){
        await new Promise(r => {
            let interval = setInterval(()=>{
                if(!replRawModeEnabled && !internalOperation){
                    setTimeout(()=>{
                        r("");
                    },10);
                    clearInterval(interval);
                }
            },10);
        });
    }
    replSend(data);
}
