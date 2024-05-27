import {
  replSend,
  replRawMode,
  ensureConnected,
  reportUpdatePercentage,
  frameSend,
} from "./repl";
import { outputChannel } from "./extension";
import { request } from "@octokit/request";
import { disconnect, isConnected,convertToLittleEndian } from "./bluetooth";
let fetch = require("node-fetch");

export let micropythonGit: any = {};
export let fpgaGit: any = {};

// declare a type for update details with optional properties
type UpdateDetails = {
  firmwareVersion?: string;
  macAddress?: string;
  fpgaVersion?: string;
  firmwareUpdate?: string;
  fpgaUpdate?: string;
  message?: string;
};
export async function checkForUpdates() {
  try {
    await replRawMode(true);
    // Short delay to throw away bluetooth data received upon connection
    let message = await getUpdateInfo();
    await replRawMode(false);
    return Promise.resolve(message);
  } catch (error: any) {
    outputChannel.appendLine(error);
    await replRawMode(false);
  }
}
export async function checkForFrameUpdates() {
  try {
    let updateDetails:UpdateDetails = {};
    let response:any = await frameSend("print(frame.FIRMWARE_VERSION);",2);
    let macAddress:any = await frameSend("print(frame.bluetooth.address());",2);
    updateDetails.firmwareVersion = response||'Unknown';
    updateDetails.macAddress = macAddress||'Unknown';
    updateDetails.firmwareUpdate = 'Unknown';

  
    return Promise.resolve(updateDetails);
  } catch (error: any) {
    outputChannel.appendLine(error);
  }
}
async function getUpdateInfo() {
  // Check nRF firmware
  let updateDetails:UpdateDetails = {};
  let getTag:any;
  let response: any = await replSend("import device;print(device.VERSION);print('MACADDR#'+device.mac_address())");
  if (response && response.includes("Error")) {
    updateDetails.message=  "Could not detect the firmware version. You may have to update" +
    " manually. Try typing: import update;update.micropython()";
    updateDetails.firmwareVersion = "Unknown";
    return updateDetails;
  }else if(response){
      let currentVersion = response.substring(
        response.indexOf("v"),
        response.indexOf("MACADDR#")-2
      );
      let macAddress = response.substring(
        response.indexOf("MACADDR#")+8,
        response.lastIndexOf(">")-4
      );
      updateDetails.firmwareVersion = currentVersion;
      updateDetails.macAddress = convertToLittleEndian(macAddress.trim()).toUpperCase();
      response = await replSend("print(device.GIT_REPO);del(device)");
      if (response.includes("Error")) {
        updateDetails.message  =  "Could not detect the device. Current version is: " +
        currentVersion +
        ". You may have to update manually. Try typing: " +
        "import update;update.micropython()";
       
      }else{
          let gitRepoLink = response.substring(
            response.indexOf("https"),
            response.lastIndexOf("\r\n")
          );
        
          micropythonGit.owner = gitRepoLink.split("/")[3];
          micropythonGit.repo = gitRepoLink.split("/")[4];
           getTag = await request("GET /repos/{owner}/{repo}/releases/latest", {
            owner: micropythonGit.owner,
            repo: micropythonGit.repo,
          });
          let latestVersion = getTag.data.tag_name;
         
          if (currentVersion !== latestVersion) {
            updateDetails.firmwareUpdate= latestVersion;
            updateDetails.message = `New firmware ([${latestVersion}](${getTag.url})) update available, Do you want to update?`;
          }
      }
      return updateDetails;
  }
  

  // Check FPGA image
  fpgaGit.owner = micropythonGit.owner;
  fpgaGit.repo = micropythonGit.repo.replace("micropython", "fpga");
  getTag = await request("GET /repos/{owner}/{repo}/releases/latest", {
    owner: fpgaGit.owner,
    repo: fpgaGit.repo,
  });
  let latestVersion = getTag.data.tag_name;

  response = await replSend(
    "import fpga;" + "print(fpga.read(2,12));" + "del(fpga)"
  );
  if (response && response.includes("Error")) {
    updateDetails.message ="Could not detect the FPGA image, check manually. ";
    updateDetails.fpgaVersion ="Unknown";
  }else if(response){
    let currentVersion = response.substring(
      response.indexOf("OKb"),
      response.lastIndexOf("\r\n")
    );
    if(currentVersion.includes('\\x00\\x00\\x00\\x00')){
      updateDetails.fpgaVersion = "Uknown";
    }else{
      updateDetails.fpgaVersion = currentVersion;
    }
   
    if (!response.includes(latestVersion)) {
      updateDetails.fpgaUpdate =  latestVersion;
      updateDetails.message =  `New FPGA image ([${latestVersion}](${getTag.url}))  available, Do you want to update?`;
    }
    updateDetails.message = '';
  }
return updateDetails; 
  
}

export async function startFirmwareUpdate() {
  await replRawMode(true);
  await replSend(
    "import display as d;" +
      "m= d.Text('Updating firmware...',120,180,0xffffff,justify=d.MIDDLE_LEFT);" +
      "d.show(m);" +
      "import update;" +
      "update.micropython()"
  );
  await replRawMode(false);

  // try to connect after 1 sec
  await disconnect();
  await ensureConnected();
}


export async function updateFPGA(file: ArrayBuffer) {
  outputChannel.appendLine("Starting FPGA update");
  outputChannel.appendLine(
    "Converting " + file.byteLength + " bytes of file to base64"
  );
  let asciiFile = Buffer.from(file).toString("base64");
  await replSend("import ubinascii, update, device, bluetooth");
  let response: any = await replSend("print(bluetooth.max_length())");
  const maxMtu = parseInt(response.match(/\d/g).join(""), 10);

  // 45 is the string length of the update string. Calculates base64 chunk length
  let chunksize = Math.floor(Math.floor((maxMtu - 45) / 3) / 4) * 4 * 3;
  let chunks = Math.ceil(asciiFile.length / chunksize);
  outputChannel.appendLine(
    "Chunk size = " + chunksize + ". Total chunks = " + chunks
  );

  await replSend("update.Fpga.erase()");
  for (let chk = 0; chk < chunks; chk++) {
    response = await replSend(
      "update.Fpga.write(ubinascii.a2b_base64(b'" +
        asciiFile.slice(chk * chunksize, chk * chunksize + chunksize) +
        "'))"
    );

    if (response && response.includes("Error")) {
      outputChannel.appendLine("Retrying this chunk");
      chk--;
    } else if (response === null) {
      return Promise.reject("Not responding");
    }
    reportUpdatePercentage((100 / asciiFile.length) * chk * chunksize);
  }

  await replSend("update.Fpga.write(b'done')");
  await replSend("device.reset()");
  outputChannel.appendLine("Completed FPGA update. Resetting");
}

export async function downloadLatestFpgaImage() {
  let chiprev = "revC";

  // let chipresponse:any = await replSend("import fpga;print(fpga.version())");
  // if (chipresponse && chipresponse.includes("revB")) {
  //   chiprev = "revB";
  // }

  outputChannel.appendLine(
    "Downloading latest release from: github.com/" +
      fpgaGit.owner +
      "/" +
      fpgaGit.repo
  );

  let response: any = await request(
    "GET /repos/{owner}/{repo}/releases/latest",
    {
      owner: fpgaGit.owner,
      repo: fpgaGit.repo,
    }
  );

  let assetId;
  response.data.assets.forEach((item: any, index: number) => {
    // if (item.name.includes('revC.bin') && chiprev === "revC") {
      if (item.name.includes('.bin')) {
      assetId = item.id;
      }
  // }

  // if (item.name.includes('revB.bin') && chiprev === "revB") {
  //     assetId = item.id;
  //   }
  });

  response = await request(
    "GET /repos/{owner}/{repo}/releases/assets/{assetId}",
    {
      owner: fpgaGit.owner,
      repo: fpgaGit.repo,
      assetId: assetId,
    }
  );

  // Annoyingly we have to fetch the data via a cors proxy
  let download = await fetch(
    "https://api.brilliant.xyz/firmware?url=" +
      response.data.browser_download_url
  );
  let blob = await download.blob();
  let bin = await blob.arrayBuffer();

  return bin;
}
