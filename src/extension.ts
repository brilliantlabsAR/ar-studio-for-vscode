// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as vscode from 'vscode';
import * as fs from 'fs'; // In NodeJS: 'const fs = require('fs')'
import * as path from 'path';
import { isConnected,disconnect,sendRawData } from './bluetooth';
import {ensureConnected,terminalHandleInput,sendFileUpdate,triggerFpgaUpdate,replRawModeEnabled,colorText, FileMaps} from './repl';
import {ProjectProvider, GitOperation, cloneAndOpenRepo} from './projects';
import { SnippetProvider } from './snippets/provider';
import { UIEditorPanel } from "./UIEditorPanel";
import {snippets} from "./snippets";
const util = require('util');
const encoder = new util.TextEncoder('utf-8');
const decoder = new util.TextDecoder('utf-8');
import { DeviceFs, MonocleFile,ScreenProvider } from './fileSystemProvider';
export const monocleFolder = "device files";
export const monocleFiles = '.brilliant/device-files.json';
export const screenFolder ="screens";
let statusBarItemBle:vscode.StatusBarItem;

export const writeEmitter = new vscode.EventEmitter<string>();
export const writeEmitterRaw = new vscode.EventEmitter<string>();
const gitOper = new GitOperation();
export const myscheme = "monocle";
export var outputChannel:vscode.OutputChannel;
// export var outputChannelData:vscode.OutputChannel;
export var deviceTreeProvider:vscode.TreeView<MonocleFile>;

export const isPathExist = async (uri:vscode.Uri):Promise<boolean>=>{
	let exist = fs.existsSync(uri.fsPath);
	return exist;
};

export const configReadUpdate = async  function(dataToupdate?:object):Promise<object>{
	let workspaces = vscode.workspace.workspaceFolders;
	let newdata:any = {};
	if(workspaces){
		
		let _configFile = vscode.Uri.joinPath(workspaces[0].uri,monocleFiles);
		if(!await isPathExist(_configFile)){
			await vscode.workspace.fs.writeFile(_configFile,Buffer.from(JSON.stringify({}, null, "\t")));
		}
	
		
		try {
			let data =  await vscode.workspace.fs.readFile(_configFile);
			let jsonData = JSON.parse(decoder.decode(data));
			newdata = {...jsonData};

		} catch (error) {
			
		}
		
		if(dataToupdate){
			newdata  = {...newdata,...dataToupdate};
			Object.keys(newdata).forEach(function(skey){
				if(newdata[skey]===false){
					delete newdata[skey];
				}
			});
			await vscode.workspace.fs.writeFile(_configFile,Buffer.from(JSON.stringify(newdata, null, "\t")));
		}
		return newdata;
		
	}
	return newdata;
	
};
// initialize main.py and README.md for new project
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

// check if github topic present or not for the project
export const updatePublishStatus = async ()=>{
	const gitExtension1 = vscode.extensions.getExtension('vscode.git');
	if(gitExtension1){
		if(vscode.workspace.workspaceFolders){
			let monocleFilesUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri,monocleFolder);
			if(! isPathExist(monocleFilesUri)){
				vscode.window.showErrorMessage('Empty project');
				return;
			};
		}
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
let prevByte = 0;
// create a terminal and start connect
function selectTerminal(): Thenable<vscode.Terminal | undefined> {
	let allTerminals = vscode.window.terminals.filter(ter=>ter.name==='REPL');
	
	if(allTerminals.length>0){
		
	return new Promise(async(resolve,reject)=>{
		// allTerminals[0].show();
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
			if(!replRawModeEnabled){
				let byteData = encoder.encode(data);
				if(byteData.length===1){
					
					switch (byteData[0]) {
						case 1:
							writeEmitter.fire(colorText('\r\nCtrl-A was pressed',3));
							break;
						case 2:
							writeEmitter.fire(colorText('\r\nCtrl-B was pressed',3));
							break;
						case 3:
							writeEmitter.fire(colorText('\r\nCtrl-C was pressed',3));
							break;
						case 4:
							writeEmitter.fire(colorText('\r\nCtrl-D was pressed. Press Ctrl-C to break',3));
							break;
						default:
							break;
					}
					prevByte = byteData[0];
				}
				terminalHandleInput(data);
			}else{
				vscode.window.showWarningMessage("Device Busy!");
			}

		}
	};
	const ptyRaw = {
		onDidWrite: writeEmitterRaw.event,
		open: async () => await ensureConnected(),
		close: () => { /* noop*/ },
		handleInput: (data: string) => {
			// console.log(data);
			// if(!replRawModeEnabled){
				// let byteData = encoder.encode(data);
				// if(byteData.length===1){
					
				// 	switch (byteData[0]) {
				// 		case 1:
				// 			writeEmitter.fire(colorText('\r\nCtrl-A was pressed',3));
				// 			break;
				// 		case 2:
				// 			writeEmitter.fire(colorText('\r\nCtrl-B was pressed',3));
				// 			break;
				// 		case 3:
				// 			writeEmitter.fire(colorText('\r\nCtrl-C was pressed',3));
				// 			break;
				// 		case 4:
				// 			writeEmitter.fire(colorText('\r\nCtrl-D was pressed. Press Ctrl-C to break',3));
				// 			break;
				// 		default:
				// 			break;
				// 	}
				// 	prevByte = byteData[0];
				// }
				// terminalHandleInputRaw(data);
			// }else{
			// 	vscode.window.showWarningMessage("Device Busy!");
			// }

		}
	};
	const terminal = vscode.window.createTerminal({ name: `REPL`, pty });
	const terminalRaw = vscode.window.createTerminal({ name: `DATA`, pty:ptyRaw });
	
	return new Promise((resolve,reject)=>{
		terminal.show();
		resolve(terminal);
	});
}


export async function activate(context: vscode.ExtensionContext) {
	// path of local, after this path files will be uploaded to local
	var currentSyncPath:vscode.Uri|null = null;
	
	const memFs = new DeviceFs();
	const screenProvider = new ScreenProvider();
	const deviceTreeProvider = vscode.window.createTreeView('fileExplorer', { treeDataProvider:memFs,dragAndDropController:memFs });
	const screenTreeprovider =  vscode.window.createTreeView('screens',{treeDataProvider:screenProvider});
	async function startSyncing(){
		if(vscode.workspace.workspaceFolders){
			let rootUri = vscode.workspace.workspaceFolders[0].uri;
			const projectFiles = new vscode.RelativePattern(rootUri, monocleFolder+'/*.py');
			let filesFound = await vscode.workspace.findFiles(projectFiles);
			if(filesFound.length===0){
				return;
			}
			currentSyncPath = vscode.Uri.joinPath(rootUri,monocleFolder+"/");
			vscode.commands.executeCommand('setContext', 'monocle.sync', true);
		}
		
	}
	// deviceTreeProvider/
	statusBarItemBle = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	const snippetprovider = new SnippetProvider();
	const projectProvider =  new ProjectProvider();

	// register empty project and show buttons with viewswelcome from package.json for fpga updates
	vscode.window.registerTreeDataProvider("fpga",{
		getChildren(element?:vscode.TreeItem):vscode.TreeItem[]{
			return [];
			
		},
		getTreeItem(element:vscode.TreeItem):vscode.TreeItem{
			return element;
		}
	});
	//  register data provider for templates
	vscode.window.registerTreeDataProvider('snippetTemplates', snippetprovider);
	// register data provider for community projects
	vscode.window.registerTreeDataProvider('projects',projectProvider);

	// ouput channel to see RAW-REPl logs
	outputChannel = vscode.window.createOutputChannel("RAW-REPL","python"); 
	// outputChannelData = vscode.window.createOutputChannel("RAW-DATA","plaintext"); 
	outputChannel.clear();
	// outputChannelData.clear();
	statusBarItemBle.command = "brilliant-ar-studio.connect";
	statusBarItemBle.show();
	if(isConnected()){
		updateStatusBarItem("connected");
	}else{
		updateStatusBarItem("disconnected");

	}
	// const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
	// ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
	
		
	// const fsWatcher = vscode.workspace.createFileSystemWatcher("**",true,false,true);
	
	// vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse(myscheme+':/'), name: myscheme });
	const alldisposables = vscode.Disposable.from(
		// for completions 
		vscode.languages.registerCompletionItemProvider(
			'python',
			{
				provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
	
					// get all text until the `position` and check if it reads `console.`
					// and if so then complete if `log`, `warn`, and `error`
					const linePrefix = document.lineAt(position).text.substr(0, position.character);
					// for auto import 
					

					
					let snippList:vscode.CompletionItem[]=[];
					Object.keys(snippets).forEach(it=>{
						
						if (linePrefix.endsWith(it+'.')) {
							// let mod = linePrefix.replaceAll('.','');
							// var regex = new RegExp("import\\s+" + mod + "(\\s+as\\s+\\w+)?|from\\s+" + mod + "\\s+import\\s+(.*)");
							// if(!regex.test(document.getText())){
							// 	vscode.window.activeTextEditor?.edit(editerBuilder=>{
							// 		editerBuilder.insert(new vscode.Position(0,0),'import '+mod+'\n');
							// 	});
							// }
							Object.keys(snippets[it]).forEach(ke=>{
								const snippetCompletion = new vscode.CompletionItem(ke);
								snippetCompletion.insertText = new vscode.SnippetString(snippets[it][ke].body.replace(it+'.',''));
								if(ke === ke.toUpperCase()){
									snippetCompletion.kind = vscode.CompletionItemKind.Enum;
								}else if(ke[0] === ke[0].toUpperCase()){
									snippetCompletion.kind = vscode.CompletionItemKind.Class;
								}else if(ke === ke.toLowerCase()){
									snippetCompletion.kind = vscode.CompletionItemKind.Method;
								}
								
								snippList.push(snippetCompletion);
							});
						}
					});
					
					if(snippList.length!==0){
						return snippList;
					}else{
						return [];
					}
				}
			},
			'.' // triggered whenever a '.' is being typed
		),
		vscode.languages.registerCompletionItemProvider(
			'python',
			{
				provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
	
					// get all text until the `position` and check if it reads `console.`
					// and if so then complete if `log`, `warn`, and `error`
					// const linePrefix = document.lineAt(position).text.substr(0, position.character);
					let snippList:vscode.CompletionItem[]=[];
					Object.keys(snippets).forEach(it=>{
						// if (linePrefix.endsWith(it+'.')) {
							// Object.keys(snippets[it]).forEach(ke=>{
						const snippetCompletion = new vscode.CompletionItem(it);
						snippetCompletion.kind = vscode.CompletionItemKind.Module;
						snippetCompletion.insertText = it;
	
						snippList.push(snippetCompletion);
					});
					
					if(snippList.length!==0){
						return snippList;
					}else{
						return [];
					}
				}
			},
		),	
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
		vscode.languages.registerCodeActionsProvider('python',{
			provideCodeActions(document, range, context, token) {
			// const linePrefix = document.lineAt(range).text.substr(0, position.character);
			// let mod = linePrefix.replaceAll('.','');
			// var regex = new RegExp("import\\s+" + mod + "(\\s+as\\s+\\w+)?|from\\s+" + mod + "\\s+import\\s+(.*)");
			// if(!regex.test(document.getText())){
			// 	vscode.window.activeTextEditor?.edit(editerBuilder=>{
			// 		editerBuilder.insert(new vscode.Position(0,0),'import '+mod+'\n');
			// 	});
			// }
			let actions:vscode.CodeAction[]=[];
			if(context.diagnostics.length>0){
				const linePrefix =document.lineAt(context.diagnostics[0].range.start.line).text.substr(context.diagnostics[0].range.start.character, context.diagnostics[0].range.end.character);
				
				Object.keys(snippets).forEach(it=>{
						
					if (linePrefix.endsWith(it)) {
						let mod = linePrefix.replaceAll('.','');
						var regex = new RegExp("import\\s+" + mod + "(\\s+as\\s+\\w+)?|from\\s+" + mod + "\\s+import\\s+(.*)");
						if(!regex.test(document.getText())){
							let codeaction = new vscode.CodeAction("Import "+linePrefix);
							codeaction.kind = vscode.CodeActionKind.SourceFixAll;
							codeaction.isPreferred = true;
							// codeaction.
							let edit = new vscode.WorkspaceEdit();
							edit.insert(document.uri, new vscode.Position(0,0),'import '+mod+'\n');
							codeaction.edit = edit;
							actions.push(codeaction);
							// vscode.window.activeTextEditor?.edit(editerBuilder=>{
							// 	editerBuilder.insert(new vscode.Position(0,0),'import '+mod+'\n');
							// });
						}
					}
				});
			}
				
				return actions;
			},
		}),
    // file and directory operation events
		vscode.workspace.onDidRenameFiles(async (e:vscode.FileRenameEvent)=>{
			if(vscode.workspace.workspaceFolders){
				let newpathKey:any = await configReadUpdate();
				let projectPath = vscode.workspace.workspaceFolders[0].uri;
				for (let index = 0; index < e.files.length; index++) {
					const ef = e.files[index];
					// if(currentSyncPath!==null &&  ef.newUri.fsPath.includes(currentSyncPath.fsPath)){
					// 	let newDevicePath =  ef.newUri.fsPath.replace(currentSyncPath?.fsPath, "").replaceAll("\\","/");
					// 	let oldDevicePath =  ef.oldUri.fsPath.replace(currentSyncPath?.fsPath, "").replaceAll("\\","/");
					if((await vscode.workspace.fs.stat(ef.oldUri)).type===vscode.FileType.Directory){
						// TODO: if needed to change path recursively on directory change
					}else{
						let localDirOld = ef.oldUri.fsPath.replace(projectPath?.fsPath, "").replaceAll("\\","/");
						let localDirnew = ef.newUri.fsPath.replace(projectPath?.fsPath, "").replaceAll("\\","/");
						// 	await memFs.renameFile(oldDevicePath,newDevicePath);
						// }
						if(Object.keys(newpathKey).includes(localDirOld)){
							newpathKey[localDirnew] =newpathKey[localDirOld];
							newpathKey[localDirOld] = false;
						}
					}
					
				}
				await configReadUpdate(newpathKey);
			}
		}),
		// vscode.workspace.onDidCreateFiles( async (e:vscode.FileCreateEvent)=>{
		// 	for (let index = 0; index < e.files.length; index++) {
		// 		const ef = e.files[index];
		
		// 		if(currentSyncPath!==null && ef.fsPath.includes(currentSyncPath.fsPath)){
		// 			let devicePath = ef.fsPath.replace(currentSyncPath?.fsPath, "").replaceAll("\\","/");
		// 			await memFs.addFile(ef,devicePath);
		// 		}
		// 	}
			
		// }),
		vscode.workspace.onDidDeleteFiles(async (e:vscode.FileDeleteEvent)=>{
			if(vscode.workspace.workspaceFolders){
				let newpathKey:any = await configReadUpdate();
				let projectPath = vscode.workspace.workspaceFolders[0].uri;
				for (let index = 0; index < e.files.length; index++) {
					const ef = e.files[index];
					// if(currentSyncPath!==null && ef.fsPath.includes(currentSyncPath.fsPath)){
						// let devicePath = ef.fsPath.replace(currentSyncPath?.fsPath, "").replaceAll("\\","/");
						// 	let oldDevicePath =  ef.oldUri.fsPath.replace(currentSyncPath?.fsPath, "").replaceAll("\\","/");
					if((await vscode.workspace.fs.stat(ef)).type===vscode.FileType.Directory){
						// TODO: if needed to change path recursively on directory change
					}else{
						let localDir = ef.fsPath.replace(projectPath?.fsPath, "").replaceAll("\\","/");
						if(Object.keys(newpathKey).includes(localDir)){
							newpathKey[localDir] =false;
						}
					}
							// }
						// await memFs.deleteFile(devicePath);
					// }
				}
				await configReadUpdate(newpathKey);
			}
			
		}),
    // // event capture on file changes 
	// 	fsWatcher.onDidChange(async (e)=>{
			
	// 		if(currentSyncPath!==null && e.path.includes(currentSyncPath.path)){
	// 			let devicePath = e.fsPath.replace(currentSyncPath?.fsPath, "").replaceAll("\\","/");
	// 			await memFs.updateFile(e,devicePath);
	// 		}
		
	// 	}),
	// register code templates tree
		vscode.window.createTreeView('snippetTemplates', {
			treeDataProvider: new SnippetProvider(),
			dragAndDropController: new SnippetProvider()
		}),

	// register content provider for files on device for read only mode
		vscode.workspace.registerTextDocumentContentProvider(myscheme, memFs),
	/*****  All commands *******/
		// runs file directly to REPL runtime
		vscode.commands.registerCommand('brilliant-ar-studio.runFile', async (thiscontext) => {
			let editor =  vscode.window.activeTextEditor;
			if(editor){
				let fileData = await vscode.workspace.fs.readFile(editor.document.uri);
				if(fileData.byteLength!==0){
					await sendFileUpdate(fileData);
				}
			}
			
		}),
		//  refresh device files forcefully to fileExplorer tree
		vscode.commands.registerCommand('brilliant-ar-studio.refreshDeviceFiles', async (thiscontext) => {
			memFs.refresh();
		}),
		//  delete device files forcefully to fileExplorer tree
		vscode.commands.registerCommand('brilliant-ar-studio.deleteDeviceFile', async (thiscontext) => {
			vscode.window.showQuickPick(['Confirm Delete','Cancel']).then(async resp=>{
				if(resp==='Confirm Delete'){
					await memFs.deleteFile(thiscontext.path);
				}
			});
			
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.renameDeviceFile', async (thiscontext) => {
			let newpath = await vscode.window.showInputBox({title:"Rename", value:thiscontext.path});
			if(newpath){
				await memFs.renameFile(thiscontext.path,newpath);
			}
		}),
		//open any device file to local or in virtual path
		vscode.commands.registerCommand('brilliant-ar-studio.downloadDeviceFile', async (thiscontext) => {
			if(vscode.workspace.workspaceFolders){
				let rootUri = vscode.workspace.workspaceFolders[0].uri;
				let downloadDir = await vscode.window.showOpenDialog({canSelectFiles:false,canSelectFolders:true,canSelectMany:false,title:"Select Directory where to donload",defaultUri:rootUri,openLabel:"Download Here"});
				// let projectPath = vscode.Uri.joinPath(rootUri,monocleFolder);
				if(downloadDir && await isPathExist(downloadDir[0])){
					let segments = thiscontext?.path.split('/');
					const basename = segments[segments.length-1];
					let localPath = vscode.Uri.joinPath(downloadDir[0],basename);
					if(memFs.data.get(thiscontext?.path)?.type===vscode.FileType.File){
						let content = await memFs.readFile(thiscontext?.path);
						if(content!=='NOTFOUND' && typeof content!=='boolean'){
							await vscode.workspace.fs.writeFile(localPath,Buffer.from(content));
							let doc = await vscode.workspace.openTextDocument(localPath);
							await vscode.window.showTextDocument(doc);
							return;
						}
					}else{
						await memFs.downloadDirectory(thiscontext?.path,downloadDir[0]);
					}
					
				}else{
					vscode.window.showWarningMessage("Not valid path");
				}
			}else{
				vscode.window.showInformationMessage("No workspace found!");
			}
			
		}),
		//open any device file to local or in virtual path
		vscode.commands.registerCommand('brilliant-ar-studio.openDeviceFile', async (thiscontext) => {
			let localPath = vscode.Uri.parse(myscheme+':' + thiscontext?.path);
			let doc = await vscode.workspace.openTextDocument(localPath);
			await vscode.window.showTextDocument(doc);
			
		}),
		// update fpga from brilliantsAR Repo
		vscode.commands.registerCommand('brilliant-ar-studio.fpgaUpdate', async (thiscontext) => {
			if(!isConnected()){
				await vscode.window.showWarningMessage('Device not connected');
				return;
			}
			currentSyncPath = null;
			vscode.commands.executeCommand('setContext', 'monocle.sync', false);
			await triggerFpgaUpdate();
			
		}),
		// upload file/directory to device
		vscode.commands.registerCommand('brilliant-ar-studio.uploadFilesToDevice', async (e:vscode.Uri) => {
			if(vscode.workspace.workspaceFolders){
				let currentFilesUploaded:any = await configReadUpdate();
				let projectPath = vscode.workspace.workspaceFolders[0].uri;
				// let projectPath = vscode.Uri.joinPath(rootUri,monocleFolder);
				// let localpath = e.path;
				let localpath = e.fsPath.replace(projectPath?.fsPath, "").replaceAll("\\","/");
				let newpathKey:any = {};
				let basename = path.posix.basename(e.path);
				newpathKey[localpath] = basename;
				if(!Object.keys(currentFilesUploaded).includes(localpath)){
					let devicePathInput = await vscode.window.showInputBox({prompt:"Enter Device Path",title:"Device Path", value:basename,placeHolder:"/ (default to root)"});
					if(devicePathInput && devicePathInput!=='/'){
						newpathKey[localpath] = devicePathInput;
						
					}else{
						newpathKey[localpath] = basename;
					}
				}else{
					newpathKey[localpath] = currentFilesUploaded[localpath];
				}
				
				
				if(projectPath!==null && e.path.includes(projectPath.path)){
					let devicePath = newpathKey[localpath];
					if(devicePath.startsWith('/')){
						devicePath = devicePath.slice(1,devicePath.length);
					}
					
					if((await vscode.workspace.fs.stat(e)).type===vscode.FileType.File){
						await memFs.updateFile(e, devicePath,true);
						await configReadUpdate(newpathKey);
					}else if((await vscode.workspace.fs.stat(e)).type===vscode.FileType.Directory){
						let files = await vscode.workspace.findFiles(new vscode.RelativePattern(e,'**'));
						let basename = newpathKey[localpath];
						newpathKey = {};
						for (let index = 0; index < files.length; index++) {
							const uri = files[index];
							let localDir = uri.fsPath.replace(projectPath?.fsPath, "").replaceAll("\\","/");
							let deviceDir =  uri.fsPath.replace(e.fsPath, "").replaceAll("\\","/");
							 newpathKey[localDir] = basename + deviceDir;
						}
						await configReadUpdate(newpathKey);
						memFs.updateFileBulk(files,devicePath);
					}
				}
			}
			
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.syncAllFiles', async (e:vscode.Uri) => {
			if(vscode.workspace.workspaceFolders){
				let mappedFiles:any = await configReadUpdate();
				let rootUri = vscode.workspace.workspaceFolders[0].uri;
				let projectPath = vscode.Uri.joinPath(rootUri,monocleFolder);
				let filesMapped:FileMaps[] = [];
				for (let source in mappedFiles) {
					let files = await vscode.workspace.findFiles(new vscode.RelativePattern(rootUri, '*'+source.slice(1)));
					if(files.length>0){
						// let dest = mappedFiles[source];
						filesMapped.push({uri:files[0],devicePath:mappedFiles[source]});
					}else{
						vscode.window.showErrorMessage(source+' file doesn\'t exists');
					}
					
				}
				if(filesMapped.length>0){
					await memFs.buildFiles(filesMapped);
				}else{
					vscode.window.showInformationMessage("No files to build! Upload files one by one");
				}
				
			}
			
		}),
		// update custom fpga binary
		vscode.commands.registerCommand('brilliant-ar-studio.fpgaUpdateCustom', async (thiscontext) => {
			if(!isConnected()){
				await vscode.window.showWarningMessage('Device not connected');
				return;
			}
			let binFile = await vscode.window.showOpenDialog({canSelectFiles:true,canSelectFolders:false,canSelectMany:false,filters:{bin: ["bin"]}});
			if(binFile && binFile.length>0){
				currentSyncPath = null;
			vscode.commands.executeCommand('setContext', 'monocle.sync', false);
			await triggerFpgaUpdate(binFile[0]);
			}
		}),
		//  stop auto update of files and auto run of main.py
		vscode.commands.registerCommand('brilliant-ar-studio.syncStop', async (thiscontext) => {
			currentSyncPath = null;
			vscode.commands.executeCommand('setContext', 'monocle.sync', false);
		}),
		//  initiate new project path
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
		// get all repos from github topic to community projects tree
		vscode.commands.registerCommand('brilliant-ar-studio.getPublicApps',  (thiscontext) => {
			 projectProvider.refresh();
	   
		}),
		// remove topic from github repos
		vscode.commands.registerCommand('brilliant-ar-studio.UnPublishMonocleApp',  (thiscontext) => {
			const gitExtension1 = vscode.extensions.getExtension('vscode.git');
			if(gitExtension1){
				const git = gitExtension1.exports.getAPI(1);
				if(vscode.workspace.workspaceFolders){
					let monocleFilesUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri,monocleFolder);
					if(! isPathExist(monocleFilesUri)){
						vscode.window.showErrorMessage('Project not set');
						return;
					};
	
					if(git.repositories && git.repositories.length>0 && git.repositories[0].repository.remotes.length>0){
						let pushUrl = git.repositories[0].repository.remotes[0].pushUrl;
						gitOper.publishProject(pushUrl,true);
						vscode.commands.executeCommand('setContext', 'monocle.published', false);
						projectProvider.refresh();
					}else{
						vscode.window.showErrorMessage('Not set remote repository');
					}
				}
				
			}
		}),
		// fork project and start in local 
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
		//  copy project to a path but not init git
		vscode.commands.registerCommand('brilliant-ar-studio.copyProject', async (thiscontext) => {
			let localPath = await vscode.window.showOpenDialog({canSelectFiles:false,canSelectMany:false,canSelectFolders:true,title:"Select folder to open in local"});
			if(localPath){
				if(localPath && localPath.length>=0){
					await gitOper.getArchiveZip(thiscontext.cloneurl,localPath[0]);
				}
			}
			
		}),
		// add github topic to publish
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
				let monocleFilesUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri,monocleFolder);
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
		// start auto update of files and auto run of main.py
		vscode.commands.registerCommand('brilliant-ar-studio.syncFiles', async (thiscontext) => {
			// launch.json configuration
			if(vscode.workspace.workspaceFolders){
				// await startSyncing();
				 
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
							vscode.window.showErrorMessage("Directory exist, open if you want to use existing directory");
						}
					}
					
				}
			}
		}),
		// connect device
		vscode.commands.registerCommand('brilliant-ar-studio.connect', async () => {
			if(!isConnected()){
				// await vscode.commands.executeCommand('brilliant-ar-studio.syncFiles');
				if(vscode.workspace.workspaceFolders){
					// await startSyncing();
				}
				selectTerminal().then();
			}
			
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.sendRawData', async () => {
			if(isConnected()){
				let dataToSend = await vscode.window.showInputBox({title:"Enter data to send",prompt:"Data"});
				if(dataToSend){
					await sendRawData(dataToSend);
				}
			}
			
		}),
		// disconnect devcie
		vscode.commands.registerCommand('brilliant-ar-studio.disconnect', async () => {
			
			disconnect();
			vscode.commands.executeCommand('brilliant-ar-studio.syncStop');
			
		}),

		// for UI webview
		vscode.commands.registerCommand("brilliant-ar-studio.openUIEditor", async () => {
			if(vscode.workspace.workspaceFolders){
				let screenName = await vscode.window.showInputBox({prompt:"Enter Screen name"});
				if(screenName){
					screenName = screenName.replaceAll(" ","_").replaceAll("/","").replaceAll("\\","").replaceAll("-","_");
					let screenPath = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri,monocleFolder,screenFolder,screenName+"_screen.py");
					await vscode.workspace.fs.writeFile(screenPath,Buffer.from('# GENERATED BRILLIANT AR STUDIO Do not modify this file directly\n\nimport display\n\nclass '+screenName+':\n\tpass'));
					await vscode.commands.executeCommand('vscode.open',screenPath,vscode.ViewColumn.One);
					UIEditorPanel.render(context.extensionUri,screenName,screenPath);
					screenProvider.refresh();
					
				}
			}
			
		}),
		vscode.commands.registerCommand("brilliant-ar-studio.editUIEditor",async(thiscontext)=>{
			// console.log(thiscontext)
			if(await isPathExist(thiscontext.uri)){
				// await vscode.workspace.fs.writeFile(thiscontext.uri,Buffer.from('# GENERATED BRILLIANT AR STUDIO Do not modify this file directly\n\nimport display\n\nclass '+screenName+':\n\tpass'));
				await vscode.commands.executeCommand('vscode.open',thiscontext.uri,vscode.ViewColumn.One);
				UIEditorPanel.render(context.extensionUri,thiscontext.name,thiscontext.uri);
			}
		})
	);
	context.subscriptions.push(alldisposables);
	context.subscriptions.push(statusBarItemBle);

}

export function updateStatusBarItem(status:string,msg:string="Monocle",): void {

	statusBarItemBle.text = `${msg}`;
	let bgColorWarning = new vscode.ThemeColor('statusBarItem.warningBackground');
	let bgColorError = new vscode.ThemeColor('statusBarItem.errorBackground');
	statusBarItemBle.command = "brilliant-ar-studio.connect";
	if(status==="connected" && isConnected()){
		// statusBarItemBle.color = "#13f81a";
		statusBarItemBle.tooltip = "Connected";
		statusBarItemBle.command = "brilliant-ar-studio.disconnect";
		statusBarItemBle.backgroundColor = "";
		statusBarItemBle.text = msg;
	}else if(status==="progress"){
		statusBarItemBle.command = undefined;
		statusBarItemBle.text = "$(sync~spin) "+msg;
		statusBarItemBle.backgroundColor = bgColorWarning;
		statusBarItemBle.tooltip = "Connecting";
	}else if(status==="updating"){
		statusBarItemBle.tooltip = "Updating firmware";
		// statusBarItemBle.color = "#D90404";
		statusBarItemBle.backgroundColor =  bgColorWarning;
		statusBarItemBle.text = "$(cloud-download) Updating "+msg+"%";
		statusBarItemBle.command = undefined;
	
	}else if (!isConnected()){
		statusBarItemBle.tooltip = "Disconnected";
		// statusBarItemBle.color = "#D90404";
		statusBarItemBle.command = "brilliant-ar-studio.connect";
		statusBarItemBle.backgroundColor =  bgColorError;
		statusBarItemBle.text = "$(debug-disconnect) "+msg;
	}else{
		statusBarItemBle.command = "brilliant-ar-studio.connect";
		statusBarItemBle.tooltip = "Disconnected";
		// statusBarItemBle.color = "#D90404";
		statusBarItemBle.backgroundColor =  bgColorError;
		statusBarItemBle.text = "$(debug-disconnect) "+msg;
	}
	statusBarItemBle.show();
	
}

// This method is called when your extension is deactivated
export async function deactivate() {
	if(isConnected()){
		// await disconnect();
		await new Promise(r => setTimeout(r, 1000));
	}
	
}