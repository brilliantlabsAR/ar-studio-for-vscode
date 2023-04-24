import { replSend, replRawMode, ensureConnected,reportUpdatePercentage } from "./repl";
import { outputChannel } from "./extension";
import { request } from "@octokit/request";
import {disconnect,isConnected } from './bluetooth';
import * as vscode from 'vscode';
import { btoa } from "buffer";
let fetch = require('node-fetch');

export let micropythonGit:any = {};
export let fpgaGit:any = {};

export async function checkForUpdates() {
    try {
        await replRawMode(true);
        // Short delay to throw away bluetooth data received upon connection
        await new Promise(r => setTimeout(r, 100));
        let message = await getUpdateInfo();
        await replRawMode(false);
        return Promise.resolve(message);
    }catch(error:any){
        outputChannel.appendLine(error);
        await replRawMode(false);
    }
}
async function getUpdateInfo() {

    // Check nRF firmware
    let response:any = await replSend("import device;print(device.VERSION)");
    if (response.includes("Error")) {
        return "Could not detect the firmware version. You may have to update" +
            " manually. Try typing: import update;update.micropython()";
    }
    let currentVersion = response.substring(response.indexOf("v"),
        response.lastIndexOf("\r\n"));

    response = await replSend("print(device.GIT_REPO);del(device)");
    if (response.includes("Error")) {
        return "Could not detect the device. Current version is: " +
            currentVersion + ". You may have to update manually. Try typing: " +
            "import update;update.micropython()";
    }
    let gitRepoLink = response.substring(response.indexOf("https"),
        response.lastIndexOf('\r\n'));

    micropythonGit.owner = gitRepoLink.split('/')[3];
    micropythonGit.repo = gitRepoLink.split('/')[4];
    let getTag = await request("GET /repos/{owner}/{repo}/releases/latest", {
        owner: micropythonGit.owner,
        repo: micropythonGit.repo
    });
    let latestVersion = getTag.data.tag_name;
    if (currentVersion !== latestVersion) {
        return `New firmware ([${latestVersion}](${getTag.url})) update available, Do you want to update?`;
    }

    // Check FPGA image
    fpgaGit.owner = micropythonGit.owner;
    fpgaGit.repo = micropythonGit.repo.replace("micropython", "fpga");
    getTag = await request("GET /repos/{owner}/{repo}/releases/latest", {
        owner: fpgaGit.owner,
        repo: fpgaGit.repo
    });
    latestVersion = getTag.data.tag_name;

    response = await replSend("import fpga;" +
        "print('v'+(lambda:''.join('%02x' % i for i in fpga.read(2,3)))());" +
        "del(fpga)");
    if (response.includes("Error")) {
        return "Could not detect the FPGA image, check manually. ";
    }

    if (!response.includes(latestVersion)) {
        return  `New FPGA image ([${latestVersion}](${getTag.url}))  available, Do you want to update?`;
    }
    return "";
}
let fpgaUpdateInProgress:any = false;
export async function startFirmwareUpdate() {
    await replRawMode(true);
    await replSend("import display;" +
        "display.text('Updating firmware...',120,180,0xffffff);" +
        "display.show();" +
        "import update;" +
        "update.micropython()");
    await replRawMode(false);

    // try to connect after 1 sec
    await disconnect();
    await ensureConnected();
}

export async function startFpgaUpdate(binPath?:vscode.Uri) {

    if (!isConnected()) {
        return Promise.reject("Connect to Monocle first");
    }

    if (fpgaUpdateInProgress === true) {
        return Promise.reject("FPGA update already in progress");
    }

    await replRawMode(true).catch((error) => {
        return Promise.reject(error);
    });
    let file:ArrayBuffer;
    if (!binPath) {
        file = await downloadLatestFpgaImage();
    }else{
        file = await vscode.workspace.fs.readFile(binPath);
    }

    fpgaUpdateInProgress = true;
    await updateFPGA(file);
    fpgaUpdateInProgress = false;

    await replRawMode(false);
}

async function updateFPGA(file:ArrayBuffer) {

    outputChannel.appendLine("Starting FPGA update");
    outputChannel.appendLine("Converting " + file.byteLength + " bytes of file to base64");
    let asciiFile =Buffer.from(file).toString('base64');
    await replSend('import ubinascii, update, device, bluetooth');
    let response:any = await replSend('print(bluetooth.max_length())');
    const maxMtu = parseInt(response.match(/\d/g).join(''), 10);

    // 45 is the string length of the update string. Calculates base64 chunk length
    let chunksize = (Math.floor(Math.floor((maxMtu - 45) / 3) / 4) * 4 * 3);
    let chunks = Math.ceil(asciiFile.length / chunksize);
    outputChannel.appendLine("Chunk size = " + chunksize + ". Total chunks = " + chunks);

    await replSend('update.Fpga.erase()');
    for (let chk = 0; chk < chunks; chk++) {
        response = await replSend("update.Fpga.write(ubinascii.a2b_base64(b'" +
            asciiFile.slice(chk * chunksize, (chk * chunksize) + chunksize)
            + "'))");

        if (response && response.includes("Error")) {
            outputChannel.appendLine("Retrying this chunk");
            chk--;
        }else if(response===null){
            return  Promise.reject("Not responding");
        }

        reportUpdatePercentage((100 / asciiFile.length) * chk * chunksize);
    }

    await replSend("update.Fpga.write(b'done')");
    await replSend('device.reset()');

    outputChannel.appendLine("Completed FPGA update. Resetting");
}

async function downloadLatestFpgaImage() {

    outputChannel.appendLine("Downloading latest release from: github.com/" +
        fpgaGit.owner + "/" + fpgaGit.repo);

    let response:any = await request("GET /repos/{owner}/{repo}/releases/latest", {
        owner: fpgaGit.owner,
        repo: fpgaGit.repo
    });

    let assetId;
    response.data.assets.forEach((item:any, index:number) => {
        if (item.content_type === 'application/macbinary') {
            assetId = item.id;
        }
    });

    response = await request("GET /repos/{owner}/ {repo}/releases/assets/{assetId}", {
        owner: fpgaGit.owner,
        repo: fpgaGit.repo,
        assetId: assetId
    });

    // Annoyingly we have to fetch the data via a cors proxy
    let download = await fetch('https://api.brilliant.xyz/firmware?url=' + response.data.browser_download_url);
    let blob = await download.blob();
    let bin = await blob.arrayBuffer();

    return bin;
}