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
import {deviceTreeProvider, isPathExist, monocleFolder,screenFolder} from './extension';
import { isConnected } from './bluetooth';

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
		if(isConnected()){
			return files;
		}else{
			return [];
		}
		
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
			const localFiles = vscode.Uri.joinPath(rootUri,monocleFolder);
			
			if(await isPathExist(localFiles)){
				const screenFiles = new vscode.RelativePattern(localFiles, screenFolder+'/*_screen.py');
				const filesFound = await vscode.workspace.findFiles(screenFiles);
				if(filesFound.length===0){
					return [];
				}else{
					return filesFound.map(f=>{
						let filename = path.posix.basename(f.path);
						let newitem = new vscode.TreeItem(filename.replace('_screen.py',''),vscode.TreeItemCollapsibleState.None);
						newitem.iconPath = vscode.ThemeIcon.File;
						newitem.command =  {command:"brilliant-ar-studio.editUIEditor",title:"Edit In UI Editor",arguments:[{"uri":f,"name":filename.replace('_screen.py','')}]};
						return newitem;
					});
				}
			}else{
				
				vscode.window.showWarningMessage("Project not initialized!");
				return [];
			}
		}else{
			return [];
		}
		
	}
}