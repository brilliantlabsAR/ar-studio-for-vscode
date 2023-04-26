/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { file } from 'jszip';
import * as path from 'path';
import * as vscode from 'vscode';
import {
	listFilesDevice,
	createDirectoryDevice,
	creatUpdateFileDevice, 
	deletFilesDevice,
	renameFileDevice, 
	readFileDevice,
	uploadFileBulkDevice
} from './repl';
import {deviceTreeProvider} from './extension';

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

export class DeviceFs implements  vscode.TreeDataProvider<MonocleFile>,vscode.TextDocumentContentProvider {

	root = new Directory('');
	// --- manage file metadata
	data:Map<string,MonocleFile> = new Map();
	private _onDidChangeTreeData: vscode.EventEmitter<MonocleFile | undefined | void> = new vscode.EventEmitter<MonocleFile | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<MonocleFile | undefined | void> = this._onDidChangeTreeData.event;
	
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	async addFile(uri:vscode.Uri,devicePath:string){
		const basename = path.posix.basename(devicePath);
		let file = await vscode.workspace.fs.stat(uri);
		let thisTreeItem = this.data.get(devicePath);
		if(thisTreeItem){
			deviceTreeProvider.reveal(thisTreeItem, { focus: false, select: true });
		}
		vscode.commands.executeCommand('setContext', 'monocle.fileInProgess',true );
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
		if(thisTreeItem){
			deviceTreeProvider.reveal(thisTreeItem, { focus: false, select: false });
		}
		vscode.commands.executeCommand('setContext', 'monocle.fileInProgess', false);
	}
	async updateFile(uri:vscode.Uri,devicePath:string){
		let thisTreeItem = this.data.get(devicePath);
		if(thisTreeItem){
			deviceTreeProvider.reveal(thisTreeItem, { focus: false, select: true });
		}
		vscode.commands.executeCommand('setContext', 'monocle.fileInProgess',true );
		
			if(await creatUpdateFileDevice(uri, devicePath)){
				
			}
		
		if(thisTreeItem){
			deviceTreeProvider.reveal(thisTreeItem, { focus: false, select: false });
		}
		vscode.commands.executeCommand('setContext', 'monocle.fileInProgess', false);
	}
	async updateFileBulk(files:vscode.Uri[],devicePath:string){
		if(await uploadFileBulkDevice(files,devicePath)){
			this.refresh();
		};
	}
	async renameFile (oldDevicePath:string,newDevicePath:string){
		let thisTreeItem = this.data.get(oldDevicePath);
		if(thisTreeItem){
			deviceTreeProvider.reveal(thisTreeItem, { focus: false, select: true });
		}
		vscode.commands.executeCommand('setContext', 'monocle.fileInProgess',true);
		if(await renameFileDevice(oldDevicePath, newDevicePath)){
			this.refresh();
		}
		if(thisTreeItem){
			deviceTreeProvider.reveal(thisTreeItem, { focus: false, select: false });
		}
		vscode.commands.executeCommand('setContext', 'monocle.fileInProgess', false);
	}
	
	async readFile (devicePath:string):Promise<string>{
		let data = await readFileDevice(devicePath);
		if(typeof data ==='string'){
			return data;
		}else{
			throw Error("Couldn't read file");
		}
		
		
	}

	async deleteFile(devicePath:string){
		let thisTreeItem = this.data.get(devicePath);
		if(thisTreeItem){
			deviceTreeProvider.reveal(thisTreeItem, { focus: false, select: true });
		}
		vscode.commands.executeCommand('setContext', 'monocle.fileInProgess',true);
		if(await deletFilesDevice(devicePath)){
			this.data.delete(devicePath);
			this.refresh();
		}
		if(thisTreeItem){
			deviceTreeProvider.reveal(thisTreeItem, { focus: false, select: false });
		}
		vscode.commands.executeCommand('setContext', 'monocle.fileInProgess', false);
	}
	async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
		// simply invoke cowsay, use uri-path as text
		let data = await this.readFile(uri.path);
		if(typeof data === 'string'){
			return data;
		}else{
			throw Error("Couldn't read file");
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
		return files;
	}

}

class ProjectEmptyTreeItem extends vscode.TreeItem implements vscode.FileStat {
	type: vscode.FileType;
	ctime: 0;
	mtime:0;
	size: 0;
	name :string;
	constructor() {
	  super("SELECT WORKSPACE", vscode.TreeItemCollapsibleState.None);
	  this.command = {
		title: "Select Workspace",
		tooltip: "Add Workspace to be synced with device",
		command: "brilliant-ar-studio.selectWorkspace",
	  };
	  this.type = vscode.FileType.Unknown;
	  this.ctime = 0;
	  this.mtime = 0;
	  this.size = 0;
	  this.name = "Select";
	}
  }

//   class DeviceContentProvider implements vscode.TextDocumentContentProvider {

// 	// emitter and its event
// 	onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
// 	onDidChange = this.onDidChangeEmitter.event;

// 	provideTextDocumentContent(uri: vscode.Uri): string {
// 		// simply invoke cowsay, use uri-path as text
// 		return cowsay.say({ text: uri.path });
// 	}
// };
  