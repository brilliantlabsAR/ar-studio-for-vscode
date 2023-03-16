import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { EventEmitter } from 'vscode';



import {snippets} from './snippets';
export class DepNodeProvider implements vscode.TreeDataProvider<Snippet>, vscode.TreeDragAndDropController<Snippet> {

    dropMimeTypes :any= [];
	dragMimeTypes = ['application/vnd.code.tree.depNodeProvider'];

	private _onDidChangeTreeData: vscode.EventEmitter<Snippet | undefined | void> = new vscode.EventEmitter<Snippet | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<Snippet | undefined | void> = this._onDidChangeTreeData.event;

	private dragDataEmitter = new EventEmitter<any>();
  public readonly onDragData = this.dragDataEmitter.event;


	constructor(private workspaceRoot: string | undefined) {
	}



	

    //  for drag 
    public async handleDrag(source: Snippet[], treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		console.log(JSON.parse(JSON.stringify(source)));
		// this.dropMimeTypes.push(source);
		// this.dropMimeTypes.push(JSON.stringify(source));
		treeDataTransfer.set('application/vnd.code.tree.depNodeProvider', new vscode.DataTransferItem(source));
		
		// this.dragDataEmitter.fire(source);

		//this._onDidChangeDragValue.fire(source);
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
                categories.push(new Snippet(key,vscode.TreeItemCollapsibleState.Collapsed));
            });
            return Promise.resolve(categories);
		}

	}

	/**
	 * Given the path to package.json, read all its dependencies and devDependencies.
	 */
	private getDepsInPackageJson(packageJsonPath: string): Snippet[] {
		// const workspaceRoot = this.workspaceRoot;
            let snippetsJson = "../../snippets/display.json";
            console.log(JSON.stringify(snippets.display));
            Object.keys(snippets).forEach(key=>{

            });
			const packageJson = JSON.parse(fs.readFileSync(snippetsJson, 'utf-8'));
            console.log(JSON.stringify(packageJson));
		
			return [];
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

		this.tooltip = `${this.description}`;
		this.description = this.description;
	}


	contextValue = 'category';
}
