// Details on how this works: 
// https://infocenter.nordicsemi.com/topic/sdk_nrf5_v17.1.0/lib_dfu_transport_ble.html

import { transmitNordicDfuControlData, transmitNordicDfuPacketData } from "./bluetooth";
import { outputChannel } from "./extension";
import { micropythonGit } from "./update";
import { reportUpdatePercentage } from "./repl";
import * as vscode from 'vscode';
import { request } from "@octokit/request";
let JSZIP = require("jszip");
let fetch = require('node-fetch');
let controlResponseCallback:any;

export async function startNordicDFU() {
    try {
        
        outputChannel.appendLine('Entering nRF52 DFU');

        let files:any = await obtainFiles();

        await transferFile(files.dat, 'init');
        await transferFile(files.bin, 'image');

        outputChannel.appendLine('Leaving nRF52 DFU');
        return Promise.resolve("completed");
    } catch (error) {
        return Promise.resolve(error);
    }
}

export async function nordicDfuSendControl(bytes:any) {

    outputChannel.appendLine('DFU control ⬆️: ' + bytes);

    transmitNordicDfuControlData(bytes);
    
    // Return a promise which calls a function that'll eventually run when the
    // response handler calls the function associated with controlResponseCallback
    return new Promise(resolve => {
        controlResponseCallback = function (responseBytes:Uint8Array) {
            outputChannel.appendLine('DFU control ⬇️: ' + new Uint8Array(responseBytes.buffer));
            resolve(responseBytes);
        };
        setTimeout(() => {
            resolve("");
        }, 1000);
    });
}

export function nordicDfuHandleControlResponse(bytes:Uint8Array) {
    controlResponseCallback(bytes);
}

export async function nordicDfuSendPacket(bytes:Uint8Array) {
    const payload = new Uint8Array(bytes);
    outputChannel.appendLine('DFU packet ⬆️: ' + payload);
    await transmitNordicDfuPacketData(payload);
    // Wait a little while as this is a write without response
    await new Promise(r => setTimeout(r, 10));
}

async function obtainFiles() {

    if (!micropythonGit.owner || !micropythonGit.repo) {
        // TODO
        micropythonGit.owner = 'brilliantlabsAR';
        micropythonGit.repo = 'monocle-micropython';
    }

    outputChannel.appendLine("Downloading latest release from: github.com/" +
    micropythonGit.owner + "/" + micropythonGit.repo);
    let headers = {
        authorization: "token "+ (await vscode.authentication.getSession('github',['read:user', 'user:email', 'repo', 'workflow'],{createIfNone:true})).accessToken,
          'X-GitHub-Api-Version': '2022-11-28'
        };
    let response:any = await request("GET /repos/{owner}/{repo}/releases/latest", {
        owner: micropythonGit.owner,
        repo: micropythonGit.repo,
        headers
    });

    let assetId;
    response.data.assets.forEach((item:any, index:Number) => {
        if (item.content_type === 'application/zip') {
            assetId = item.id;
        }
    });

    response = await request("GET /repos/{owner}/{repo}/releases/assets/{assetId}", {
        owner: micropythonGit.owner,
        repo: micropythonGit.repo,
        assetId: assetId,
        headers
    });

    // Annoyingly we have to fetch the data via a cors proxy

    let download = await fetch('https://api.brilliant.xyz/firmware?url=' + response.data.browser_download_url);
    let blob = await download.blob();
    let buffer = await blob.arrayBuffer();

    let zip = await JSZIP.loadAsync(buffer);

    let manifest = await zip.file('manifest.json').async('string');
    let dat = await zip.file('application.dat').async('arraybuffer');
    let bin = await zip.file('application.bin').async('arraybuffer');

    return { manifest, dat, bin };
}

async function transferFile(file:any, type:any) {

    let response:any;

    // Select command
    switch (type) {
        case 'init':
            outputChannel.appendLine('Transferring init file');
            response = await nordicDfuSendControl([0x06, 0x01]);
            break;
        case 'image':
            outputChannel.appendLine('Transferring image file');
            response = await nordicDfuSendControl([0x06, 0x02]);
            break;

        default:
            return Promise.reject('Invalid file type');
    }

    const fileSize = file.byteLength;

    outputChannel.appendLine("fileSize: " + fileSize);

    const maxSize = response.getUint32(3, true);
    const offset = response.getUint32(7, true);
    const crc = response.getUint32(11, true);

    outputChannel.appendLine("maxSize: " + maxSize + ", offset: " + offset + ", crc: " + crc);

    let chunks = Math.ceil(fileSize / maxSize);
    outputChannel.appendLine("Sending file as " + chunks + " chunks");

    let fileOffset = 0;
    for (let chk = 0; chk < chunks; chk++) {

        let chunkSize = Math.min(fileSize, maxSize);

        // The last chunk could be smaller
        if (chk === chunks - 1 && fileSize % maxSize) {
            chunkSize = fileSize % maxSize;
        }

        const chunkCrc = crc32(new Uint8Array(file)
            .slice(0, fileOffset + chunkSize));

            outputChannel.appendLine(
            "chunk " + chk +
            ", fileOffset: " + fileOffset +
            ", chunkSize: " + chunkSize + ", chunkCrc: " + chunkCrc);

        // Create command with size
        let chunkSizeAsBytes =
            [chunkSize & 0xFF, chunkSize >> 8 & 0xFF,
            chunkSize >> 16 & 0xff, chunkSize >> 24 & 0xff];

        if (type === 'init') {
            await nordicDfuSendControl([0x01, 0x01].concat(chunkSizeAsBytes));
        }
        if (type === 'image') {
            await nordicDfuSendControl([0x01, 0x02].concat(chunkSizeAsBytes));
        }

        // Send packets as maximum 100 byte payloads (assume max 100 byte MTU)
        const packets = Math.ceil(chunkSize / 100);
        for (let pkt = 0; pkt < packets; pkt++) {

            // The last packet could be smaller
            let packetLength = 100;
            if (pkt === packets - 1 && chunkSize % 100) {
                packetLength = chunkSize % 100;
            }

            const fileSlice = file.slice(fileOffset, fileOffset + packetLength);
            fileOffset += fileSlice.byteLength;

            await nordicDfuSendPacket(fileSlice);
            // .report({  increment: Math.round((100 / fileSize) * fileOffset) });
            if(type==="image"){
                reportUpdatePercentage((100 / fileSize) * fileOffset);

            }
        }

        // Calculate CRC
        response = await nordicDfuSendControl([0x03]);
        let returnedOffset = response.getUint32(3, true);
        let returnedCrc = response.getUint32(7, true);

        outputChannel.appendLine("returnedOffset: " + returnedOffset + ", returnedCrc: " + returnedCrc);

        if (returnedCrc !== chunkCrc) {
            return Promise.reject('CRC mismatch after sending this chunk. Expected: ' + chunkCrc);
        }

        // Execute command
        await nordicDfuSendControl([0x04]);
    }
}


function crc32(r:any) {
    for (var a, o = [], c = 0; c < 256; c++) {
        a = c;
        for (var f = 0; f < 8; f++) {
            a = 1 & a ? 3988292384 ^ a >>> 1 : a >>> 1;
        }
        o[c] = a;
    }
    for (var n = -1, t = 0; t < r.length; t++) {
        n = n >>> 8 ^ o[255 & (n ^ r[t])];
    }
    return (-1 ^ n) >>> 0;
}

  