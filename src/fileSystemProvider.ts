/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { file } from 'jszip';
import * as path from 'path';
import * as vscode from 'vscode';
import {listFilesDevice,createDirectoryDevice,creatUpdateFileDevice, deletFilesDevice,renameFileDevice} from './repl';
export class Snippet extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly description?: string,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);

		this.tooltip = `${this.description}`;
		this.description = this.description;
	}
	contextValue = 'category';
}

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
		this.command = {command:"brilliant-ar-studio.openDeviceFile",title:"Open In Editor",arguments:[{"path":this.path}]};
	}
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
	}
}

export type MonocleFile = File | Directory | ProjectEmptyTreeItem;

export class DeviceFs implements  vscode.TreeDataProvider<MonocleFile> {

	root = new Directory('');
	// --- manage file metadata
	allFiles:any[] = [];
	private _onDidChangeTreeData: vscode.EventEmitter<MonocleFile | undefined | void> = new vscode.EventEmitter<MonocleFile | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<MonocleFile | undefined | void> = this._onDidChangeTreeData.event;
	
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	async addFile(uri:vscode.Uri,devicePath:string){
		const basename = path.posix.basename(devicePath);
		let file = await vscode.workspace.fs.stat(uri);
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
	}
	async renameFile (oldDevicePath:string,newDevicePath:string){
		if(await renameFileDevice(oldDevicePath, newDevicePath)){
			this.refresh();
		}
	}

	async deleteFile(devicePath:string){
		if(await deletFilesDevice(devicePath)){
			this.refresh();
		}
	}

	getTreeItem(element: MonocleFile): vscode.TreeItem {
		return element;
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
					if(f.file){
						files.push(new File(f.name,rootPath,vscode.TreeItemCollapsibleState.None,));
					}else{
						files.push(new Directory(f.name,rootPath,vscode.TreeItemCollapsibleState.Collapsed));
					}
				});
				return files;
			}else{
				return [element];
			};
			
		}
		
		
		let topDirectory = await listFilesDevice();
		
		topDirectory.forEach((f:any)=>{
			rootPath = f.name;
			if(f.file){
				files.push(new File(f.name,rootPath));
			}else{
				files.push(new Directory(f.name,rootPath,vscode.TreeItemCollapsibleState.Collapsed));
			}
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
  