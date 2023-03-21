// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as vscode from 'vscode';
import { isConnected,disconnect } from './bluetooth';
import {ensureConnected,replSend,sendFileUpdate,triggerFpgaUpdate} from './repl';
import {getRepoList} from './projects';
import { DepNodeProvider } from './snippets/provider';
// import { FileExplorer } from './fileExplorer';
const util = require('util');
const encoder = new util.TextEncoder('utf-8');
import { DeviceFs } from './fileSystemProvider';
import { workspace, Disposable ,extensions   } from 'vscode';
//import * as git from 'isomorphic-git';
import { commands } from 'vscode';

let disposable: Disposable;

let statusBarItemBle:vscode.StatusBarItem;

export const writeEmitter = new vscode.EventEmitter<string>();
export const myscheme = "monocle";
export var outputChannel:vscode.OutputChannel;

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
	let fileSubs = vscode.workspace.registerFileSystemProvider(myscheme, memFs, { isCaseSensitive: true });
	// register content provider for scheme `references`
	// vscode.commands.executeCommand('')
	// register document link provider for scheme `references`
	statusBarItemBle = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	const nodeDependenciesProvider = new DepNodeProvider("rootPath");

	vscode.window.registerTreeDataProvider('snippetTemplates', nodeDependenciesProvider);
	
	outputChannel = vscode.window.createOutputChannel("RAW-REPL","python"); 
	outputChannel.clear();
	// outputChannel.show();
	statusBarItemBle.command = "brilliant-ar-studio.connect";
	let initializedWorkSpace = false;
	statusBarItemBle.show();
	updateStatusBarItem("disconnected");
	let projectFolder:string|undefined;
	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
	? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
	
	memFs.onDidChangeFile( (events:any)=>{
		
		events.forEach((e:any)=>{
			// let fileData = memFs.readFile(vscode.Uri.parse(e.uri));
			// if(fileData.byteLength!==0){
			// 	sendFileUpdate(fileData);
			// }
		});
		// sendFileUpdate(fileData);
	});

	// const commitDisposable = vscode.commands.registerCommand('extension.commit', async () => {
	// 	const repoPath = vscode.workspace.rootPath;
	// 	const message = await vscode.window.showInputBox({ prompt: 'Commit message' });
	
	// 	console.log('welcome');
	// 	try {
	// 	 // await git.commit({ fs: git.FS, dir: repoPath, message });
	// 	  vscode.window.showInformationMessage('Changes committed successfully.');
	// 	} catch (err) {
	// 	 // vscode.window.showErrorMessage(`Failed to commit changes: ${err.message}`);
	// 	}
	//   });


	function myCustomCommitFunction() {
		// Your custom code here
		console.log('welcome ');
	}
	
	let disposable = commands.registerCommand('extension.myCommitFunction', () => {
		myCustomCommitFunction();
	});
	  
	

	// workspace.onDidCommit(commitInfo => {
	// 	console.log(`Commit message: ${commitInfo.message}`);
	// });

	const gitExtension1 = extensions.getExtension('vscode.git');
    if (gitExtension1) {
        const git = gitExtension1.exports.getAPI(1);
        disposable = git.onDidChangeState((e:any) => {
            if (e) {
                console.log(`Commit message: ${e}`);
                // Handle the commit event here
            }
			
        });
		disposable = git.onDidCloseRepository((e:any) => {
            if (e) {
                console.log(`Commit message: ${e}`);
                // Handle the commit event here
            }
        });
		disposable = git.onDidOpenRepository((e:any) => {
            if (e) {
                console.log(`Commit message: ${e}`);
                // Handle the commit event here
            }
        });
		disposable = git.onDidPublish((e:any) => {
			console.log(e);
            if (e) {
                console.log(`Commit message: ${e}`);
                // Handle the commit event here
            }
        });
		
    }
	// function validateRepoName(repoName: string) {
	// 	console.log(repoName);
	// 	return true;
	// 	// your validation logic here
	// 	// return true if repoName is valid, false otherwise
	//   }
	  

	// const commitDisposable = vscode.commands.registerCommand('extension.commit', async () => {
	// 	const repoName = 'my-repo-name'; // replace with the actual repo name
	// 	console.log('welcom');
	// 	if (!validateRepoName(repoName)) {
	// 	  vscode.window.showErrorMessage(`Invalid repo name: ${repoName}`);
	// 	  return;
	// 	}
	
	// 	// continue with the commit process
	// 	// ...
	//   });

//  const gitExtension = GitExtension.getOrCreate();
//     if (gitExtension) {
//         const git = gitExtension.getAPI(1);
//         disposable = git.onDidChangeStatus((e: { commit: { message: any; }; }) => {
//             if (e.commit) {
//                 console.log(`Commit message: ${e.commit.message}`);
//                 // Handle the commit event here
//             }
//         });
//     }

	// if(!initializedWorkSpace){
	// 	// let startFolders = vscode.workspace.workspaceFolders? vscode.workspace.workspaceFolders.length:0;
	// 	// let workspaceFolders = [{ uri: vscode.Uri.parse(myscheme+':/'), name: myscheme }]
	// 	// if(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length>0){
	// 		// vscode.workspace.updateWorkspaceFolders(startFolders, null, );
	// 		// vscode.workspace.updateWorkspaceFolders(startFolders, null, ...workspaceFolders);

	// 	// }

	// 	initializedWorkSpace = true;
	// }
	// Samples of `window.registerTreeDataProvider`
	// const nodeDependenciesProvider = new DepNodeProvider(rootPath);
	const fsWatcher = vscode.workspace.createFileSystemWatcher("**");
	
	// vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse(myscheme+':/'), name: myscheme });
	const alldisposables = vscode.Disposable.from(
		// vscode.workspace.registerTextDocumentContentProvider(myscheme, provider),
		// vscode.workspace.registerFileSystemProvider(myscheme, memFs, { isCaseSensitive: true }),
		
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
		   //  new vscode.SnippetTextEdit(new vscode.Position(0, 0),itemValue)
			
		  },
		}),
		// vscode.commands.executeCommand()
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
	
		// vscode.window.registerTreeDataProvider('deviceFiles', nodeDependenciesProvider),
		// vscode.commands.registerCommand('deviceFiles.refreshEntry', () => nodeDependenciesProvider.refresh()),
		
		// vscode.commands.registerCommand('deviceFiles.editEntry', async (context) => {
		// 	// console.log(context);
		// 	const uri = vscode.Uri.parse(`${myscheme}:/file.txt`);
		// 	const doc = await vscode.workspace.openTextDocument(uri); // calls back into the provider
		// 	await vscode.window.showTextDocument(doc, { preview: false });
		// }),
		vscode.window.createTreeView('snippetTemplates', {
			treeDataProvider: new DepNodeProvider(rootPath),
			dragAndDropController: new DepNodeProvider(rootPath)
		}),
		// The command has been defined in the package.json file
		// Now provide the implementation of the command with registerCommand
		// The commandId parameter must match the command field in package.json
		vscode.commands.registerCommand('brilliant-ar-studio.helloWorld', () => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			
			vscode.window.showInformationMessage('Hello World from Brilliant AR Studio!');
		}),

		vscode.commands.registerCommand('brilliant-ar-studio.runFile', async (thiscontext) => {
			let fileData = await vscode.workspace.fs.readFile(vscode.Uri.parse(thiscontext.path));
				if(fileData.byteLength!==0){
					sendFileUpdate(fileData);
				}
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.fpgaUpdate', async (thiscontext) => {
			vscode.commands.executeCommand('setContext', 'monocle.sync', false);
			currentSyncPath = null;
			await triggerFpgaUpdate();
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.syncStop', async (thiscontext) => {
			currentSyncPath = null;
			vscode.commands.executeCommand('setContext', 'monocle.sync', false);
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.getPublicApps', async (thiscontext) => {
			await getRepoList();
		}),
		vscode.commands.registerCommand('brilliant-ar-studio.syncFiles', async (thiscontext) => {
			// launch.json configuration
			if(vscode.workspace.workspaceFolders){
				const config = vscode.workspace.getConfiguration(
					'launch',
					vscode.workspace.workspaceFolders[0].uri
				  );
				  // retrieve values
				  const values:string|undefined = config.get('monocle');
				  let newFolderToSync = false;
				  if(values){
					// if value exist ask for confirmation
					let oper = await vscode.window.showQuickPick(
						[{label:values.split("/").slice(-1)[0],target:values},{label:"New folder",target:"NEW"}],
						{ title: "Select workspace?" }
					  );
					 // if new skip
					  if(oper?.target==="NEW"){
						newFolderToSync = true;
					 }
					//   if confirmed then start
					  if(oper?.target===values){
						currentSyncPath = vscode.Uri.parse(values);
						vscode.commands.executeCommand('setContext', 'monocle.sync', true);
					  }
					
				  }
				  
				//   set new folder for sync if not set or asked for new
				 if(!values || newFolderToSync) {
					let success = await vscode.window.showOpenDialog({defaultUri:vscode.workspace.workspaceFolders[0].uri,openLabel:"Select Folder To be synced with device",canSelectFiles:false,canSelectMany:false,canSelectFolders:true});
					if(success && success[0]){
						currentSyncPath = vscode.Uri.parse(success[0].path);
						config.update("monocle",currentSyncPath.path);
						vscode.commands.executeCommand('setContext', 'monocle.sync', true);
					}
				}
				 
			}else{
				await vscode.commands.executeCommand('vscode.openFolder');
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
	context.subscriptions.push(fileSubs);
	console.log('Congratulations, your extension "brilliant-ar-studio" is now active!');

	// new FileExplorer(context);


	//   Get the Git API
	  const gitExtension = vscode.extensions.getExtension('vscode.git')!;
	  const git = gitExtension.exports.getAPI(1);


	  async function pushCode() {
		// Validate the workspace name
		console.log('welcome ');
		const workspaceName = workspace.name!;
		const namePattern = /^[A-Za-z0-9_-]+$/;
		if (!namePattern.test(workspaceName)) {
		  throw new Error('Invalid workspace name format. Only alphanumeric characters, underscores, and hyphens are allowed.');
		}
	  
		// Push the code to the Git repository
		// const git = simpleGit();
		// await git.push();
	  }
	  
	
	//   Subscribe to the onDidPush event/
	//   git.onDidPush(async (pushedRepository: vscode.Uri, commits: any[]) => {
	// 	// Handle the push event
	// 	console.log(`Pushed to repository: ${pushedRepository.toString()}`);
	// 	console.log(`Pushed commits: ${JSON.stringify(commits)}`);
	
	// 	// You can perform additional actions here, such as notifying the user or running a task.
	//   });
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
