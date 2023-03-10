import { replSend, replRawMode, ensureConnected } from "./repl";
import { request } from "@octokit/request";
import {disconnect } from './bluetooth';
export let gitInfo :any = {};

export async function checkForUpdates() {

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

// TODO
export async function startFPGAUpdate() {
    await replRawMode(true);
    await replSend('import update;update.fpga()');
    await replRawMode(false);
}