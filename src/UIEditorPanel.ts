import * as vscode from 'vscode';

export class UIEditorPanel {
    public static currentPanel: UIEditorPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
  
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
      this._panel = panel;
      this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
      this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);
      this._setWebviewMessageListener(this._panel.webview);
    }

    public static render(extensionUri: vscode.Uri) {
        if (UIEditorPanel.currentPanel) {
            UIEditorPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
        } else {
          const panel = vscode.window.createWebviewPanel("helloworld", "Hello World", vscode.ViewColumn.Two, {
            // Enable javascript in the webview
            enableScripts: true,
            // Restrict the webview to only load resources from the `out` directory
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
          });
    
          UIEditorPanel.currentPanel = new UIEditorPanel(panel,extensionUri);
        }
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
              <div class="tools">
              <button id="rect">Rect</button>
              <button id="straightLine">Straight Line</button>
              <button id="addText">Add Text</button>


              <button id="delete">delete</button>
              </div>
              <div class="main">
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
         if(message.name==='rect'){
          let currentEditors = vscode.window.visibleTextEditors;
          let currentEditor = currentEditors.filter(te=>te.document.fileName.endsWith(".py"))[0];
          currentEditor?.edit((editBuidler:vscode.TextEditorEdit)=>{
            editBuidler.insert(new vscode.Position(0,0),`import display\ndisplay.Rectangle(${Math.round(message.x)},${Math.round(message.y)},${Math.round(message.x+message.width)},${Math.round(message.y+message.height)},display.RED)\n`);

          });
         }
          },
          undefined,
          this._disposables
        );
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