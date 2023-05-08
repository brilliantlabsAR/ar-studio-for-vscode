let h1 = document.querySelector("h1");
const vscode = acquireVsCodeApi();
h1.addEventListener('click',handleClick);
function handleClick() {
    h1.innerHTML = "Updated";
    vscode.postMessage({
      command: "hello",
      text: "Hey",
    });
}