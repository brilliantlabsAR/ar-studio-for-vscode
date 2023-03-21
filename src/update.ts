import { replSend, replRawMode, ensureConnected,reportUpdatePercentage } from "./repl";
import { outputChannel } from "./extension";
import { request } from "@octokit/request";
import {disconnect } from './bluetooth';
let fetch = require('node-fetch');
export let gitInfo :any = {};
export let fpgaGit:any = {};

export async function checkForUpdates() {
    try {
        await replRawMode(true);
    // Short delay to throw away bluetooth data received upon connection
    await new Promise(r => setTimeout(r, 100));

    let response:any = await replSend("import device;print(device.VERSION)");
    if (response.includes("Error")) {
        await replRawMode(false);
        return Promise.reject("Could not detect the firmware version. " +
            "You may have to update manually. " +
            "Try typing: <b>import update;update.micropython()</b>");
    }
    let currentVersion = response.substring(response.indexOf("v"),
        response.lastIndexOf("\r\n"));

    response = await replSend("print(device.GIT_REPO);del(device)");
    if (response.includes("Error")) {
        await replRawMode(false);
        return Promise.reject("Could not detect the device. Current version is: " +
            currentVersion + ". You may have to update manually. " +
            "Try typing: <b>import update;update.micropython()</b>");
    }
    let gitRepoLink = response.substring(response.indexOf("https"),
        response.lastIndexOf('\r\n'));

    gitInfo.owner = gitRepoLink.split('/')[3];
    gitInfo.repo = gitRepoLink.split('/')[4];
    const getTag = await request("GET /repos/{owner}/{repo}/releases/latest", {
        owner: gitInfo.owner,
        repo: gitInfo.repo
    });
    let latestVersion = getTag.data.tag_name;

    if (currentVersion === latestVersion) {
        await replRawMode(false);
        return Promise.resolve("");
    }

    if (gitRepoLink.includes("monocle")) {
        await replSend(
            "import display;" +
            "display.text('New firmware available',100,180,0xffffff);" +
            "display.show();" +
            "del(display)"
        );
    }

    await replRawMode(false);
    return Promise.resolve(`New firmware ([${latestVersion}](${getTag.url})) update available, Do you want to update?`);
    } catch (error:any) {
        outputChannel.appendLine(error);
        await replRawMode(false);
    }
    
}

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

export async function startFpgaUpdate() {

     outputChannel.appendLine("Starting FPGA update");
    let file = await obtainFpgaFile();

     outputChannel.appendLine("Converting " + file.byteLength + " bytes of file to base64");
    let bytes = new Uint8Array(file);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    let asciiFile = Buffer.from(binary,'base64');

    await replRawMode(true);
    await replSend('import ubinascii;import storage;import device');
    await replSend('storage.delete("FPGA_BITSTREAM")');

    let chunkSize = 340; // Corresponds to 255 bytes
    let chunks = Math.ceil(asciiFile.length / chunkSize);
    for (let chk = 0; chk < chunks; chk++) {
        await replSend('storage.append("FPGA_BITSTREAM",ubinascii.a2b_base64("' +
            asciiFile.slice(chk * chunkSize, (chk * chunkSize) + chunkSize)
            + '"))');
        reportUpdatePercentage((100 / asciiFile.length) * chk * chunkSize);
    }

    await replSend('storage.append("FPGA_BITSTREAM","BITSTREAM_WRITTEN")');
    await replSend('device.reset()');
    await replRawMode(false);

     outputChannel.appendLine("Completed FPGA update. Resetting");
}

async function obtainFpgaFile() {

    if (!fpgaGit.owner || !fpgaGit.repo) {
        // TODO
        fpgaGit.owner = 'brilliantlabsAR';
        fpgaGit.repo = 'monocle-fpga';
    }

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

    response = await request("GET /repos/{owner}/{repo}/releases/assets/{assetId}", {
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