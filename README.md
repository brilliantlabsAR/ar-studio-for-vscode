# Brilliant AR Studio

Build and test your Monocle AR apps with ease using MicroPython! 🐍

Check out the full documentation the [docs pages 📚](https://docs.brilliant.xyz), or [contribute 🧑‍💻](https://github.com/brilliantlabsAR/ar-studio-for-vscode) to make this extension even better!

## Features

Loading and saving Python files to your device:

![Animation of loading and saving files to Monocle](./media/vscode-ext-upload-file.gif)

Access the on-device REPL:

![Animation of the Monocle REPL](./media/vscode-ext-repl.gif)

Easily browse the various MicroPython modules:

![Animation of drag and drop editor](./media/vscode-ext-api-drag-drop.gif)

Update your FPGA binaries:

![Image of the FPGA update buttons](./media/vscode-ext-custom-fpga.gif)

Browse community projects, or publish your own:

![Animation of user projects](./media/vscode-ext-custom-projects.gif)

### UI instructions

1. Make sure a project is initialized (you can see 'device files' in File Explorer)
   if not setup, do with command `Brilliant AR Studio: Initialize new project folder`
   choose project name and directory and you are good to go.

2. connect monocle from one of the ways
   1. command `Brilliant AR Studio: Connect`
   2. status bar button `Monocle`
   3. file explorer -> Brilliant AR Studio: device files -> connect

3. after connect you can see REPL and all files listed in `file explorer` -> `Brilliant AR Studio: device files`

4. Now open main.py and edit and after save it will be uploaded to Device.
   you can create any file or directory and it will be transferred to device
   make sure all file remains in 'device files'. you can also upload files/dir from `device files` dir by
   right click and `Brilliant AR Studio: Upload File To Device`

5. Auto run: it means as soon as you save all files will be transferred and main.py will run. default is always on you turn off by button at right corner of editor or command `Brilliant AR Studio: Stop auto run`.
   to start again click on play button at right corner of editor or `Brilliant AR Studio: start auto run`

6. Run in Device: with this all file will be transferred and excuted at REPL run time
   quite useful to test files without uploading.
   use with button at at right corner of editor or `Brilliant AR Studio: Run in Device`

7. Two output channels are there 
   1. RAW-REPL: for REPL internal communication (allows to debug issues)
   2. RAW-DATA: for RAW data communication over data service ( such as you can send microphone bytes to this service)

8. Send Raw Data: data can be  directly send  at data service to monocle. This data can be received inside monocle by `bluetooth.receive_callback()`. To use the play button at title bar of  `file explorer` -> `Brilliant AR Studio: device files` or command `Brilliant AR Studio: Send Raw Data`
Create and Edit display screens with DRAG-DROP UI:

![Drag Drop UI](./media/vscode-ext-drag-drop-GUI.png)

### DRAG DROP instructions

1. Start a new screen with Brilliant AR Studio -> screens -> click on plus icon
   or with command 'Brilliant AR Studio: Open New GUI Screen'

2. Two columns of editor will appear one for python code and other the GUI. dont change python code

3. Draw from GUI with and after every change python file will change
   and you can test with Run in Device button or command

4. Drawing instrctions and shorcuts:
   1. To draw Rectangle select recatangle and drag and then click to select, transform or move
   2. To draw Line select Line and click on two points then click to select or drag a selection , adjust anchors
   3. To draw Polyline or polygon click select button and click multiple points and to finish double click or  
      to cancel press Esc. to adjust select and move anchor points
   4. To write text select T and drag to make box, double click to edit and enter or outside click to finish.
      shift + enter to new line
   5. you can move any object with arrow keys after select. ctrl + arrow keys to move with precise
   6. to delete select and press delete button, multiple selected objects can be deleted
   7. ctrl + A to select all
   8. ctrl + D to duplicate selected
   
   TIP: To snap line, polyline, polygon to nearest multiple of 45 degrees hold ctrl or shift
## Requirements

- Windows or MacOS
- Bluetooth hardware correctly installed on your system.

#### for MacOS
- Make Sure OSX is installed and all bluetooth permissions are given to vs code

#### for Linux (currently tested on Debian)
-  Make sure bluetooth is on and the user have permissions to access Bluetooth
- To give permissions you try adding user to bluetooth group with following command
```sudo usermod -aG bluetooth $USER
```
- then log off/log on or try a reboot
