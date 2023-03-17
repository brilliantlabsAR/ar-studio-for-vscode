import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import {snippets} from '.';
export class DepNodeProvider implements vscode.TreeDataProvider<Snippet>, vscode.TreeDragAndDropController<Snippet> {

    dropMimeTypes = [];
	dragMimeTypes = ['application/vnd.code.tree.snippettemplates'];
	private _onDidChangeTreeData: vscode.EventEmitter<Snippet | undefined | void> = new vscode.EventEmitter<Snippet | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<Snippet | undefined | void> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string | undefined) {
	}


    //  for drag 
    public async handleDrag(source: Snippet[], treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		treeDataTransfer.set('application/vnd.code.tree.snippettemplates', new vscode.DataTransferItem(source[0].label));
		return ;
	}

    // public async handleDrop(target: any | undefined, sources: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
	// 	const transferItem = sources.get('application/vnd.code.tree.depNodeProvider');
	// 	// console.log(target.transferItem);
    //     // // if (!transferItem) {
	// 	// // 	return;
	// 	// // }
	// 	// // const treeItems: Node[] = transferItem.value;
	// 	// // let roots = this._getLocalRoots(treeItems);
	// 	// // // Remove nodes that are already target's parent nodes
	// 	// // roots = roots.filter(r => !this._isChild(this._getTreeElement(r.key), target));
	// 	// // if (roots.length > 0) {
	// 	// // 	// Reload parents of the moving elements
	// 	// // 	const parents = roots.map(r => this.getParent(r));
	// 	// // 	roots.forEach(r => this._reparentNode(r, target));
	// 	// // 	this._onDidChangeTreeData.fire([...parents, target]);
	// 	// // }
	// }
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
                snippetItems.push(new Snippet(item,vscode.TreeItemCollapsibleState.None,snippetCodes[item].description,cmd));
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
		// if (this.pathExists(packageJsonPath) && workspaceRoot) {
			const packageJson = JSON.parse(fs.readFileSync(snippetsJson, 'utf-8'));
            console.log(JSON.stringify(packageJson));
			// const toDep = (moduleName: string, version: string): Snippet => {
			// 	if (this.pathExists(path.join(workspaceRoot, 'node_modules', moduleName))) {
			// 		return new Snippet(moduleName, version, vscode.TreeItemCollapsibleState.Collapsed);
			// 	} else {
			// 		return new Snippet(moduleName, version, vscode.TreeItemCollapsibleState.None, {
			// 			command: 'extension.openPackageOnNpm',
			// 			title: '',
			// 			arguments: [moduleName]
			// 		});
			// 	}
			// };

			// const deps = packageJson.dependencies
			// 	? Object.keys(packageJson.dependencies).map(dep => toDep(dep, packageJson.dependencies[dep]))
			// 	: [];
			// const devDeps = packageJson.devDependencies
			// 	? Object.keys(packageJson.devDependencies).map(dep => toDep(dep, packageJson.devDependencies[dep]))
			// 	: [];
			// return deps.concat(devDeps);
		// } else {
			return [];
		// }
	}

	// private pathExists(p: string): boolean {
	// 	try {
	// 		fs.accessSync(p);
	// 	} catch (err) {
	// 		return false;
	// 	}

	// 	return true;
	// }
}

export class Snippet extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly description?: string,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
		this.id = "snippet_"+label;
		this.tooltip = `${this.description}`;
		this.description = this.description;
	}


	contextValue = 'category';
}
