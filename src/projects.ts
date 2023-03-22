import { request } from "@octokit/request";
import * as vscode from 'vscode';

export async function getRepoList(){
    let resp =  await request("GET /search/repositories?q={q}", {
        q: "monocle-ar-project in:topics",
    }).catch((err:any)=>console.log(err));
    console.log(resp);
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

	
	async getChildren(element?: Project): Promise<Project[]> {
        // return Promise.resolve(categories);
		if (element) {
            return  [element];
            
		} else {
            let categories:Project[] = [];
            let repoList:any =   await getRepoList();
            if(repoList.data.items.length>0){
                repoList.data.items.forEach((repo:any)=>{
                    categories.push(new Project(repo.name,repo.owner.avatar_url,repo.full_name+" "+repo.description));
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
		public readonly description?: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
		this.id = "project_"+label;
		this.tooltip = `${this.description}`;
		this.description = this.description;
        this.iconPath = icon;
	}


	contextValue = 'category';
}
export async function publishProject(pushUrl:string){
    const SCOPES = ['read:user', 'user:email', 'repo', 'workflow'];
	let auth = await vscode.authentication.getSession('github',SCOPES,{createIfNone:true});
	let repoPath = pushUrl.replace('https://github.com/','').replace('.git','').split('/');
	await request('PUT /repos/{owner}/{repo}/topics', {
			owner: repoPath[0],
			repo: repoPath[1],
			names: [
			  'monocle-ar-project',
			],
			headers: {
			   authorization: "token "+auth.accessToken,
			  'X-GitHub-Api-Version': '2022-11-28'
			}
		  });
	  
}

