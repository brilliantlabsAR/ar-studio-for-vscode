import * as vscode from 'vscode';
import { isPathExist } from './extension';

export class UIEditorPanel {
    public static currentPanel: UIEditorPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private screenName:string;
    private screenPath:vscode.Uri;
    
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri,screenName:string,screenPath:vscode.Uri) {
      this._panel = panel;
      this.screenName= screenName;
      this.screenPath= screenPath;
      this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
      this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);
      this._setWebviewMessageListener(this._panel.webview);
      this.updatePy([],true);
    }

    public static render(extensionUri: vscode.Uri,screenName:string,screenPath:vscode.Uri) {
        if (UIEditorPanel.currentPanel) {
          UIEditorPanel.currentPanel.dispose();
        } 

          const panel = vscode.window.createWebviewPanel(screenName, screenName, vscode.ViewColumn.Two, {
            // Enable javascript in the webview
            enableScripts: true,
            // Restrict the webview to only load resources from the `out` directory
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
          });
    
          UIEditorPanel.currentPanel = new UIEditorPanel(panel,extensionUri,screenName,screenPath);
          
      }
      public dispose() {
        UIEditorPanel.currentPanel = undefined;
    
        this._panel.dispose();
    
        while (this._disposables.length) {
          const disposable = this._disposables.pop();
          if (disposable) {
            disposable.dispose();
          }
        }
      }
      private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
        const webviewUri = getUri(webview, extensionUri, ["media" ,"conva.min.js"]);
        const mainJsUri = getUri(webview, extensionUri, ["media" ,"main.js"]);
        const nonce = getNonce();
        const stylesMainUri = getUri(webview, extensionUri, ["media" ,"main.css"]);
        // const fontawesomeUri = getUri(webview, extensionUri, ["media" ,"fontawesome.css"]);
        const thickness = getUri(webview, extensionUri, ["media","icons", "thickness_icon.png"]);
        const top = getUri(webview, extensionUri, ["media", "icons","top.png"]);
        const left = getUri(webview, extensionUri, ["media", "icons","left.png"]);
        const center = getUri(webview, extensionUri, ["media", "icons","center.png"]);
        const middle = getUri(webview, extensionUri, ["media", "icons","middle.png"]);
        const bottom = getUri(webview, extensionUri, ["media", "icons","bottom.png"]);
        const right = getUri(webview, extensionUri, ["media", "icons","right.png"]);
        const rect = getUri(webview, extensionUri, ["media", "icons","rect.png"]);
        const polygon = getUri(webview, extensionUri, ["media", "icons","polygon.png"]);
        const line = getUri(webview, extensionUri, ["media", "icons","line.png"]);
        const polyline = getUri(webview, extensionUri, ["media", "icons","polyline.png"]);
        const text = getUri(webview, extensionUri, ["media", "icons","text.png"]);
        // const fontUri = getUri(webview, extensionUri, ["media" ,"JetBrains_Mono/JetBrainsMono-VariableFont_wght.ttf"]);
        return /*html*/ `
          <!DOCTYPE html>
          <html lang="en">
            <head>

              <meta charset="UTF-8">
              <meta charset="utf-8" />
              <title>${this.screenName}</title>
              <link  rel="stylesheet" nonce="${nonce}" href="${stylesMainUri}">
             
          
            <body>
              <div class="main">
              <div class="tools">
              <button id="rect" class="shape-btn" value="RECT"><img src="${rect}" /></button>
              <button id="straightLine" class="shape-btn" value="STRAIGHTLINE"><img src="${line}" /></button>
              <button id="polyLine" class="shape-btn" value="POLYLINE"><img src="${polyline}" /></button>
              <button id="polygone" class="shape-btn" value="POLYGONE"><img src="${polygon}" /></button>

              <button id="addText" class="shape-btn" value="ADDTEXT" style="margin-right:2rem;"><img src="${text}" /></button>
              <input type="color" value="#afafaf" name="colorselection" id="colorselection">
              <button class="thickness" id="thicknessBtn" >
                <img src="${thickness}" />
                <span>1</span>
              </button>
              <div id="myDropdown" style="display: none;">
                <ul>
                  <li class="t-op" data-thick="1"> 1</li>
                  <li class="t-op" data-thick="2"> 2</li>
                  <li class="t-op" data-thick="3"> 3</li>
                  <li class="t-op" data-thick="4"> 4</li>
                  <li class="t-op" data-thick="5"> 5</li>
                  <li class="t-op" data-thick="6"> 6</li>
                  <li class="t-op" data-thick="7"> 7</li>
                  <li class="t-op" data-thick="8"> 8</li>
                  <li class="t-op" data-thick="9"> 9</li>
                </ul>
              </div>
              <button id="alignLeft" value="LEFT" class="alignBtn active hz"><img src="${left}" /></button>
              <button id="alignCenter" value="CENTER" class="alignBtn hz"><img src="${center}" /></button>
              <button id="alignRight" value="RIGHT" class="alignBtn hz"><img src="${right}" /></button>
              <button id="alignTOP" value="TOP" class="alignBtn active vt"><img src="${top}" /></button>
              <button id="alignMiddle" value="MIDDLE" class="alignBtn vt"><img src="${middle}" /></button>
              <button id="alignBottom" value="BOTTOM" class="alignBtn vt"><img src="${bottom}" /></button> 
              <button id="delete" >&#10761;</button>
              </div>
                <div id="container"></div>
              </div>
              <script type="text/javaScript" nonce="${nonce}" src="${webviewUri}"></script>
              <script type="text/javaScript" nonce="${nonce}" src="${mainJsUri}"></script>
            </body>
          </html>
        `;
      }
      private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
          (message: any) => {
              this.updatePy(message);
          },
          undefined,
          this._disposables
        );
      }

      public async updateGUI(){
        let existingDataBin = await vscode.workspace.fs.readFile(this.screenPath);
        try {
          let existingData =  existingDataBin.toString();
          let allblocks = existingData.slice(existingData.indexOf('blocks=[')+8,existingData.indexOf(']##'));
          let allblocksArray = allblocks.split('\t\td.').filter(d=>d!=='').map(d=>d.trim());
          let uiObjs:object[] = [];
          allblocksArray.forEach(block=>{
            let shape = block.slice(0,block.indexOf("("));
            if(shape==='Rectangle'){
              let attrs = block.slice(block.indexOf("(")+1,block.indexOf(")")).split(",").map(d=>d.trim());
              uiObjs.push({
                name:"rect",
                x: parseInt(attrs[0]),
                y: parseInt(attrs[1]),
                width: parseInt(attrs[2])-parseInt(attrs[0]),
                height: parseInt(attrs[3])-parseInt(attrs[1]),
                fill: "#"+attrs[4].replace("0x",""),
                draggable: true,
              });
            }
            if(shape==='Line'){
              let attrs = block.slice(block.indexOf("(")+1,block.indexOf(")")).split(",").map(d=>d.trim());
              uiObjs.push({
                name:"line",
                points: [parseInt(attrs[0]), parseInt(attrs[1]), parseInt(attrs[2]), parseInt(attrs[3])],
                stroke: "#"+attrs[4].replace("0x",""),
                strokeWidth: parseInt(attrs[5].replaceAll(" ","").replace('thickness=',"")),
              });
            }
            if(shape==='Polyline'){
              let points = block.slice(block.indexOf('['),block.indexOf(']')+1);
              let newblock = block.replace(points,'');
              let attrs = newblock.slice(newblock.indexOf("(")+1,newblock.indexOf(")")).split(",").filter(d=>d!=='').map(d=>d.trim());
              uiObjs.push({
                name:"polyline",
                points: JSON.parse(points),
                stroke: "#"+attrs[0].replace("0x",""),
                strokeWidth: parseInt(attrs[1].replaceAll(" ","").replace('thickness=',"")),
              });
            }
            if(shape==='Polygon'){
              let points = block.slice(block.indexOf('['),block.indexOf(']')+1);
              let newblock = block.replace(points,'');
              let attrs = newblock.slice(newblock.indexOf("(")+1,newblock.indexOf(")")).split(",").filter(d=>d!=='').map(d=>d.trim());
              uiObjs.push({
                name:"polygone",
                points: JSON.parse(points),
                fill: "#"+attrs[0].replace("0x",""),
                stroke: "#"+attrs[0].replace("0x",""),
                strokeWidth: 1,
                closed:true
              });
            }
            if(shape==='Text'){
              let attrs = block.slice(block.indexOf("(")+1,block.indexOf(")")).split(",").map(d=>d.trim());
              uiObjs.push({
                name:"text",
                text: attrs[0].slice(1,attrs[0].length-1),
                x: parseInt(attrs[1]),
                y: parseInt(attrs[2]),
                fill: "#"+attrs[3].replace("0x",""),
                alignment: attrs[4].replaceAll(" ","").replace('justify=d.',""),
                draggable: true,
              });
            }
          });
          this._panel.webview.postMessage(uiObjs);
        } catch (error) {
          console.log(error)
          vscode.window.showErrorMessage("File parsing failed! probably unknown structure");
        }
       
      }
      public async updatePy(data:object[]=[],firstload=false){
        if(await isPathExist(this.screenPath) && data.length===0 && firstload ){
          this.updateGUI();
        }else{
          let pystring = gUItoPython(data,this.screenName);
          vscode.workspace.fs.writeFile(this.screenPath,Buffer.from(pystring));
        }
      }
  }

  export function getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) {
    return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
  }
  export function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }


  function gUItoPython(data:object[],screenName:string){
      const initialMessage = '# GENERATED BY BRILLIANT AR STUDIO Do not modify this file directly\nimport display as d\n\n';
      let finalPyString ="";
      if(data.length===0){
        finalPyString += initialMessage +  'class '+screenName+':\n\tblocks=[]## dont\'t remove this #';
      }else{
        finalPyString += initialMessage +  'class '+screenName+':\n\tblocks=[';
      }
      data.forEach((uiElement:any,index:number)=>{
        if(uiElement.name==='rect'){
          finalPyString += `\n\t\td.Rectangle(${Math.round(uiElement.x)}, ${Math.round(uiElement.y)}, ${Math.round(uiElement.x+uiElement.width)}, ${Math.round(uiElement.y+uiElement.height)}, 0x${uiElement.fill.replace("#","")}),`;
        }
        if(uiElement.name==='line'){
          finalPyString += `\n\t\td.Line(${Math.round(uiElement.points[0])}, ${Math.round(uiElement.points[1])}, ${Math.round(uiElement.points[2])}, ${Math.round(uiElement.points[3])}, 0x${uiElement.stroke.replace("#","")}, thickness=${uiElement.strokeWidth}),`;

        }
        if(uiElement.name==='polyline'){
          finalPyString += `\n\t\td.Polyline([${uiElement.points.map((point:number)=>Math.round(point)).join(',')}], 0x${uiElement.stroke.replace("#","")}, thickness=${uiElement.strokeWidth}),`;

        }
        if(uiElement.name==='polygone'){
          finalPyString += `\n\t\td.Polygon([${uiElement.points.map((point:number)=>Math.round(point)).join(',')}], 0x${uiElement.fill.replace("#","")}),`;

        }
        if(uiElement.name==='text'){
          finalPyString += `\n\t\td.Text('${uiElement.text}', ${Math.round(uiElement.x)}, ${Math.round(uiElement.y)}, 0x${uiElement.fill.replace("#","")}, justify=d.${uiElement.alignment}),`;

        }
      });
      if(data.length!==0){
        finalPyString +='\n\t]## dont\'t remove this #';
      }
      finalPyString +=`\n\tdef __init__(self):\n\t\td.show(self.blocks)`;

      finalPyString +="\n\n\n# To use this in main.py screen import into main.py or copy below code in main.py\n# from screens."+screenName+"_screen import "+screenName+"\n"+screenName+"()";
      return finalPyString;

  }