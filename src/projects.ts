import { request } from "@octokit/request";

export async function getRepoList(){
    let resp =  await request("GET /search/repositories?q={q}", {
        q: encodeURIComponent("monocle-ar in:topics"),
    }).catch((err:any)=>console.log(err));
    console.log(resp);
}
