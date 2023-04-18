// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as vscode from 'vscode';
import * as fs from 'fs'; // In NodeJS: 'const fs = require('fs')'

import { isConnected,disconnect } from './bluetooth';
import {ensureConnected,replSend,sendFileUpdate,triggerFpgaUpdate} from './repl';
import {ProjectProvider, GitOperation, cloneAndOpenRepo} from './projects';
import { DepNodeProvider } from './snippets/provider';
// import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
// import { FileExplorer } from './fileExplorer';
const util = require('util');
const encoder = new util.TextEncoder('utf-8');
import { DeviceFs } from './fileSystemProvider';
const monocleFolder = "device files";
let statusBarItemBle:vscode.StatusBarItem;

export const writeEmitter = new vscode.EventEmitter<string>();
const gitOper = new GitOperation();
export const myscheme = "monocle";
export var outputChannel:vscode.OutputChannel;

class FpgaButton extends vscode.TreeItem {

	constructor(
	) {
		super("FPGA Upload");

		this.tooltip = `FPGA Upload`;
		this.collapsibleState = vscode.TreeItemCollapsibleState.None;
		this.command = {
			title: "Update FPGA",
			tooltip: "Update FPGA from Brilliant AR Studio or Custom",
			command: "brilliant-ar-studio.fpgaUpdate",
		  };
	}


	contextValue = 'fpga';
}
const isPathExist = async (uri:vscode.Uri):Promise<boolean>=>{
	let exist = fs.existsSync(uri.fsPath);
	return exist;
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
function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
export const updatePublishStatus = async ()=>{
	const gitExtension1 = vscode.extensions.getExtension('vscode.git');
	if(gitExtension1){
		const git = gitExtension1.exports.getAPI(1);
		if(git && git.repositories.length>0 && git.repositories[0].repository.remotes.length>0){
			let pushUrl = git.repositories[0].repository.remotes[0].pushUrl;
			if(await gitOper.checkPublisStatus(pushUrl)){
				vscode.commands.executeCommand('setContext', 'monocle.published', true);
			}else{
				vscode.commands.executeCommand('setContext', 'monocle.published', false);
			};
		}
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


export async function activate(context: vscode.ExtensionContext) {
	// const provider = new ContentProvider();
	var currentSyncPath:vscode.Uri|null = null;

	const memFs = new DeviceFs();
	context.subscriptions.push(vscode.window.createTreeView('fileExplorer', { treeDataProvider:memFs }));
	// let fileSubs = vscode.workspace.registerFileSystemProvider(myscheme, memFs, { isCaseSensitive: true });
	// register content provider for scheme `references`
	// vscode.commands.executeCommand('')
	async function startSyncing(){
		if(vscode.workspace.workspaceFolders){
			let rootUri = vscode.workspace.workspaceFolders[0].uri;
			const projectFiles = new vscode.RelativePattern(rootUri, monocleFolder+'/*.py');
			let filesFound = await vscode.workspace.findFiles(projectFiles);
			if(filesFound.length===0){
				// let newPathPy = vscode.Uri.joinPath(rootUri,monocleFolder+'/main.py');
				// let newPathReadMe = vscode.Uri.joinPath(rootUri,'./README.md');
				// initFiles(rootUri,vscode.workspace.workspaceFolders[0].name);
				return;
			}
			currentSyncPath = vscode.Uri.joinPath(rootUri,monocleFolder+"/");
			vscode.commands.executeCommand('setContext', 'monocle.sync', true);
		}
		
	}
	statusBarItemBle = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	const nodeDependenciesProvider = new DepNodeProvider("rootPath");
	const projectProvider =  new ProjectProvider();

	const thisProvider={
        resolveWebviewView:function(thisWebview:any, thisWebviewContext:any, thisToken:any){
            thisWebview.webview.options={enableScripts:true};
			const scriptUri = thisWebview.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'main.js'));
			const nonce = getNonce();
            thisWebview.webview.html=`<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				
				<title>Cat Colors</title>
			</head>
			<body>
				<ul class="color-list">
				</ul>
				<button class="scann">Add Color</button>
		
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
        }
    };
    // context.subscriptions.push(
    //     vscode.window.registerWebviewViewProvider("projects", thisProvider)
    // );
	vscode.window.registerTreeDataProvider("fpga",{
		getChildren(element?:vscode.TreeItem):vscode.TreeItem[]{
			return [];
			
		},
		getTreeItem(element:vscode.TreeItem):vscode.TreeItem{
			return element;
		}
	});
	vscode.window.registerTreeDataProvider('snippetTemplates', nodeDependenciesProvider);
	vscode.window.registerTreeDataProvider('projects',projectProvider);
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
	
		
	const fsWatcher = vscode.workspace.createFileSystemWatcher("**",true,false,true);
	
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
		vscode.workspace.onDidRenameFiles((e:vscode.FileRenameEvent)=>{
			console.log(e);
			e.files.forEach((e)=>{
				if(currentSyncPath!==null &&  e.newUri.fsPath.includes(currentSyncPath.fsPath)){
					let newDevicePath =  e.newUri.fsPath.replace(currentSyncPath?.fsPath, "").replaceAll("\\","/");
					let oldDevicePath =  e.oldUri.fsPath.replace(currentSyncPath?.fsPath, "").replaceAll("\\","/");
					
					memFs.renameFile(oldDevicePath,newDevicePath);
				}
			});
		}),
		vscode.workspace.onDidCreateFiles((e:vscode.FileCreateEvent)=>{
			e.files.forEach((e:vscode.Uri)=>{
				if(currentSyncPath!==null && e.fsPath.includes(currentSyncPath.fsPath)){
					let devicePath = e.fsPath.replace(currentSyncPath?.fsPath, "").replaceAll("\\","/");
					memFs.addFile(e,devicePath);
				}
			});
			
		}),
		vscode.workspace.onDidDeleteFiles((e:vscode.FileDeleteEvent)=>{
			e.files.forEach((e:vscode.Uri)=>{
				if(currentSyncPath!==null && e.fsPath.includes(currentSyncPath.fsPath)){
					let devicePath = e.fsPath.replace(currentSyncPath?.fsPath, "").replaceAll("\\","/");;
					memFs.deleteFile(devicePath);
				}
			});
			
		}),
		fsWatcher.onDidChange((e)=>{
			if(currentSyncPath!==null && e.path.includes(currentSyncPath.path)){
				let devicePath = e.fsPath.replace(currentSyncPath?.fsPath, "").replaceAll("\\","/");;
				memFs.addFile(e,devicePath);
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
		vscode.workspace.registerTextDocumentContentProvider(myscheme, memFs),
		vscode.commands.registerCommand('brilliant-ar-studio.refreshDeviceFiles', async (thiscontext) => {
			memFs.refresh();
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.openDeviceFile', async (thiscontext) => {
			if(vscode.workspace.workspaceFolders){
				let rootUri = vscode.workspace.workspaceFolders[0].uri;
				let projectPath = vscode.Uri.joinPath(rootUri,monocleFolder);
				if(await isPathExist(projectPath)){
					let localPath = vscode.Uri.joinPath(rootUri,monocleFolder,thiscontext?.path);
					if(await isPathExist(localPath)){
						let doc = await vscode.workspace.openTextDocument(localPath);
						await vscode.window.showTextDocument(doc);
						return;
					}else{
						vscode.workspace.fs.writeFile(localPath,Buffer.from(await memFs.readFile(thiscontext?.path)));
						let doc = await vscode.workspace.openTextDocument(localPath);
						await vscode.window.showTextDocument(doc);
						return;
					}
				}else{
					vscode.window.showWarningMessage("Project not Initialized");
				}
			}
			let localPath = vscode.Uri.parse(myscheme+':' + thiscontext?.path);
			let doc = await vscode.workspace.openTextDocument(localPath);
			await vscode.window.showTextDocument(doc);
			
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.fpgaUpdate', async (thiscontext) => {
			let resp = await vscode.window.showQuickPick(["Update Custom firmware","Update from Brilliant Monocle"]);
			if(!resp){return;}
			if(resp==="Update Custom firmware"){
				let binFile = await vscode.window.showOpenDialog({canSelectFiles:true,canSelectFolders:false,canSelectMany:false,filters:{bin: ["bin"]}});
				if(binFile && binFile.length>0){
					currentSyncPath = null;
				vscode.commands.executeCommand('setContext', 'monocle.sync', false);
				await triggerFpgaUpdate(binFile[0]);
				}
			}
			if(resp==="Update from Brilliant Monocle"){
				currentSyncPath = null;
				vscode.commands.executeCommand('setContext', 'monocle.sync', false);
				await triggerFpgaUpdate();
			}
			
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.syncStop', async (thiscontext) => {
			currentSyncPath = null;
			vscode.commands.executeCommand('setContext', 'monocle.sync', false);
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.setDeviceLocalPath', async (thiscontext) => {
			currentSyncPath = null;
			vscode.commands.executeCommand('setContext', 'monocle.sync', false);
			let projectName = await vscode.window.showInputBox({title:"Enter Project Name",placeHolder:"MonocleApp"});
			if(projectName && projectName.trim()!==''){
				let selectedPath = await vscode.window.showOpenDialog({canSelectFolders:true,canSelectFiles:false,canSelectMany:false,title:"Select project path"});
				if(selectedPath && projectName){
					let workspacePath = vscode.Uri.joinPath(selectedPath[0],projectName);
					if((await vscode.workspace.findFiles(new vscode.RelativePattern(workspacePath,''))).length===0){
						await vscode.workspace.fs.createDirectory(workspacePath);
						await initFiles(workspacePath,projectName);
						// vscode.workspace.
						vscode.commands.executeCommand('vscode.openFolder', workspacePath);
						// vscode.workspace.updateWorkspaceFolders(0,null,{uri:workspacePath,name:projectName});
					
					}else{
						vscode.window.showErrorMessage("Directory exist, open if you want to use existing directory");
					}
				}
				
			}
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.getPublicApps',  (thiscontext) => {
			 projectProvider.refresh();
	   
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.UnPublishMonocleApp',  (thiscontext) => {
			const gitExtension1 = vscode.extensions.getExtension('vscode.git');
			if(gitExtension1){
				const git = gitExtension1.exports.getAPI(1);
				if(git.repositories && git.repositories.length>0 && git.repositories[0].repository.remotes.length>0){
					let pushUrl = git.repositories[0].repository.remotes[0].pushUrl;
					gitOper.publishProject(pushUrl,true);
					vscode.commands.executeCommand('setContext', 'monocle.published', false);
					projectProvider.refresh();
				}else{
					vscode.window.showErrorMessage('Not set remote repository');
				}
			}
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.forkProject',  async (thiscontext) => {
			let cloneurl = thiscontext.cloneurl;
			let ownerRepo = gitOper.getOwnerRepo(cloneurl);
			// let ownerRepo = cloneurl.replace('https://github.com/','').replace('.git','').split('/');
			let projectName = await vscode.window.showInputBox({title:"Project Name",placeHolder:ownerRepo.repo});
			if(!projectName){return;}
			let selectedPath = await vscode.window.showOpenDialog({canSelectFolders:true,canSelectFiles:false,canSelectMany:false,title:"Select project path"});
			
			if(selectedPath){
				let newPath = vscode.Uri.joinPath(selectedPath[0],projectName);
				let newRepo = await gitOper.createFork(cloneurl,projectName);
				if(newRepo){
					cloneAndOpenRepo(newRepo.data.clone_url,newPath);
				}
			}
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.copyProject', async (thiscontext) => {
			let localPath = await vscode.window.showOpenDialog({canSelectFiles:false,canSelectMany:false,canSelectFolders:true,title:"Select folder to open in local"});
			if(localPath){
				if(localPath && localPath.length>=0){
					await gitOper.getArchiveZip(thiscontext.cloneurl,localPath[0]);
				}
			}
			
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.publishMonocleApp',  (thiscontext) => {
			const gitExtension1 = vscode.extensions.getExtension('vscode.git');
			if(gitExtension1){
				const git = gitExtension1.exports.getAPI(1);

				if(!vscode.workspace.workspaceFolders){
					// open workspace
					// git.init(vscode.workspace.workspaceFolders[0].uri);
					vscode.window.showErrorMessage('Worspace not set');
					return;
				}
				let monocleFilesUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri,monocleFolder+"/*.py");
				if(! isPathExist(monocleFilesUri)){
					// initialized folder
					vscode.window.showWarningMessage("No project setup");
					return;
					// initFiles(vscode.workspace.workspaceFolders[0].uri,vscode.workspace.workspaceFolders[0].name);
				}
				if(git.repositories && git.repositories.length===0){
					git.init(vscode.workspace.workspaceFolders[0].uri);
					git.publishRepository();
					return;
				}
				
				if(git.repositories[0].repository.remotes.length>0){
					let pushUrl = git.repositories[0].repository.remotes[0].pushUrl;
					gitOper.publishProject(pushUrl);
					vscode.commands.executeCommand('setContext', 'monocle.published', true);
					projectProvider.refresh();
				}else{
					vscode.window.showErrorMessage('Not set remote repository');
				}
				return;
				// console.log(git);
			}
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.syncFiles', async (thiscontext) => {
			// launch.json configuration
			if(vscode.workspace.workspaceFolders){
				await startSyncing();
				 
			}else{
				// let pickOptions = vscode.
				// let newOpenexisting = 
				// let choice = await vscode.window
				let projectName = await vscode.window.showInputBox({title:"Enter Project Name",placeHolder:"MonocleApp"});
				if(projectName && projectName.trim()!==''){
					let selectedPath = await vscode.window.showOpenDialog({canSelectFolders:true,canSelectFiles:false,canSelectMany:false,title:"Select project path"});
					if(selectedPath && projectName){
						let workspacePath = vscode.Uri.joinPath(selectedPath[0],projectName);
						if((await vscode.workspace.findFiles(new vscode.RelativePattern(workspacePath,''))).length===0){
							await vscode.workspace.fs.createDirectory(workspacePath);
							await initFiles(workspacePath,projectName);
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
			// navigator.bluetooth.requestDevice({"acceptAllDevices":true});
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			if(!isConnected()){
				// await vscode.commands.executeCommand('brilliant-ar-studio.syncFiles');
				if(vscode.workspace.workspaceFolders){
					await startSyncing();
					selectTerminal().then();
				}else{
					selectTerminal().then();
				}
			}
			
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.disconnect', async () => {
			
			disconnect();
			vscode.commands.executeCommand('brilliant-ar-studio.syncStop');
			
		}),
	);
	context.subscriptions.push(alldisposables);
	context.subscriptions.push(statusBarItemBle);
	// context.subscriptions.push(fileSubs);

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
		statusBarItemBle.command = "brilliant-ar-studio.disconnect";
		statusBarItemBle.backgroundColor = "";
		statusBarItemBle.text = msg;
	}else if(status==="progress"){
		statusBarItemBle.command = "";
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
