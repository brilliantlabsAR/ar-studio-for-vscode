import * as path from 'path';
import * as vscode from 'vscode';
import {
	listFilesDevice,
	createDirectoryDevice,
	creatUpdateFileDevice, 
	deleteFilesDevice,
	renameFileDevice, 
	readFileDevice,
	uploadFileBulkDevice,
	FileMaps,
	buildMappedFiles
} from './repl';
import { startFirmwareUpdate } from './update';
import {deviceTreeProvider, isPathExist, monocleFolder,configScreenReadUpdate} from './extension';
import { isConnected,deviceInfo } from './bluetooth';

export class File extends vscode.TreeItem implements vscode.FileStat {

	type: vscode.FileType;
	ctime: number;
	mtime: number;
	size: number;
	name: string;
	data?: Uint8Array;
	path?:string = "";
	constructor(name: string,path?:string,public readonly collapsibleState?: vscode.TreeItemCollapsibleState,public readonly command?: vscode.Command) {
		super(name, collapsibleState||vscode.TreeItemCollapsibleState.None);
		this.type = vscode.FileType.File;
		this.ctime = Date.now();
		this.mtime = Date.now();
		this.size = 0;
		this.name = name;
		this.path = path;
		this.iconPath =vscode.ThemeIcon.File;
		this.command = {command:"brilliant-ar-studio.openDeviceFile",title:"Open In Editor",arguments:[{"path":this.path}]};
		this.contextValue = `devicefile_active`;
	
	}
	contextValue='devicefile_active';

	// contextValue = `devicefile#${this.path}`;
}

export class Directory extends vscode.TreeItem implements vscode.FileStat {

	type: vscode.FileType;
	ctime: number;
	mtime: number;
	size: number;
	path?:string = '';
	name: string;
	entries: Map<string, File | Directory>;

	constructor(name: string, path?:string, public readonly collapsibleState?: vscode.TreeItemCollapsibleState) {
		super(name, collapsibleState||vscode.TreeItemCollapsibleState.None);
		this.type = vscode.FileType.Directory;
		this.ctime = Date.now();
		this.mtime = Date.now();
		this.size = 0;
		this.name = name;
		this.path = path;
		this.entries = new Map();
		this.iconPath =vscode.ThemeIcon.Folder;
		this.contextValue = `devicefile_active`;
		
	}
	contextValue='devicefile_active';
	
}

export type MonocleFile = File | Directory ;

export class DeviceFs implements  vscode.TreeDataProvider<MonocleFile>,vscode.TextDocumentContentProvider , vscode.TreeDragAndDropController<MonocleFile> {
	dropMimeTypes = ['application/vnd.code.workbench.explorer.fileView'];
	dragMimeTypes = [];
	root = new Directory('');
	// --- manage file metadata
	data:Map<string,MonocleFile> = new Map();
	private _onDidChangeTreeData: vscode.EventEmitter<MonocleFile | undefined | void> = new vscode.EventEmitter<MonocleFile | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<MonocleFile | undefined | void> = this._onDidChangeTreeData.event;
	private dragDataEmitter = new vscode.EventEmitter<any>();
	public readonly onDragData = this.dragDataEmitter.event;
	refresh(): void {
		this.data = new Map();
		this._onDidChangeTreeData.fire();
	}
	
	public async handleDrop(target: any, sources: any, token: vscode.CancellationToken): Promise<void> {
		const transferItem = sources.get('application/vnd.code.tree.explorer');
		if (!transferItem) {
			return;
		}
	}
	     //  for drag 
		public async handleDrag(source: File[], treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		// treeDataTransfer.set('application/vnd.code.tree.snippettemplates', new vscode.DataTransferItem(source[0].label));
		return ;
	}
	async addFile(uri:vscode.Uri,devicePath:string){
		const basename = path.posix.basename(devicePath);
		let file = await vscode.workspace.fs.stat(uri);
	
		vscode.window.withProgress({
			location: {viewId:"fileExplorer"},
			cancellable: false,
		}, async (progress,canceled) => {
			if(file.type===vscode.FileType.Directory){
				//  here needs to create directory in monocle
				if(await createDirectoryDevice(devicePath)){
					this.refresh();
				}
			}else if(file.type===vscode.FileType.File){
				//  here needs to create file in monocle
				if(await creatUpdateFileDevice(uri, devicePath)){
					this.refresh();
				}
			}
		});
	}
	async updateFile(uri:vscode.Uri,devicePath:string,refresh=false){
		vscode.window.withProgress({
			location: {viewId:"fileExplorer"},
			cancellable: false,
		}, async (progress,canceled) => {
			if(await creatUpdateFileDevice(uri, devicePath)){
				if(refresh){
					this.refresh();
				}
			}
		});
	}
	async buildFiles(fileMAps:FileMaps[],refresh=false){
		vscode.window.withProgress({
			location: {viewId:"fileExplorer"},
			cancellable: false,
		}, async (progress,canceled) => {
			if(await buildMappedFiles(fileMAps)){
				if(refresh){
					this.refresh();
				}
			}
		});
	}
	async updateFileBulk(files:vscode.Uri[],devicePath:string){
		vscode.window.withProgress({
			location: {viewId:"fileExplorer"},
			cancellable: false,
		}, async (progress,canceled) => {
			if(await uploadFileBulkDevice(files,devicePath)){
				this.refresh();
			};
		});
		
	}
	async renameFile (oldDevicePath:string,newDevicePath:string){
		vscode.window.withProgress({
			location: {viewId:"fileExplorer"},
			cancellable: false,
		}, async (progress,canceled) => {
			if(await renameFileDevice(oldDevicePath, newDevicePath)){
				this.refresh();
			}
		});
		
		
	}
	private async _dowloadRecursive(devicePath:string, localPath:vscode.Uri){
		if(this.data.get(devicePath) instanceof Directory){
			let subDirectory = await listFilesDevice(devicePath);
			for (let index = 0; index < subDirectory.length; index++) {
				const dFile:any = subDirectory[index];
				const rootPath = devicePath+"/"+dFile.name;
				const _localPath = vscode.Uri.joinPath(localPath, rootPath);
				if(dFile.file){
					let content = await this.readFile(rootPath);
					if(content!=='NOTFOUND' && typeof content!=='boolean'){
						await vscode.workspace.fs.writeFile(_localPath,Buffer.from(content));
					}
				}else{
					await this._dowloadRecursive(rootPath,localPath);
				}
				
			}
		}
	}
	async downloadDirectory(devicePath:string, localPath:vscode.Uri){
		vscode.window.withProgress({
			location: {viewId:"fileExplorer"},
			cancellable: false,
		}, async (progress,canceled) => {
			await this._dowloadRecursive(devicePath,localPath);
		});
	}
	async readFile (devicePath:string):Promise<string|boolean>{
		
		let data = await readFileDevice(devicePath);
		if(typeof data ==='string'){
			return data;
		}else{
			
			return false;
		}
		
		
	}

	async deleteFile(devicePath:string){

		vscode.window.withProgress({
			location: {viewId:"fileExplorer"},
			cancellable: false,
		}, async (progress,canceled) => {
			if(await deleteFilesDevice(devicePath)){
				this.data.delete(devicePath);
				this.refresh();
			}
		});
		
	}
	async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
		// simply invoke cowsay, use uri-path as text
		let data = await this.readFile(uri.path);
		if(typeof data === 'string'){
			return data;
		}else{
			vscode.window.showErrorMessage('couldn\'t read file');
			return "NOTFOUND";
		}
	}
	getTreeItem(element: MonocleFile): vscode.TreeItem {
		return element;
	}
	getParent(element: MonocleFile): vscode.ProviderResult<MonocleFile> {
        if(element.path){
			let paths = element.path.split('/');
			if(paths.length>1){
				return this.data.get(paths.slice(0,paths.length-1).join("/"));
			}else{
				return this.data.get(paths[0]);
			}
		}
		return undefined;
    }
	async getChildren(element?: MonocleFile): Promise<MonocleFile[]> {
		let files:MonocleFile[]= [];
		if(!isConnected()){
			return [];
		}
		let rootPath = "";
		if (element) {
			if (element instanceof Directory) {
				let subDirectory = await listFilesDevice(element.path);
				
				subDirectory.forEach((f:any)=>{
					if(element.path){
						rootPath = element.path+"/"+f.name;
					}
					let entry:MonocleFile;
					f.file? entry = new File(f.name,rootPath,vscode.TreeItemCollapsibleState.None)
						   :entry = new Directory(f.name,rootPath,vscode.TreeItemCollapsibleState.Collapsed);
					files.push(entry);
					this.data.set(rootPath,entry);
				});
				
				return files;
			}else{
				return [element];
			};
			
		}
		
		
		let topDirectory = await listFilesDevice();
		
		topDirectory.forEach((f:any)=>{
			rootPath = f.name;
			let entry:MonocleFile;
			f.file? entry = new File(f.name,rootPath,vscode.TreeItemCollapsibleState.None)
					:entry = new Directory(f.name,rootPath,vscode.TreeItemCollapsibleState.Collapsed);
			files.push(entry);
			this.data.set(rootPath,entry);
		});
		return files;
		
	}

}


export class ScreenProvider implements vscode.TreeDataProvider<vscode.TreeItem>{

	private _onDidChangeTreeData: vscode.EventEmitter<MonocleFile | undefined | void> = new vscode.EventEmitter<MonocleFile | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<MonocleFile | undefined | void> = this._onDidChangeTreeData.event;
	
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}
	getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}
	getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
		if(element){
			return [];
		}
		return this.getAllScreens();
	}
	private async getAllScreens(){
		if(vscode.workspace.workspaceFolders){
			const rootUri = vscode.workspace.workspaceFolders[0].uri;
			// const localFiles = vscode.Uri.joinPath(rootUri,screenFolder);
			
			if(await isPathExist(rootUri)){
				// const screenFiles = new vscode.RelativePattern(rootUri, '*_screen.py');
				let finalList:vscode.TreeItem[]=[];
				let screensObjs = await configScreenReadUpdate();
				for (const [key, value] of Object.entries(screensObjs)) {
					try {
						let uri = vscode.Uri.joinPath(rootUri,value.filePath);
							if(await isPathExist(uri)){
						let newitem = new vscode.TreeItem(key.replace('.py',''),vscode.TreeItemCollapsibleState.None);
						newitem.iconPath = vscode.ThemeIcon.File;
						newitem.command =  {command:"brilliant-ar-studio.editUIEditor",title:"Edit In UI Editor",arguments:[{"uri":uri,"name":key.replace('.py','')}]};
						finalList.push(newitem);
							}
					} catch (error) {
						console.log(error);
					}
				
				}
				return finalList;
			}else{
				
				// vscode.window.showWarningMessage("Project not initialized!");
				return [];
			}
		}else{
			return [];
		}
		
	}
}


export class DeviceInfoProvider implements vscode.WebviewViewProvider{

	private _view?: vscode.WebviewView;
	private _currentInfo:any;
	constructor(
		private readonly _extensionUri: vscode.Uri,
	) {
		this._extensionUri = _extensionUri;
	 }
	public updateValues(data:object){
		this._view?.webview.postMessage(data);
		this._currentInfo= data;
	}
	

	private _setWebviewMessageListener(webview: vscode.Webview) {
		webview.onDidReceiveMessage(
		  (message: any) => {
			switch (message) {
				case "fpgaUpdate":
					vscode.commands.executeCommand('brilliant-ar-studio.fpgaUpdate');
					break;
				case "customFpga":
					vscode.commands.executeCommand('brilliant-ar-studio.fpgaUpdateCustom');
					break;
				case "firmwareUpdate":
					let deviceName = String(deviceInfo.name).toLowerCase();
					startFirmwareUpdate(deviceName);
					break;
				default:
					break;
			}
		  }
		);
	}
    public  resolveWebviewView (webviewView: vscode.WebviewView,  contextWebview: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken){
            webviewView.webview.options={
				enableScripts:true,localResourceRoots: [
				this._extensionUri,
			]
		};
		let updateScript:string = "";
		if(this._currentInfo){
			updateScript = 'updateUi(JSON.parse('+JSON.stringify(this._currentInfo)+'))';
		}
			this._view = webviewView;
            webviewView.webview.html=`<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Device Status</title>
				<style>
				a {
					color: var(--vscode-button-foreground); background-color: var(--vscode-button-background);
					box-sizing: border-box;
					display: flex;
					width: 100%;
					padding: 4px;
					border-radius: 2px;
					text-align: center;
					cursor: pointer;
					justify-content: center;
					align-items: center;
					border: 1px solid var(--vscode-button-border,transparent);
					line-height: 18px;
					text-decoration: none;
					max-width: 300px;
					
				}
				a:hover{
					color: var(--vscode-button-foreground); 
					background: var(--vscode-button-hoverBackground);
				}
				button {
					width: 80vw;
					max-width:300px;
					height: 28px;
					border-radius:2px;
					margin-top:0.3rem;
					margin-bottom:0.6rem;
					background: var(--vscode-button-background);
					border:  none;
					color: var(--vscode-button-foreground);
					cursor: pointer;
				}
				button:hover{
					background: var(--vscode-button-hoverBackground);
				}
				</style>
			</head>
			
			<body>
				<div>
				Device: <b id="name"></b><br>
				MAC address: <b id="macAddress"></b><br>
				Firmware version: <b id="firmwareVersion"></b><br>
				<a href="javascript:void(0)" id="firmwareUpdate" style="display:none;margin-top:0.5rem;margin-bottom:0.5rem;"></a>
				FPGA image: <b id="fpgaVersion"></b><br>
				<a href="javascript:void(0)" id="fpgaUpdate" style="display:none;margin-top:0.5rem;margin-bottom:0.5rem;"></a>
				<a href="javascript:void(0)" id="customFpga" style="margin-top:1rem">Custom FPGA</a>
				</div>
				<script>
				// To retain state
				const vscode = acquireVsCodeApi();
				// Check if we have an old state to restore from
				const previousState = vscode.getState();
				if(previousState){
					updateUi(previousState)
				}
				window.addEventListener('message', async (event) => {
					updateUi(event.data)
					
				})
				document.getElementById('firmwareUpdate').addEventListener('click',function(){
					vscode.postMessage("firmwareUpdate")
				})
				document.getElementById('fpgaUpdate').addEventListener('click',function(){
					vscode.postMessage("fpgaUpdate")
				})
				document.getElementById('customFpga').addEventListener('click',function(){
					vscode.postMessage("customFpga")
				})
				function updateUi(data){
					vscode.setState(data);
					if(!data){
						return;
					}
					document.getElementById('name').innerHTML = data.name;
					document.getElementById('macAddress').innerHTML = data.macAddress.toUpperCase();
					
					
					if(data.firmwareUpdate && data.firmwareUpdate !="Unknown"){
						document.getElementById('firmwareUpdate').innerHTML = 'Update to'+data.firmwareUpdate;
						document.getElementById('firmwareUpdate').style.display = 'block';
						document.getElementById('firmwareVersion').innerHTML = data.firmwareVersion;
					}else{
						document.getElementById('firmwareVersion').innerHTML = data.firmwareVersion + '(latest)';
						document.getElementById('firmwareUpdate').style.display = 'none';
						document.getElementById('firmwareUpdate').innerHTML = "(Latest)";
					}
					if (!data.name.toLowerCase().includes('frame')) {
						if(data.fpgaUpdate){
							document.getElementById('fpgaUpdate').innerHTML = 'Update to '+data.fpgaUpdate;
							document.getElementById('fpgaVersion').innerHTML = data.fpgaVersion;
							document.getElementById('fpgaUpdate').style.display = 'block';
						}else{
							document.getElementById('fpgaUpdate').style.display = 'none';
							document.getElementById('fpgaVersion').innerHTML = data.fpgaVersion+ '(latest)';
							document.getElementById('fpgaUpdate').innerHTML = "(Latest)";
						}
					}else{
						// hide fpga update for frame
						document.getElementById('fpgaUpdate').style.display = 'none';
						document.getElementById('fpgaVersion').innerHTML = "Built in";
						document.getElementById('customFpga').style.display = 'none';

					}
					
				}
				${updateScript}
				</script>
			</body>
			</html>`;
			this._setWebviewMessageListener(webviewView.webview);
			setTimeout(()=>this.updateValues(this._currentInfo),500);
    }

};
