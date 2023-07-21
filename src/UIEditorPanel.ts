import * as vscode from "vscode";
import { isPathExist } from "./extension";
const CUSTOMCOLOR:any = {
  RED: '#ad2323',
  GREEN: '#1d6914',
  BLUE: '#2a4bd7',
  CYAN: '#29d0d0',
  MAGENTA: '#8126c0',
  YELLOW: '#ffee33',
  WHITE: '#ffffff',
  GRAY1: '#1c1c1c',
  GRAY2: '#383838',
  GRAY3: '#555555',
  GRAY4: '#717171',
  GRAY5: '#8d8d8d',
  GRAY6: '#aaaaaa',
  GRAY7: '#c6c6c6',
  GRAY8: '#e2e2e2',
};
export class UIEditorPanel {
  public static currentPanel: UIEditorPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private screenName: string;
  private screenPath: vscode.Uri;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    screenName: string,
    screenPath: vscode.Uri
  ) {
    this._panel = panel;
    this.screenName = screenName;
    this.screenPath = screenPath;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getWebviewContent(
      this._panel.webview,
      extensionUri
    );
    this._setWebviewMessageListener(this._panel.webview);
    this.updatePy([], true);
  }

  public static render(
    extensionUri: vscode.Uri,
    screenName: string,
    screenPath: vscode.Uri
  ) {
    if (UIEditorPanel.currentPanel) {
      UIEditorPanel.currentPanel.dispose();
    }

    const panel = vscode.window.createWebviewPanel(
      screenName,
      screenName,
      vscode.ViewColumn.Two,
      {
        // Enable javascript in the webview
        enableScripts: true,
        // Restrict the webview to only load resources from the `out` directory
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    UIEditorPanel.currentPanel = new UIEditorPanel(
      panel,
      extensionUri,
      screenName,
      screenPath
    );
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
  private _getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri
  ) {
    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    const webviewUri = getUri(webview, extensionUri, ["media", "conva.min.js"]);
    const mainJsUri = getUri(webview, extensionUri, ["media", "main.js"]);
    const nonce = getNonce();
    const stylesMainUri = getUri(webview, extensionUri, ["media", "main.css"]);
    // const fontawesomeUri = getUri(webview, extensionUri, ["media" ,"fontawesome.css"]);
    const thickness = getUri(webview, extensionUri, [
      "media",
      "icons",
      "thickness_icon.svg",
    ]);
    const top = getUri(webview, extensionUri, ["media", "icons", "top.svg"]);
    const left = getUri(webview, extensionUri, ["media", "icons", "left.svg"]);
    const center = getUri(webview, extensionUri, [
      "media",
      "icons",
      "center.svg",
    ]);
    const middle = getUri(webview, extensionUri, [
      "media",
      "icons",
      "middle.svg",
    ]);
    const bottom = getUri(webview, extensionUri, [
      "media",
      "icons",
      "bottom.svg",
    ]);
    const right = getUri(webview, extensionUri, [
      "media",
      "icons",
      "right.svg",
    ]);
    const rect = getUri(webview, extensionUri, ["media", "icons", "rect.svg"]);
    const polygon = getUri(webview, extensionUri, [
      "media",
      "icons",
      "polygon.png",
    ]);
    const line = getUri(webview, extensionUri, ["media", "icons", "line.svg"]);
    const polyline = getUri(webview, extensionUri, [
      "media",
      "icons",
      "polyline.png",
    ]);
    const text = getUri(webview, extensionUri, ["media", "icons", "text.svg"]);
    const eraser = getUri(webview, extensionUri, [
      "media",
      "icons",
      "eraser.png",
    ]);
    const paintBrush = getUri(webview, extensionUri, [
      "media",
      "icons",
      "paintbrush.png",
    ]);

    // const fontUri = getUri(webview, extensionUri, ["media" ,"JetBrains_Mono/JetBrainsMono-VariableFont_wght.ttf"]);
    return /*html*/ `
        <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta charset="utf-8" />
  <title>Konva Select and Transform Demo</title>
 <link  rel="stylesheet" nonce="${nonce}" href="${stylesMainUri}"> 
</head>
<body>
<div class="main">
  <div class="tools">
    <div class="shapes">
      <span class="tool_title">Shapes</span>
      <div class="shape_items">
        <div class="item">
          <button id="rect" class="shape-btn" value="RECT"><img src="${rect}" /></button>
        </div>
        <div class="item">
          <button id="straightLine" class="shape-btn" value="STRAIGHTLINE"><img src="${line}" /></button>
        </div>
        <div class="item">
          <button id="polyLine" class="shape-btn" value="POLYLINE"><img src="${polyline}" /></button>
        </div>
        <div class="item">
          <button id="polygone" class="shape-btn" value="POLYGONE"><img src="${polygon}" /></button>
        </div>
        <div class="item">
          <button id="addText" class="shape-btn" value="ADDTEXT" style="margin-right:2rem;"><img
              src="${text}" /></button>
        </div>
      </div>
    </div>
    <div class="tools_n_options">
      <span class="tool_title">tools and options</span>
      <div class="tools_items">
        <div class="item">
          <div class="color_picker_box">
            <div class="d-flex aic">
            <div class="cpic-box">

              <img src="${paintBrush}" alt="" >

              </div>
              <div class="color_pick" id="selected_color_custom">
              <input type="color" value="#afafaf" name="colorselection" id="colorselection" class="colorselection img_brush" >

              </div>

              <div class="color_pick" id="selected_color"></div>
            </div>


            <div class="picker_box" id="pigment_pick">
              <div class="item">
                <div class="pigment_box" style="background-color: #ad2323;" data-color="RED"></div>
              </div>
              <div class="item">
                <div class="pigment_box" style="background-color: #1d6914;" data-color="GREEN"></div>
              </div>
              <div class="item">
                <div class="pigment_box" style="background-color: #2a4bd7;" data-color="BLUE"></div>
              </div>
              <div class="item">
                <div class="pigment_box" style="background-color: #29d0d0;" data-color="CYAN"></div>
              </div>
              <div class="item">
                <div class="pigment_box" style="background-color: #8126c0;" data-color="MAGENTA"></div>
              </div>
              <div class="item">
                <div class="pigment_box" style="background-color: #ffee33;" data-color="YELLOW"></div>
              </div>
              <div class="item">
                <div class="pigment_box" style="background-color: #ffffff;" data-color="WHITE"></div>
              </div>
              <div class="item">
                <div class="pigment_box" style="background-color: #1c1c1c;" data-color="GRAY1"></div>
              </div>
              <div class="item">
                <div class="pigment_box" style="background-color: #383838;" data-color="GRAY2"></div>
              </div>
              <div class="item">
                <div class="pigment_box" style="background-color: #555555;" data-color="GRAY3"></div>
              </div>
              <div class="item">
                <div class="pigment_box" style="background-color: #717171;" data-color="GRAY4"></div>
              </div>
              <div class="item">
                <div class="pigment_box" style="background-color: #8d8d8d;" data-color="GRAY5"></div>
              </div>
              <div class="item">
                <div class="pigment_box" style="background-color: #aaaaaa;" data-color="GRAY6"></div>
              </div>
              <div class="item">
                <div class="pigment_box" style="background-color: #c6c6c6;" data-color="GRAY7"></div>
              </div>
              <div class="item">
                <div class="pigment_box" style="background-color: #e2e2e2;" data-color="GRAY8"></div>
              </div>

            </div>
          </div>
        </div>
        <div class="item">
          <div class="thickness_dropdown">
            <button class="thickness" id="thicknessBtn">
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
          </div>
        </div>
        <div class="item">
          <button id="alignLeft" value="LEFT" class="alignBtn active hz"><img src="${left}" /></button>
        </div>
        <div class="item">
          <button id="alignCenter" value="CENTER" class="alignBtn hz"><img src="${center}" /></button>
        </div>
        <div class="item">
          <button id="alignRight" value="RIGHT" class="alignBtn hz"><img src="${right}" /></button>
        </div>
        <div class="item">
          <button id="alignTOP" value="TOP" class="alignBtn active vt"><img src="${top}" /></button>
        </div>
        <div class="item">
          <button id="alignMiddle" value="MIDDLE" class="alignBtn vt"><img src="${middle}" /></button>
        </div>
        <div class="item">
          <button id="alignBottom" value="BOTTOM" class="alignBtn vt"><img src="${bottom}" /></button>
        </div>
        <div class="item">
          <button id="delete"><img src="${eraser}" /></button>
        </div>
      </div>
    </div>

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

  public async updateGUI() {
    let existingDataBin = await vscode.workspace.fs.readFile(this.screenPath);
    try {
      let existingData = existingDataBin.toString();
      let allblocks = existingData.slice(
        existingData.indexOf("screen=[") + 8,
        existingData.indexOf("]##")
      );
      let allblocksArray = allblocks
        .split("\t\td.")
        .filter((d) => d !== "")
        .map((d) => d.trim());
      let uiObjs: object[] = [];
      allblocksArray.forEach((block) => {
        let shape = block.slice(0, block.indexOf("("));
        if (shape === "Rectangle") {
          let attrs = block
            .slice(block.indexOf("(") + 1, block.indexOf(")"))
            .split(",")
            .map((d) => d.trim());
          let colorname = String(attrs[4]).includes("d.")?String(attrs[4]).replace("d.",""):false;
          let colorvalue = "#" + attrs[4].replace("0x", "");
          if(colorname){
            colorvalue= CUSTOMCOLOR[colorname];
          }
          uiObjs.push({
            name: "rect",
            x: parseInt(attrs[0]),
            y: parseInt(attrs[1]),
            width: parseInt(attrs[2]) - parseInt(attrs[0]),
            height: parseInt(attrs[3]) - parseInt(attrs[1]),
            fill:colorvalue,
            draggable: true,
            colorname
          });
        }
        if (shape === "Line") {
          let attrs = block
            .slice(block.indexOf("(") + 1, block.indexOf(")"))
            .split(",")
            .map((d) => d.trim());
          let colorname = String(attrs[4]).includes("d.")?String(attrs[4]).replace("d.",""):false;
          let colorvalue = "#" + attrs[4].replace("0x", "");
          if(colorname){
            colorvalue= CUSTOMCOLOR[colorname];
          }
          uiObjs.push({
            name: "line",
            points: [
              parseInt(attrs[0]),
              parseInt(attrs[1]),
              parseInt(attrs[2]),
              parseInt(attrs[3]),
            ],
            stroke: colorvalue,
            strokeWidth: parseInt(
              attrs[5].replaceAll(" ", "").replace("thickness=", "")
            ),
            colorname
          });
        }
        if (shape === "Polyline") {
          let points = block.slice(block.indexOf("["), block.indexOf("]") + 1);
          let newblock = block.replace(points, "");
          let attrs = newblock
            .slice(newblock.indexOf("(") + 1, newblock.indexOf(")"))
            .split(",")
            .filter((d) => d !== "")
            .map((d) => d.trim());
          let colorname = String(attrs[0]).includes("d.")?String(attrs[0]).replace("d.",""):false;
          let colorvalue = "#" + attrs[0].replace("0x", "");
          if(colorname){
            colorvalue= CUSTOMCOLOR[colorname];
          }
          uiObjs.push({
            name: "polyline",
            points: JSON.parse(points),
            stroke: colorvalue,
            strokeWidth: parseInt(
              attrs[1].replaceAll(" ", "").replace("thickness=", "")
            ),
            colorname
          });
        }
        if (shape === "Polygon") {
          let points = block.slice(block.indexOf("["), block.indexOf("]") + 1);
          let newblock = block.replace(points, "");
          let attrs = newblock
            .slice(newblock.indexOf("(") + 1, newblock.indexOf(")"))
            .split(",")
            .filter((d) => d !== "")
            .map((d) => d.trim());
          let colorname = String(attrs[0]).includes("d.")?String(attrs[0]).replace("d.",""):false;
          let colorvalue = "#" + attrs[0].replace("0x", "");
          if(colorname){
            colorvalue= CUSTOMCOLOR[colorname];
          }
          uiObjs.push({
            name: "polygone",
            points: JSON.parse(points),
            fill: colorvalue,
            stroke: colorvalue,
            strokeWidth: 1,
            closed: true,
            colorname
          });
        }
        if (shape === "Text") {
          let attrs = block
            .slice(block.indexOf("(") + 1, block.indexOf(")"))
            .split(",")
            .map((d) => d.trim());
            let colorname = String(attrs[3]).includes("d.")?String(attrs[3]).replace("d.",""):false;
            let colorvalue = "#" + attrs[3].replace("0x", "");
            if(colorname){
              colorvalue= CUSTOMCOLOR[colorname];
            }
          uiObjs.push({
            name: "text",
            text: attrs[0].slice(1, attrs[0].length - 1),
            x: parseInt(attrs[1]),
            y: parseInt(attrs[2]),
            fill: colorvalue,
            alignment: attrs[4].replaceAll(" ", "").replace("justify=d.", ""),
            draggable: true,
            colorname
          });
        }
      });
      this._panel.webview.postMessage(uiObjs);
    } catch (error) {
      console.log(error);
      vscode.window.showErrorMessage(
        "File parsing failed! probably unknown structure"
      );
    }
  }
  public async updatePy(data: object[] = [], firstload = false) {
    if (
      (await isPathExist(this.screenPath)) &&
      data.length === 0 &&
      firstload
    ) {
      this.updateGUI();
    } else {
      let pystring = gUItoPython(data, this.screenName);
      vscode.workspace.fs.writeFile(this.screenPath, Buffer.from(pystring));
    }
  }
}

export function getUri(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  pathList: string[]
) {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
}
export function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function gUItoPython(data: object[], screenName: string) {
  const initialMessage =
    "# GENERATED BY BRILLIANT AR STUDIO Do not modify this file directly\nimport display as d\n\n";
  let finalPyString = "";
  if (data.length === 0) {
    finalPyString +=
      initialMessage +
      "class " +
      screenName +
      ":\n\tblocks=[]## dont't remove this #";
  } else {
    finalPyString += initialMessage + "class " + screenName + ":\n\tscreen=[";
  }
  data.forEach((uiElement: any, index: number) => {
    let colorname= uiElement.colorname||undefined;
    let colorvalue = '';
    if(uiElement.name==='line' || uiElement.name==='polyline'){
      colorvalue = "0x"+uiElement.stroke.replace("#","");
    }else{
      colorvalue = "0x"+uiElement.fill.replace("#","");
    }
    if(colorname){
      colorvalue = "d."+colorname;
    }
    if (uiElement.name === "rect") {
      finalPyString += `\n\t\td.Rectangle(${Math.round(
        uiElement.x
      )}, ${Math.round(uiElement.y)}, ${Math.round(
        uiElement.x + uiElement.width
      )}, ${Math.round(
        uiElement.y + uiElement.height
      )}, ${colorvalue}),`;
    }
    if (uiElement.name === "line") {
      finalPyString += `\n\t\td.Line(${Math.round(
        uiElement.points[0]
      )}, ${Math.round(uiElement.points[1])}, ${Math.round(
        uiElement.points[2]
      )}, ${Math.round(uiElement.points[3])}, ${colorvalue}, thickness=${uiElement.strokeWidth}),`;
    }
    if (uiElement.name === "polyline") {
      finalPyString += `\n\t\td.Polyline([${uiElement.points
        .map((point: number) => Math.round(point))
        .join(",")}], ${colorvalue}, thickness=${
        uiElement.strokeWidth
      }),`;
    }
    if (uiElement.name === "polygone") {
      finalPyString += `\n\t\td.Polygon([${uiElement.points
        .map((point: number) => Math.round(point))
        .join(",")}], ${colorvalue}),`;
    }
    if (uiElement.name === "text") {
      finalPyString += `\n\t\td.Text('${uiElement.text}', ${Math.round(
        uiElement.x
      )}, ${Math.round(uiElement.y)}, ${colorvalue}, justify=d.${uiElement.alignment}),`;
    }
  });
  if (data.length !== 0) {
    finalPyString += "\n\t]## dont't remove this #";
  }
  // finalPyString += `\n\tdef __init__(self):\n\t\td.show(self.blocks)`;

  // finalPyString +=
  //   "\n\n\n# To use this in main.py screen import into main.py or copy below code in main.py\n# from screens." +
  //   screenName +
  //   "_screen import " +
  //   screenName +
  //   "\nif __name__=='__main__':\n\t" +
  //   screenName +
  //   "()";
  return finalPyString;
}

// <script>
// document.querySelector(document).ready(function () {
//   document.querySelector('#selected_color').addEventListener('click',function () {
//     document.querySelector('#pigment_pick').classList.add('pickbox_show');s
//   })
//   document.querySelector('#pigment_pick .item .pigment_box').addEventListener('click',function () {
//     let color = document.querySelector(this).getAttribute('style');
//     console.log(color);
//     document.querySelector('#selected_color').getAttribute('style', color);
//     document.querySelector('#pigment_pick').classList.remove('pickbox_show');
//   })
// })
// </script>
