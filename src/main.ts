import { connect, disconnect, isConnected } from "./bluetooth";

// import { replHandleKeyPress, replResetConsole, replFocusCursor } from "./repl.js";
// import { checkForUpdates, startFirmwareUpdate, startFPGAUpdate } from "./update.js"
// import { startNordicDFU } from "./nordicdfu.js"

// const replPlaceHolderText =
//     "Welcome to the MicroPython Web Bluetooth REPL.\n\n" +
//     "Make sure you're using either Chrome Desktop, Android Chrome, or iOS Bluefy.\n\n" +
//     "Report bugs and check out the source code here: https://github.com/siliconwitchery/web-bluetooth-repl\n\n\n" +
//     "Hit any key to connect!";

// window.addEventListener("load", () => {
//     replConsole.value = replPlaceHolderText;
// });

// const infoText = document.getElementById('infoText');
// const replConsole = document.getElementById('replConsole');
// const fpgaUpdateButton = document.getElementById('fpgaUpdateButton');
// const ctrlAButton = document.getElementById('ctrlAButton');
// const ctrlBButton = document.getElementById('ctrlBButton');
// const ctrlCButton = document.getElementById('ctrlCButton');
// const ctrlDButton = document.getElementById('ctrlDButton');
// const ctrlEButton = document.getElementById('ctrlEButton');
// const clearButton = document.getElementById('clearButton');

// export async function ensureConnected() {

//     if (isConnected() === true) {
//         return;
//     }

//     try {
//         let connectionResult = await connect();

//         if (connectionResult === "dfu connected") {
//             infoText.innerHTML = "Starting firmware update..";
//             await startNordicDFU()
//                 .catch(() => {
//                     disconnect();
//                     throw ("Bluetooth error. Reconnect or check console for details");
//                 });
//             disconnect();
//         }

//         if (connectionResult === "repl connected") {
//             infoText.innerHTML = "Connected";
//             replResetConsole();

//             let updateInfo = await checkForUpdates();
//             if (updateInfo != "") {
//                 infoText.innerHTML = updateInfo + " Click <a href='#' " +
//                     "onclick='update();return false;'>" +
//                     "here</a> to update.";
//             }
//         }
//     }

//     catch (error) {
//         // Ignore User cancelled errors
//         if (error.message && error.message.includes("cancelled")) {
//             return;
//         }
//         infoText.innerHTML = error;
//         console.error(error);
//     }
// }

export function onDisconnect() {
    console.log("disconnected");
    // if (infoText.innerHTML.includes("Reconnect")) {
    //     return;
    // }
    // infoText.innerHTML = "Disconnected";
}

// // Always keep the test area focused when pressing buttons
// setInterval(function () {
//     replFocusCursor();
// }, 1000);

// ctrlAButton.addEventListener('click', () => {
//     replHandleKeyPress("a", true, false);
// });

// ctrlBButton.addEventListener('click', () => {
//     replHandleKeyPress("b", true, false);
// });

// ctrlCButton.addEventListener('click', () => {
//     replHandleKeyPress("c", true, false);
// });

// ctrlDButton.addEventListener('click', () => {
//     replHandleKeyPress("d", true, false);
// });

// ctrlEButton.addEventListener('click', () => {
//     replHandleKeyPress("e", true, false);
// });

// clearButton.addEventListener('click', () => {
//     replHandleKeyPress("k", false, true);
// });

// fpgaUpdateButton.addEventListener('click', () => {
//     startFPGAUpdate();
// });

// window.update = () => {
//     infoText.innerHTML = "Reconnect to the DFU device to begin the update.";
//     startFirmwareUpdate();
// }

// export function reportUpdatePercentage(percentage) {
//     infoText.innerHTML = "Updating " + percentage + "%..";
// }
// connect()
// TODO
export function receiveRawData(event:any) {
    console.log(event.target.value);
}