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
        const webviewUri = getUri(webview, extensionUri, ["media" ,"main.js"]);
        const nonce = getNonce();
        const stylesMainUri = getUri(webview, extensionUri, ["media" ,"main.css"]);
        return /*html*/ `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
              <link href="${stylesMainUri}" rel="stylesheet">
              <title>Hello World!</title>
            </head>
            <body>
              <div class="main">
                <div class="tool-bar">
                  <div class="shapes">
                    <span>Shapes<span>
                  </div>
                  <div class="options">
                    <span>Options<span>
                  </div>
                </div>
                <div class="canvas">
                </div>
              </div>
              <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
            </body>
          </html>
        `;
      }
      private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
          (message: any) => {
            const command = message.command;
            const text = message.text;
    
            switch (command) {
              case "hello":
                vscode.window.showInformationMessage(text);
                return;
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