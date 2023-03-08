/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import ReferencesDocument from './referencesDocument';

export default class Provider implements vscode.TextDocumentContentProvider {

	static scheme = 'references';

	private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	private _documents = new Map<string, ReferencesDocument>();
	private _editorDecoration = vscode.window.createTextEditorDecorationType({ textDecoration: 'underline' });
	private _subscriptions: vscode.Disposable;

	constructor() {

		// Listen to the `closeTextDocument`-event which means we must
		// clear the corresponding model object - `ReferencesDocument`
		this._subscriptions = vscode.workspace.onDidCloseTextDocument(doc => this._documents.delete(doc.uri.toString()));
	}

	// emitter and its event
    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;

    provideTextDocumentContent(uri: vscode.Uri): string {
        // simply invoke cowsay, use uri-path as text
        return "dummy file for"+uri;
    }

}

let seq = 0;

export function encodeLocation(uri: vscode.Uri, pos: vscode.Position): vscode.Uri {
	const query = JSON.stringify([uri.toString(), pos.line, pos.character]);
	return vscode.Uri.parse(`${Provider.scheme}:References.locations?${query}#${seq++}`);
}

export function decodeLocation(uri: vscode.Uri): [vscode.Uri, vscode.Position] {
	const [target, line, character] = <[string, number, number]>JSON.parse(uri.query);
	return [vscode.Uri.parse(target), new vscode.Position(line, character)];
}