// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as vscode from 'vscode';
import { isConnected,disconnect } from './bluetooth';
import {ensureConnected,replSend,sendFileUpdate,triggerFpgaUpdate} from './repl';
import {getRepoList,ProjectProvider} from './projects';
import { DepNodeProvider } from './snippets/provider';
// import { FileExplorer } from './fileExplorer';
const util = require('util');
const encoder = new util.TextEncoder('utf-8');
import { DeviceFs } from './fileSystemProvider';
const monocleFolder = "monocleFiles";
let statusBarItemBle:vscode.StatusBarItem;

export const writeEmitter = new vscode.EventEmitter<string>();
export const myscheme = "monocle";
export var outputChannel:vscode.OutputChannel;

const isPathExist = async (uri:vscode.Uri):Promise<boolean>=>{
	let files = await vscode.workspace.findFiles(new vscode.RelativePattern(uri,''));
return files.length!==0;
};
const initFiles = async (rootUri:vscode.Uri,projectName:string) => {
	let monocleUri = vscode.Uri.joinPath(rootUri,monocleFolder+'/main.py');
	let readmeUri = vscode.Uri.joinPath(rootUri,'./README.md');
	if(! await isPathExist(monocleUri)){
		vscode.workspace.fs.writeFile(monocleUri,Buffer.from("print(\"Hello Monocle from "+projectName+"!\")"));
	}
	if(! await isPathExist(readmeUri)){
		vscode.workspace.fs.writeFile(readmeUri,Buffer.from("###  "+projectName));
	}
};
function selectTerminal(): Thenable<vscode.Terminal | undefined> {
	let allTerminals = vscode.window.terminals.filter(ter=>ter.name==='REPL');
	
	if(allTerminals.length>0){
		
	return new Promise(async(resolve,reject)=>{
		allTerminals[0].show();
		await ensureConnected();
		resolve(allTerminals[0]);
		
	});
	}
	const pty = {
		onDidWrite: writeEmitter.event,
		open: async () => await ensureConnected(),
		close: () => { /* noop*/ },
		handleInput: (data: string) => {
			// console.log(data);
			replSend(data);

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
	// const provider = new ContentProvider();
	var currentSyncPath:vscode.Uri|null = null;
	const memFs = new DeviceFs();
	context.subscriptions.push(vscode.window.createTreeView('fileExplorer', { treeDataProvider:memFs }));
	// let fileSubs = vscode.workspace.registerFileSystemProvider(myscheme, memFs, { isCaseSensitive: true });
	// register content provider for scheme `references`
	// vscode.commands.executeCommand('')
	// register document link provider for scheme `references`
	statusBarItemBle = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	const nodeDependenciesProvider = new DepNodeProvider("rootPath");
	const projectProvider = new ProjectProvider();
	vscode.window.registerTreeDataProvider('snippetTemplates', nodeDependenciesProvider);
	vscode.window.registerTreeDataProvider('projects', projectProvider);
	
	outputChannel = vscode.window.createOutputChannel("RAW-REPL","python"); 
	outputChannel.clear();
	statusBarItemBle.command = "brilliant-ar-studio.connect";
	statusBarItemBle.show();
	if(isConnected()){
		updateStatusBarItem("connected");
	}else{
		updateStatusBarItem("disconnected");

	}
	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
	? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;


	const fsWatcher = vscode.workspace.createFileSystemWatcher("**");
	
	// vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse(myscheme+':/'), name: myscheme });
	const alldisposables = vscode.Disposable.from(

		vscode.languages.registerDocumentDropEditProvider('python', {
			provideDocumentDropEdits(document, position, dataTransfer, token) {
				let itemValue:any;
				let item = dataTransfer.get("application/vnd.code.tree.snippettemplates");
				if(item){
					let jumbledSnippet = JSON.parse(item.value)?.itemHandles[0];
					if(jumbledSnippet.includes("snippet_")){
						let cmd = { langId: "python", name: jumbledSnippet?.slice(jumbledSnippet.indexOf("snippet_")+8) };
						vscode.commands.executeCommand('editor.action.insertSnippet',cmd);
					}
				
					return null;
				}
		  },
		}),
		fsWatcher.onDidCreate((e)=>{
			if(currentSyncPath!==null && e.fsPath.includes(currentSyncPath.fsPath)){
				let devicePath = e.fsPath.replace(currentSyncPath?.fsPath, "").replaceAll("\\","/");
				memFs.addFile(e,devicePath);
			}
		}),
		fsWatcher.onDidChange((e)=>{
			if(currentSyncPath!==null && e.path.includes(currentSyncPath.path)){
				let devicePath = e.fsPath.replace(currentSyncPath?.fsPath, "").replaceAll("\\","/");;
				memFs.updateFile(e,devicePath);
			}
		
		}),
		fsWatcher.onDidDelete((e)=>{
			if(currentSyncPath!==null && e.fsPath.includes(currentSyncPath.fsPath)){
				let devicePath = e.fsPath.replace(currentSyncPath?.fsPath, "").replaceAll("\\","/");;
				memFs.deleteFile(devicePath);
			}
		}),
	
		vscode.window.createTreeView('snippetTemplates', {
			treeDataProvider: new DepNodeProvider(rootPath),
			dragAndDropController: new DepNodeProvider(rootPath)
		}),

		vscode.commands.registerCommand('brilliant-ar-studio.runFile', async (thiscontext) => {
			let fileData = await vscode.workspace.fs.readFile(vscode.Uri.parse(thiscontext.path));
				if(fileData.byteLength!==0){
					sendFileUpdate(fileData);
				}
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.fpgaUpdate', async (thiscontext) => {
			let oper = await vscode.window.showQuickPick(
				[{label:"Update from Brilliants",target:"NORMAL"},{label:"Select Binary",target:"CUSTOM"}],
				{ title: "Select Source" }
			  );
			
			if(oper?.target==="NORMAL"){
				vscode.commands.executeCommand('setContext', 'monocle.sync', false);
				currentSyncPath = null;
				await triggerFpgaUpdate();
			}
			if(oper?.target==="CUSTOM"){
				let success = await vscode.window.showOpenDialog({filters:{fpga:["bin"]},openLabel:"Select FPGA binary file",canSelectFiles:true,canSelectMany:false,canSelectFolders:false});
				if(success?.[0].path.endsWith(".bin")){
					vscode.commands.executeCommand('setContext', 'monocle.sync', false);
					currentSyncPath = null;
					await triggerFpgaUpdate(success?.[0]);
				}
				
			}
			
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.syncStop', async (thiscontext) => {
			currentSyncPath = null;
			vscode.commands.executeCommand('setContext', 'monocle.sync', false);
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.getPublicApps', async (thiscontext) => {
			projectProvider.refresh();
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.syncFiles', async (thiscontext) => {
			// launch.json configuration
			if(vscode.workspace.workspaceFolders){
				let rootUri = vscode.workspace.workspaceFolders[0].uri;
				const projectFiles = new vscode.RelativePattern(rootUri, monocleFolder+'/*.py');
				let filesFound = await vscode.workspace.findFiles(projectFiles);
				if(filesFound.length===0){
					// let newPathPy = vscode.Uri.joinPath(rootUri,monocleFolder+'/main.py');
					// let newPathReadMe = vscode.Uri.joinPath(rootUri,'./README.md');
					initFiles(rootUri,vscode.workspace.workspaceFolders[0].name);
				}
				currentSyncPath = vscode.Uri.joinPath(rootUri,monocleFolder);
				vscode.commands.executeCommand('setContext', 'monocle.sync', true);
				 
			}else{
				// let pickOptions = vscode.
				let projectName = await vscode.window.showInputBox({title:"Enter Project Name",placeHolder:"MonocleApp"});
				if(projectName && projectName.trim()!==''){
					let selectedPath = await vscode.window.showOpenDialog({canSelectFolders:true,canSelectFiles:false,canSelectMany:false,title:"Select project path"});
					if(selectedPath && projectName){
						let workspacePath = vscode.Uri.joinPath(selectedPath[0],projectName);
						if((await vscode.workspace.findFiles(new vscode.RelativePattern(workspacePath,''))).length===0){
							vscode.workspace.fs.createDirectory(workspacePath);
							initFiles(workspacePath,projectName);
							// vscode.workspace.
							vscode.commands.executeCommand('vscode.openFolder', workspacePath);
							// vscode.workspace.updateWorkspaceFolders(0,null,{uri:workspacePath,name:projectName});
						
						}else{
							vscode.window.showErrorMessage("Directory exist, open if you want to use existing directory")
						}
					}
					
				}
			}
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.connect', async () => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			if(!isConnected()){
				selectTerminal().then();
			}else{
				disconnect();
				// vscode.window.showWarningMessage("Monocle Disconnected");
			}
			
		}),
	);
	context.subscriptions.push(alldisposables);
	context.subscriptions.push(statusBarItemBle);
	// context.subscriptions.push(fileSubs);
	console.log('Congratulations, your extension "brilliant-ar-studio" is now active!');

	// new FileExplorer(context);
}

export function updateStatusBarItem(status:string,msg:string="Monocle",): void {

	statusBarItemBle.text = `${msg}`;
	let bgColorWarning = new vscode.ThemeColor('statusBarItem.warningBackground');
	let bgColorError = new vscode.ThemeColor('statusBarItem.errorBackground');
	statusBarItemBle.command = "brilliant-ar-studio.connect";
	if(status==="connected"){
		// statusBarItemBle.color = "#13f81a";
		statusBarItemBle.tooltip = "Connected";
		statusBarItemBle.backgroundColor = "";
		statusBarItemBle.text = msg;
	}else if(status==="progress"){
		statusBarItemBle.text = "$(sync~spin) "+msg;
		statusBarItemBle.backgroundColor = bgColorWarning;
		statusBarItemBle.tooltip = "Connecting";
	}else if(status==="updating"){
		statusBarItemBle.tooltip = "Updating firmware";
		// statusBarItemBle.color = "#D90404";
		statusBarItemBle.backgroundColor =  bgColorWarning;
		statusBarItemBle.text = "$(cloud-download) Updating "+msg+"%";
		statusBarItemBle.command = "";
	
	}else{
		statusBarItemBle.tooltip = "Disconncted";
		// statusBarItemBle.color = "#D90404";
		statusBarItemBle.backgroundColor =  bgColorError;
		statusBarItemBle.text = "$(debug-disconnect) "+msg;
	}
	statusBarItemBle.show();
	
}

// This method is called when your extension is deactivated
export function deactivate() {}
