// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { rejects } from 'assert';
import { resolve } from 'path';
import * as vscode from 'vscode';
import { connect,replDataTxQueue,isConnected,disconnect } from './bluetooth';
import { DepNodeProvider, Dependency } from './fileExplorer';
import ContentProvider, { encodeLocation } from './provider';
// import {startScan, initializeListners} from './bluetooth';
const util = require('util');
const encoder = new util.TextEncoder('utf-8');
import { DeviceFs } from './fileSystemProvider';
var bluetooth = require('./ble/index').webbluetooth;
let statusBarItemBle:vscode.StatusBarItem;

export function replHandleResponse(string:string) {
    writeEmitter.fire(string);
}

export function onDisconnect() {
    updateStatusBarItem("disconnected");
	writeEmitter.fire("Disconnected \r\n");
}
export const writeEmitter = new vscode.EventEmitter<string>();

function selectTerminal(): Thenable<vscode.Terminal | undefined> {
	let allTerminals = vscode.window.terminals.filter(ter=>ter.name==='REPL');
	if(allTerminals.length>0){
	return new Promise((resolve,reject)=>{
		allTerminals[0].show();
		resolve(allTerminals[0]);
	});
	}
	const pty = {
		onDidWrite: writeEmitter.event,
		open: () => writeEmitter.fire('Monocle \r\n'),
		close: () => { /* noop*/ },
		handleInput: (data: string) => {
			
    		replDataTxQueue.push.apply(replDataTxQueue, encoder.encode(data));

		}
	};
	const terminal = vscode.window.createTerminal({ name: `REPL`, pty });
	
	return new Promise((resolve,reject)=>{
		terminal.show();
		resolve(terminal);
	});
	// return vscode.window.showQuickPick(items).then(item => {
	// 	return item ? item.terminal : undefined;
	// });
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const provider = new ContentProvider();

	const myscheme = "monocle";
	// register content provider for scheme `references`
	// register document link provider for scheme `references`
	statusBarItemBle = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItemBle.command = "brilliant-ar-studio.connect";
	statusBarItemBle.show();
	updateStatusBarItem("disconnected");
	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
	? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
	const memFs = new DeviceFs();
	// Samples of `window.registerTreeDataProvider`
	const nodeDependenciesProvider = new DepNodeProvider(rootPath);
	console.log('Congratulations, your extension "brilliant-ar-studio" is now active!');

	// vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse(myscheme+':/'), name: myscheme });
	const alldisposables = vscode.Disposable.from(
	vscode.workspace.registerTextDocumentContentProvider(myscheme, provider),
	vscode.workspace.registerFileSystemProvider(myscheme, memFs, { isCaseSensitive: true }),
	
	
	vscode.window.registerTreeDataProvider('deviceFiles', nodeDependenciesProvider),
	vscode.commands.registerCommand('deviceFiles.refreshEntry', () => nodeDependenciesProvider.refresh()),
	
	vscode.commands.registerCommand('deviceFiles.editEntry', async (context) => {
		// console.log(context);
		const uri = vscode.Uri.parse(`${myscheme}:/file.txt`);
		const doc = await vscode.workspace.openTextDocument(uri); // calls back into the provider
		await vscode.window.showTextDocument(doc, { preview: false });
	}),
	
	vscode.window.createTreeView('deviceFiles', {
		treeDataProvider: new DepNodeProvider(rootPath)
	  }),
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	vscode.commands.registerCommand('brilliant-ar-studio.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		
		vscode.window.showInformationMessage('Hello World from Brilliant AR Studio!');
	}),
	
	 vscode.commands.registerCommand('brilliant-ar-studio.connect', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		if(!isConnected()){
			updateStatusBarItem("progress");
			selectTerminal().then(terminal => {
				connect(bluetooth).then(msg=>{
					writeEmitter.fire("Connected\r\n");
					updateStatusBarItem("connected");
					vscode.window.showInformationMessage("Monocle Connected");
				}).catch(err=>{
					updateStatusBarItem("Disconnected");
					vscode.window.showErrorMessage(err);
				});
			});
		}else{
			disconnect();
			vscode.window.showWarningMessage("Monocle Disconnected");
		}
		
		
	}),
	);
	// context.subscriptions.push(disposable);
	// context.subscriptions.push(commandRegistration);
	context.subscriptions.push(alldisposables);
	// context.subscriptions.push(disposable2);
	let initialized = false;

	context.subscriptions.push(vscode.commands.registerCommand('memfs.reset', _ => {
		for (const [name] of memFs.readDirectory(vscode.Uri.parse('memfs:/'))) {
			// memFs.delete(vscode.Uri.parse(`${myscheme}:/${name}`));
		}
		initialized = false;
	}));

	context.subscriptions.push(vscode.commands.registerCommand('deviceFiles.addFile', async _ => {
	
		if (!initialized) {
			vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length:0, null, { uri: vscode.Uri.parse(myscheme+':/'), name: myscheme });
			
		}
		initialized =true;
		const uri = vscode.Uri.parse(`${myscheme}:/file.py`);
			memFs.writeFile(uri, Buffer.from('import base64, sys; base64.decode(open(sys.argv[1], "rb"), open(sys.argv[2], "wb"))'), { create: true, overwrite: true });
		
			const doc = await vscode.workspace.openTextDocument(uri); // calls back into the provider
		await vscode.window.showTextDocument(doc, { preview: false });
		

		// const doc = await vscode.workspace.openTextDocument(uri); // calls back into the provider
		// await vscode.window.showTextDocument(doc, { preview: false });
	}));

	context.subscriptions.push(vscode.commands.registerCommand('memfs.deleteFile', _ => {
		if (initialized) {
			memFs.delete(vscode.Uri.parse(`${myscheme}:/file.txt`));
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('memfs.init', _ => {
		if (initialized) {
			return;
		}
		initialized = true;
		// most common files types
		memFs.writeFile(vscode.Uri.parse(`memfs:/file.txt`), Buffer.from('foo'), { create: true, overwrite: true });


		memFs.writeFile(vscode.Uri.parse(`memfs:/folder/empty.txt`), new Uint8Array(0), { create: true, overwrite: true });
	}));

	context.subscriptions.push(vscode.commands.registerCommand('memfs.workspaceInit', _ => {
		vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse('memfs:/'), name: "MemFS - Sample" });
	}));
	context.subscriptions.push(statusBarItemBle);
}

function updateStatusBarItem(status:string,msg:string="Monocle",): void {

	statusBarItemBle.text = `${msg}`;
	let bgColorWarning = new vscode.ThemeColor('statusBarItem.warningBackground');
	let bgColorError = new vscode.ThemeColor('statusBarItem.errorBackground');
	if(status==="connected"){
		// statusBarItemBle.color = "#13f81a";
		statusBarItemBle.tooltip = "Connected";
		statusBarItemBle.backgroundColor = "";
		statusBarItemBle.text = msg;
	}else if(status==="progress"){
		statusBarItemBle.text = "$(sync~spin) "+msg;
		statusBarItemBle.backgroundColor = bgColorWarning;
		statusBarItemBle.tooltip = "Connecting";
	}else{
		statusBarItemBle.tooltip = "Disconncted";
		// statusBarItemBle.color = "#D90404";
		statusBarItemBle.backgroundColor =  bgColorError
		statusBarItemBle.text = "$(debug-disconnect) "+msg;
	}
	statusBarItemBle.show();
}

// This method is called when your extension is deactivated
export function deactivate() {}
