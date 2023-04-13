import { request } from "@octokit/request";
import * as vscode from 'vscode';
let JSZIP = require("jszip");
// import fs from 'fs';
const TOPIC = 'monocle-ar-project';
export async function getRepoList(){
    let resp =  await request("GET /search/repositories?q={q}", {
        q: TOPIC+" in:topics",
    }).catch((err:any)=>console.log(err));
    // console.log(resp);
    return resp;
}

export class ProjectProvider implements vscode.TreeDataProvider<Project>, vscode.TreeDragAndDropController<Project> {

    dropMimeTypes = [];
	dragMimeTypes = ['application/vnd.code.tree.snippettemplates'];
	private _onDidChangeTreeData: vscode.EventEmitter<Project | undefined | void> = new vscode.EventEmitter<Project | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<Project | undefined | void> = this._onDidChangeTreeData.event;


    //  for drag 
    public async handleDrag(source: Project[], treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		treeDataTransfer.set('application/vnd.code.tree.snippettemplates', new vscode.DataTransferItem(source[0].label));
		return ;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Project): vscode.TreeItem {
		return element;
	}
	search(term:string){
console.log(term);
	}

	
	async getChildren(element?: Project): Promise<Project[]> {
        // return Promise.resolve(categories);
		if (element) {
            return  [element];
            
		} else {
            let categories:Project[] = [];
            let repoList:any =   await getRepoList();
			// console.log(repoList);
            if(repoList.data.items.length>0){
                repoList.data.items.forEach((repo:any)=>{
					let desc:string = repo.description?repo.full_name+" "+repo.description:repo.full_name;
                    categories.push(new Project(repo.name, repo.owner.avatar_url, repo.clone_url, desc));
                });
            }
            
            return categories;
		}

	}

}

export class Project extends vscode.TreeItem {

	constructor(
		public readonly label: string,
        public readonly icon :string,
		public readonly cloneurl: string,
		public readonly description?: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
		this.id = "project_"+label;
		this.tooltip = `${this.description}`;
		this.description = this.description;
        this.iconPath = icon;
		this.cloneurl = cloneurl;
	}


	contextValue = this.cloneurl;
}
export class GitOperation {
	scopes = ['read:user', 'user:email', 'repo', 'workflow'];
	auth:vscode.AuthenticationSession|null=null;
	
	async init(){
		this.auth = await vscode.authentication.getSession('github',this.scopes,{createIfNone:true});
	}
	getOwnerRepo(pushUrl:string){
		let ownerRepo = pushUrl.replace('https://github.com/','').replace('.git','').split('/');
		return {owner:ownerRepo[0],repo:ownerRepo[1]};
	}
	async  publishProject(pushUrl:string,unpublish=false){
			let {owner,repo} = this.getOwnerRepo(pushUrl);
			let names =  [
				TOPIC,
			];
			if(unpublish){
				names = [];
			}
			await request('PUT /repos/{owner}/{repo}/topics', {
					owner,
					repo,
					names:names,
					headers: await this.getHeader()
				}).catch(this.onError);

		  
	}
	async checkPublisStatus(pushUrl:string) {
			let {owner,repo} = this.getOwnerRepo(pushUrl);
			let resp = await request('GET /repos/{owner}/{repo}/topics', {
				owner,
				repo,
				headers: await this.getHeader()
			}).catch(this.onError);

			if(resp?.data.names.includes(TOPIC)){
				return true;
			}else{
				return false;
			}
		}
	
	async createFork(cloneurl:string,name:string) {
		
		let {owner,repo} = this.getOwnerRepo(cloneurl);
		let resp:any = await request('POST /repos/{owner}/{repo}/forks', {
			owner,
			repo,
			name,
			default_branch_only: true,
			headers: await this.getHeader()
		  }).catch(this.onError);
		  return resp;
	}
	async getArchiveZip(cloneurl:string,localPath:vscode.Uri){
		let {owner,repo} = this.getOwnerRepo(cloneurl);
		let resp:any = await request('GET /repos/{owner}/{repo}/zipball/{ref}', {
			owner,
			repo,
			ref: 'master',
			headers: await this.getHeader()
		  });
		//   localPath = vscode.Uri.joinPath(localPath,'test.zip');
		  let zip = await JSZIP.loadAsync(resp.data);
		  console.log(zip);
		//   vscode.workspace.fs.writeFile(localPath,Buffer.from(resp.data));
		//   console.log("file download",resp);
	}
	private async getHeader(){
		if(!this.auth){
			await this.init();
		}
		if(!this.auth){return;}
		return  {
			authorization: "token "+ this.auth.accessToken,
			  'X-GitHub-Api-Version': '2022-11-28'
			};
	}
	onError(err:any){
		vscode.window.showErrorMessage(String(err));
	}
}


// import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';

export function cloneAndOpenRepo(repoUrl:string,uri:vscode.Uri): void {


  // Clone the repository
  const gitClone = spawn('git', ['clone', repoUrl, uri.fsPath]);

  gitClone.on('exit', () => {
    // Open the cloned repository in VS Code
    const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0;
    const folderName = path.basename(uri.path);
    vscode.workspace.updateWorkspaceFolders(workspaceFolder, 0, { uri, name:folderName});
  });
}


// import { TreeDataProvider, TreeItem, TreeView } from 'vscode';

// class MyTreeDataProvider implements TreeDataProvider<MyTreeItem> {
//   // implementation of the TreeDataProvider interface
// }

// const treeDataProvider = new MyTreeDataProvider();
// const treeView = vscode.window.createTreeView('myTree', { treeDataProvider });
	
// // add a search bar to the tree view
// treeView.onDidChangeVisibility(() => {
//   if (treeView.visible) {
//     const disposable = commands.registerCommand('myTree.search', async () => {
//       const searchTerm = await window.showInputBox({ prompt: 'Search' });
//       if (searchTerm) {
//         const items = await treeDataProvider.search(searchTerm);
//         // treeView.dataProvider = new MyTreeDataProvider(items);
//       }
//     });
//     // treeView.message = { text: 'Search: "Ctrl+Shift+F"' };
//     // treeView.onDidDispose(() => disposable.dispose());
//   } else {
//     // treeView.message = undefined;
//   }
// });

