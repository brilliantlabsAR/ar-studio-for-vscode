// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { rejects } from 'assert';
import { resolve } from 'path';
import * as vscode from 'vscode';
import { connect } from './bluetooth';
import { DepNodeProvider, Dependency } from './fileExplorer';
// import {startScan, initializeListners} from './bluetooth';

var bluetooth = require('./ble/index').webbluetooth;

function selectTerminal(): Thenable<vscode.Terminal | undefined> {
	interface TerminalQuickPickItem extends vscode.QuickPickItem {
		terminal: vscode.Terminal;
	}
	let terminals = <vscode.Terminal[]>(<any>vscode.window).terminals;
	if(terminals.length===0){
		vscode.window.createTerminal({
			name: `Monocle`
		} as any);
	  terminals = <vscode.Terminal[]>(<any>vscode.window).terminals;

	}

	return new Promise((resolve,reject)=>{
		resolve(terminals[0]);
	});
	// return vscode.window.showQuickPick(items).then(item => {
	// 	return item ? item.terminal : undefined;
	// });
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// initializeListners();
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "brilliant-ar-studio" is now active!');
	
	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
	? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

	// Samples of `window.registerTreeDataProvider`
	const nodeDependenciesProvider = new DepNodeProvider(rootPath);
	vscode.window.registerTreeDataProvider('deviceFiles', nodeDependenciesProvider);
	vscode.commands.registerCommand('deviceFiles.refreshEntry', () => nodeDependenciesProvider.refresh());
	vscode.commands.registerCommand('extension.openPackageOnNpm', moduleName => vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`https://www.npmjs.com/package/${moduleName}`)));
	vscode.window.createTreeView('deviceFiles', {
		treeDataProvider: new DepNodeProvider(rootPath)
	  });
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('brilliant-ar-studio.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		
		vscode.window.showInformationMessage('Hello World from Brilliant AR Studio!');
	});
	
	let disposable2 = vscode.commands.registerCommand('brilliant-ar-studio.connect', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		
		connect(bluetooth).then(msg=>{
			selectTerminal().then(terminal => {
				if (terminal) {
					// terminal.sendText(msg);
				}
			});
		}).catch(console.log);
	});
	
	context.subscriptions.push(disposable);
	context.subscriptions.push(disposable2);
}

// This method is called when your extension is deactivated
export function deactivate() {}
