import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import {snippets} from '.';
export class SnippetProvider implements vscode.TreeDataProvider<Snippet>, vscode.TreeDragAndDropController<Snippet> {

    dropMimeTypes = [];
	dragMimeTypes = ['application/vnd.code.tree.snippettemplates'];
	private _onDidChangeTreeData: vscode.EventEmitter<Snippet | undefined | void> = new vscode.EventEmitter<Snippet | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<Snippet | undefined | void> = this._onDidChangeTreeData.event;

	private dragDataEmitter = new vscode.EventEmitter<any>();
  public readonly onDragData = this.dragDataEmitter.event;


    //  for drag 
    public async handleDrag(source: Snippet[], treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		treeDataTransfer.set('application/vnd.code.tree.snippettemplates', new vscode.DataTransferItem(source[0].label));
		return ;
	}

   returnData(){
	return this.dropMimeTypes;
   }

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Snippet): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Snippet): Thenable<Snippet[]> {
        // return Promise.resolve(categories);
		if (element) {
            let snippetCodes = snippets[element.label];
            let snippetItems:Snippet[] = [];
            Object.keys(snippetCodes).forEach((item:any)=>{
                let cmd = {
                    			command: 'editor.action.insertSnippet',
                    			title: 'Use Snippet',
                    			arguments: [{ langId: "python", name: item }]
                    		};
                snippetItems.push(new Snippet(item,vscode.TreeItemCollapsibleState.None,snippetCodes[item].description,cmd,snippetCodes[item].id));
            });
			return Promise.resolve(snippetItems);
		} else {
            let categories:Snippet[] = [];
            // console.log(JSON.stringify(snippets.display));
            Object.keys(snippets).forEach(key=>{
                categories.push(new Snippet(key,vscode.TreeItemCollapsibleState.Collapsed,key));
            }); 
            return Promise.resolve(categories);
		}
	}
}

export class Snippet extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly description?: string,
		public readonly command?: vscode.Command,
		public readonly id?: string,

	) {
		super(label, collapsibleState);
		this.id = "snippet_"+label;
		this.tooltip = `${this.description}`;
		this.description = this.description;
	}


	contextValue = 'snippet';
}
