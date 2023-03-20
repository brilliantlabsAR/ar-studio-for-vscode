/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { file } from 'jszip';
import * as path from 'path';
import * as vscode from 'vscode';

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
	
	constructor(name: string,public readonly collapsibleState?: vscode.TreeItemCollapsibleState) {
		super(name, collapsibleState||vscode.TreeItemCollapsibleState.None);
		this.type = vscode.FileType.File;
		this.ctime = Date.now();
		this.mtime = Date.now();
		this.size = 0;
		this.name = name;
	}
}

export class Directory extends vscode.TreeItem implements vscode.FileStat {

	type: vscode.FileType;
	ctime: number;
	mtime: number;
	size: number;

	name: string;
	entries: Map<string, File | Directory>;

	constructor(name: string,public readonly collapsibleState?: vscode.TreeItemCollapsibleState) {
		super(name, collapsibleState||vscode.TreeItemCollapsibleState.None);
		this.type = vscode.FileType.Directory;
		this.ctime = Date.now();
		this.mtime = Date.now();
		this.size = 0;
		this.name = name;
		this.entries = new Map();
	}
}

export type Entry = File | Directory | ProjectEmptyTreeItem;

export class DeviceFs implements  vscode.TreeDataProvider<Entry>,vscode.FileSystemProvider {

	root = new Directory('');
	// --- manage file metadata
	allFiles:any[] = [];
	private _onDidChangeTreeData: vscode.EventEmitter<Entry | undefined | void> = new vscode.EventEmitter<Entry | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<Entry | undefined | void> = this._onDidChangeTreeData.event;
	
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	
	stat(uri: vscode.Uri): vscode.FileStat {
		return this._lookup(uri, false);
	}

	readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
		const entry = this._lookupAsDirectory(uri, false);
		const result: [string, vscode.FileType][] = [];
		for (const [name, child] of entry.entries) {
			result.push([name, child.type]);
		}
		return result;
	}

	// --- manage file contents

	readFile(uri: vscode.Uri): Uint8Array {
		const data = this._lookupAsFile(uri, false).data;
		if (data) {
			return data;
		}
		throw vscode.FileSystemError.FileNotFound();
	}
	addFile(uri:vscode.Uri,devicePath:string){
		this.allFiles.push(devicePath);
		this.refresh();
	}
	updateFile(uri:vscode.Uri,devicePath:string){
		// this.allFiles.push(devicePath);
		this.refresh();
	}
	deleteFile(devicePath:string){
		this.allFiles = this.allFiles.filter(p=>p!==devicePath);
		this.refresh();
	}
	writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void {
		const basename = path.posix.basename(uri.path);
		const parent = this._lookupParentDirectory(uri);
		let entry = parent.entries.get(basename);
		if (entry instanceof Directory) {
			throw vscode.FileSystemError.FileIsADirectory(uri);
		}
		if (!entry && !options.create) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}
		if (entry && options.create && !options.overwrite) {
			throw vscode.FileSystemError.FileExists(uri);
		}
		if (!entry) {
			entry = new File(basename);
			parent.entries.set(basename, entry);
			this._fireSoon({ type: vscode.FileChangeType.Created, uri });
		}
		entry.mtime = Date.now();
		entry.size = content.byteLength;
		entry.data = content;

		this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
	}

	// --- manage files/folders

	rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {

		if (!options.overwrite && this._lookup(newUri, true)) {
			throw vscode.FileSystemError.FileExists(newUri);
		}

		const entry = this._lookup(oldUri, false);
		const oldParent = this._lookupParentDirectory(oldUri);

		const newParent = this._lookupParentDirectory(newUri);
		const newName = path.posix.basename(newUri.path);

		oldParent.entries.delete(entry.name);
		entry.name = newName;
		newParent.entries.set(newName, entry);

		this._fireSoon(
			{ type: vscode.FileChangeType.Deleted, uri: oldUri },
			{ type: vscode.FileChangeType.Created, uri: newUri }
		);
	}

	delete(uri: vscode.Uri): void {
		const dirname = uri.with({ path: path.posix.dirname(uri.path) });
		const basename = path.posix.basename(uri.path);
		const parent = this._lookupAsDirectory(dirname, false);
		if (!parent.entries.has(basename)) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}
		parent.entries.delete(basename);
		parent.mtime = Date.now();
		parent.size -= 1;
		this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { uri, type: vscode.FileChangeType.Deleted });
	}

	createDirectory(uri: vscode.Uri): void {
		const basename = path.posix.basename(uri.path);
		const dirname = uri.with({ path: path.posix.dirname(uri.path) });
		const parent = this._lookupAsDirectory(dirname, false);

		const entry = new Directory(basename);
		parent.entries.set(entry.name, entry);
		parent.mtime = Date.now();
		parent.size += 1;
		this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });
	}

	getTreeItem(element: Entry): vscode.TreeItem {
		// const treeItem = new vscode.TreeItem(element.name, element.type === vscode.FileType.Directory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
		// if (element.type === vscode.FileType.File) {
		// 	// treeItem.command = { command: 'fileExplorer.openFile', title: "Open File", arguments: [element.uri], };
		// 	treeItem.contextValue = 'file';
		// }
		return element;
	}
	async getChildren(element?: Entry): Promise<Entry[]> {
		if (element) {
			if (element instanceof Directory) {
				return [new File('inside.py')];
			}else{
				return [element];
			};
			// return [new ProjectEmptyTreeItem()];
			// const result: Entry[] = [];
			// for (const [name, child] of element.entries) {
			// 	result.push([name, child.type]);
			// }
			// return result;
			// const children = await this.readDirectory(element.uri);
			// return children.map(([name, type]) => ({ uri: vscode.Uri.file(path.join(element.uri.fsPath, name)), type }));
		}
    //    fetch files from device
	if(this.allFiles.length!==0){
		let files:Entry[]= [];
		this.allFiles.forEach(path=>{
			// let entry = this._lookupAsDirectory(vscode.Uri.parse(path),true);
			files.push(new File(path));
		});
		return files;
	}
	let files:Entry[]= [];
	files.push(new Directory("testDir",vscode.TreeItemCollapsibleState.Collapsed));
	files.push(new File("file.py"));
	return files;
		// const workspaceFolder = (vscode.workspace.workspaceFolders ?? []).filter(folder => folder.uri.scheme === 'file')[0];
		// if (workspaceFolder) {
		// 	// const children =  this.readDirectory(workspaceFolder.uri);
		// 	const entry = this._lookupAsDirectory(vscode.Uri.parse(this.scheme), true);
		// 	const result: Entry[] = [];
		// 	for (const [name, child] of entry.entries) {
		// 		result.push(child);
		// 	}
		// 	return result;
		// 	// children.sort((a, b) => {
		// 	// 	if (a[1] === b[1]) {
		// 	// 		return a[0].localeCompare(b[0]);
		// 	// 	}
		// 	// 	return a[1] === vscode.FileType.Directory ? -1 : 1;
		// 	// });
		// 	// let entry = this._lookup( vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, "name")),true)
		// 	// return children.map((entry) => ({ uri: vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, "name")), type }));
		// 	// return children.map((entry)=>{
		// 	// 	if(entry.entries.lenth)
		// 	// });
		// 	// return entry;

		// }

		return [new ProjectEmptyTreeItem];
	}
	// --- lookup

	private _lookup(uri: vscode.Uri, silent: false): Entry;
	private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined;
	private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined {
		const parts = uri.path.split('/');
		let entry: Entry = this.root;
		for (const part of parts) {
			if (!part) {
				continue;
			}
			let child: Entry | undefined;
			if (entry instanceof Directory) {
				child = entry.entries.get(part);
			}
			if (!child) {
				if (!silent) {
					throw vscode.FileSystemError.FileNotFound(uri);
				} else {
					return undefined;
				}
			}
			entry = child;
		}
		return entry;
	}

	private _lookupAsDirectory(uri: vscode.Uri, silent: boolean): Directory {
		const entry = this._lookup(uri, silent);
		if (entry instanceof Directory) {
			return entry;
		}
		throw vscode.FileSystemError.FileNotADirectory(uri);
	}

	private _lookupAsFile(uri: vscode.Uri, silent: boolean): File {
		const entry = this._lookup(uri, silent);
		if (entry instanceof File) {
			return entry;
		}
		throw vscode.FileSystemError.FileIsADirectory(uri);
	}

	private _lookupParentDirectory(uri: vscode.Uri): Directory {
		const dirname = uri.with({ path: path.posix.dirname(uri.path) });
		return this._lookupAsDirectory(dirname, false);
	}

	// --- manage file events

	private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	private _bufferedEvents: vscode.FileChangeEvent[] = [];
	private _fireSoonHandle?: NodeJS.Timer;

	readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

	watch(_resource: vscode.Uri): vscode.Disposable {
		// ignore, fires for all changes...
		return new vscode.Disposable(() => { });
	}

	private _fireSoon(...events: vscode.FileChangeEvent[]): void {
		this._bufferedEvents.push(...events);

		if (this._fireSoonHandle) {
			clearTimeout(this._fireSoonHandle);
		}

		this._fireSoonHandle = setTimeout(() => {
			this._emitter.fire(this._bufferedEvents);
			this._bufferedEvents.length = 0;
		}, 5);
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
  