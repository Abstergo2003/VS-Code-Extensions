const vscode = require('vscode');

// @ts-ignore
String.prototype.getFileExtension = function() {
    return this.includes('.') ? this.split('.').pop() : '';
};

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	try {
		await vscode.workspace.fs.stat(context.globalStorageUri);
		const itemsUri = vscode.Uri.joinPath(context.globalStorageUri, "items");
		const itemsMainUri = vscode.Uri.joinPath(context.globalStorageUri, "main.json");
		await vscode.workspace.fs.stat(itemsUri);
		await vscode.workspace.fs.stat(itemsMainUri);
	} catch {
		vscode.workspace.fs.createDirectory(context.globalStorageUri);
		const itemsUri = vscode.Uri.joinPath(context.globalStorageUri, "items");
		vscode.workspace.fs.createDirectory(itemsUri);
		const itemsMainUri = vscode.Uri.joinPath(context.globalStorageUri, "main.json");
		const data = new TextEncoder().encode("[]");
		vscode.workspace.fs.writeFile(itemsMainUri, data);
	}
	const openView = vscode.commands.registerCommand('abstergos-codelibrary.openlibrary',async function () {
		// The code you place here will be executed every time your command is executed
		const panel = vscode.window.createWebviewPanel(
            'abstergos-codelibrary-window',  // Internal ID of the webview
            'Code Library',  // Title of the panel displayed to the user
            vscode.ViewColumn.One,  // Editor column to show the new panel in
            {
                // Enable JavaScript in the webview
                enableScripts: true
            }
        );
		panel.iconPath = vscode.Uri.file(context.extensionPath + "/media/icon.png");
        // Set the HTML content for the webview
        panel.webview.html = await getWebviewContent(context, panel);

		panel.webview.onDidReceiveMessage(
            message => {
				if (message.command == "readFile") {
					const fileUri = vscode.Uri.joinPath(context.extensionUri, message.filePath);
					vscode.workspace.fs.readFile(fileUri).then((data) => {
						const fileText = Buffer.from(data).toString('utf8');
						panel.webview.postMessage({
							command: 'fileContent',
							content: fileText
						});
					});
				} else if (message.command == 'getMainData') {
					const mainUri = vscode.Uri.joinPath(context.globalStorageUri, "main.json");
					vscode.workspace.fs.readFile(mainUri).then((data) => {
						const fileText = Buffer.from(data).toString('utf8');
						panel.webview.postMessage({
							command: 'mainData',
							content: fileText
						});
					});
				} else if (message.command == "getScriptContent") {
					const contentUri = vscode.Uri.joinPath(context.globalStorageUri, "items", `${message.id}.txt`);
					vscode.workspace.fs.readFile(contentUri).then((data) => {
						const fileText = Buffer.from(data).toString('utf8');
						panel.webview.postMessage({
							command: 'scriptContent',
							content: fileText
						});
					});
				} else if (message.command == "saveMainData") {
					const mainUriSave = vscode.Uri.joinPath(context.globalStorageUri, "main.json");
					const data = new TextEncoder().encode(message.data);
					vscode.workspace.fs.writeFile(mainUriSave, data);
				} else if (message.command == "saveScriptContent") {
					const scriptUri = vscode.Uri.joinPath(context.globalStorageUri, `/items/${message.id}.txt`);
					const content = new TextEncoder().encode(message.content);
					vscode.workspace.fs.writeFile(scriptUri, content);
				} else if (message.command == "deleteFile") {
					const deleteUri = vscode.Uri.joinPath(context.globalStorageUri, message.fileName);
					vscode.workspace.fs.delete(deleteUri);
				}
            },
            undefined,
            context.subscriptions
        );
		// Display a message box to the user
		//vscode.window.showInformationMessage(`${context.globalStorageUri}`);

	});

	const saveAsBundle = vscode.commands.registerCommand('abstergos-codelibrary.saveAsBundle', (uri) => {
		_saveAsBundle(uri, context);
	});

	const saveAsScript = vscode.commands.registerCommand('abstergos-codelibrary.saveAsScript', ()=> {
		_saveAsScript(context);
	});

	context.subscriptions.push(openView);
	context.subscriptions.push(saveAsBundle);
	context.subscriptions.push(saveAsScript);
}

async function getWebviewContent(context, panel) {
	const mediaPath = vscode.Uri.file(context.extensionPath + '/media/');
	const mediaUri = panel.webview.asWebviewUri(mediaPath).toString();
    const htmlUri = vscode.Uri.joinPath(context.extensionUri, "libraryView.html");
	const htmlBytes = await vscode.workspace.fs.readFile(htmlUri);
	let html = Buffer.from(htmlBytes).toString("utf-8");
	html = html.replaceAll("server.uri", mediaUri);
	return html;
}

/**
 * @param {vscode.Uri} uri
 * @param {vscode.ExtensionContext} context
 */
async function _saveAsBundle(uri, context) {
	if (uri && uri.fsPath) {
		
		let readed = await vscode.workspace.fs.readFile(uri)
		const selectedText = Buffer.from(readed).toString('utf8');
		// @ts-ignore
		const languageID = languages[uri.toString().getFileExtension()];
		const mainUri = vscode.Uri.joinPath(context.globalStorageUri, "main.json");
		const data = await vscode.workspace.fs.readFile(mainUri);
		const fileText = Buffer.from(data).toString('utf8');
		let parsed = JSON.parse(fileText);
		if (languageID == "html") {
			const scriptID = new Date().getTime();
			const script = {
				id: scriptID.toString(),
				name: "HTML Object",
				lang: languageID,
				type: "item",
				tags: []
			};
			parsed.push(script);
			const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `/items/${scriptID}.txt`);
			const content = new TextEncoder().encode(selectedText);
			vscode.workspace.fs.writeFile(fileUri, content);
		} else if (languageID == "css") {
			const scriptID = new Date().getTime();
			const script = {
				id: scriptID.toString(),
				name: "CSS Styles",
				lang: languageID,
				type: "item",
				tags: []
			};
			parsed.push(script);
			const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `/items/${scriptID}.txt`);
			const content = new TextEncoder().encode(selectedText);
			vscode.workspace.fs.writeFile(fileUri, content);
		} else {
			const functions = getFunctionsAsObjects(selectedText, languageID);
			let bundle = {
				type: "bundle",
				id: new Date().getTime().toString() + languageID.length.toString(),
				name: `${languageID} Budle`,
				children: []
			}
			for (var fn of functions) {
				let scriptID = new Date().getTime().toString() + fn.name.length + fn.text.length;
				const script = {
					id: scriptID,
					name: fn.name,
					lang: languageID,
					type: "item",
					tags: []
				};
				bundle.children.push(script);
				const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `/items/${scriptID}.txt`);
				const content = new TextEncoder().encode(fn.text);
				vscode.workspace.fs.writeFile(fileUri, content);
			}
			parsed.push(bundle);
		}
		const encoded = new TextEncoder().encode(JSON.stringify(parsed));
		vscode.workspace.fs.writeFile(mainUri, encoded);
	}
}

async function _saveAsScript (context) {
	const editor = vscode.window.activeTextEditor;
	if (editor) {
		const selection = editor.selection;
		const selectedText = editor.document.getText(selection);
		const languageID = editor.document.languageId;
		const mainUri = vscode.Uri.joinPath(context.globalStorageUri, "main.json");
		const data = await vscode.workspace.fs.readFile(mainUri);
		const fileText = Buffer.from(data).toString('utf8');
		let parsed = JSON.parse(fileText);
		if (languageID == "html") {
			const scriptID = new Date().getTime();
			const script = {
				id: scriptID.toString(),
				name: "HTML Object",
				lang: languageID,
				type: "item",
				tags: []
			};
			parsed.push(script);
			const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `/items/${scriptID}.txt`);
			const content = new TextEncoder().encode(selectedText);
			vscode.workspace.fs.writeFile(fileUri, content);
		} else if (languageID == "css") {
			const scriptID = new Date().getTime();
			const script = {
				id: scriptID.toString(),
				name: "CSS Styles",
				lang: languageID,
				type: "item",
				tags: []
			};
			parsed.push(script);
			const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `/items/${scriptID}.txt`);
			const content = new TextEncoder().encode(selectedText);
			vscode.workspace.fs.writeFile(fileUri, content);
		} else {
			const functions = getFunctionsAsObjects(selectedText, languageID);
			for (var fn of functions) {
				let scriptID = new Date().getTime().toString() + fn.name.length + fn.text.length;
				const script = {
					id: scriptID,
					name: fn.name,
					lang: languageID,
					type: "item",
					tags: []
				};
				parsed.push(script);
				const fileUri = vscode.Uri.joinPath(context.globalStorageUri, `/items/${scriptID}.txt`);
				const content = new TextEncoder().encode(fn.text);
				vscode.workspace.fs.writeFile(fileUri, content);
			}
		}
		const encoded = new TextEncoder().encode(JSON.stringify(parsed));
		vscode.workspace.fs.writeFile(mainUri, encoded);
	}
}


const patterns = {
	javascript: /\bfunction\s+([a-zA-Z0-9_$]+)\s*\(/,
	python: /\bdef\s+([a-zA-Z0-9_$]+)\s*\(/,
	rust: /\bfn\s+([a-zA-Z0-9_$]+)\s*\(/,
	java: /\b(?:public|private|protected)?\s*(?:static)?\s*(?:void|int|float|double|char|[A-Z][A-Za-z0-9_]*)\s+([a-zA-Z0-9_$]+)\s*\(/,
	cpp: /\b(?:void|int|float|double|char|[A-Za-z0-9_$]+)\s+([a-zA-Z0-9_$]+)\s*\(/,
	php: /\bfunction\s+([a-zA-Z0-9_$]+)\s*\(/,
	csharp: /\b(?:public|private|protected|internal)?\s*(?:static)?\s*(?:void|int|float|double|char|string|[A-Z][A-Za-z0-9_]*)\s+([a-zA-Z0-9_$]+)\s*\(/,
	kotlin: /\bfun\s+([a-zA-Z0-9_$]+)\s*\(/,
	swift: /\bfunc\s+([a-zA-Z0-9_$]+)\s*\(/,
	ruby: /\bdef\s+([a-zA-Z0-9_$]+)\s*\(/,
	typescript: /\bfunction\s+([a-zA-Z0-9_$]+)\s*\(/,
	go: /\bfunc\s+([a-zA-Z0-9_$]+)\s*\(/,
	dart: /\b(?:[a-zA-Z0-9_$]+)?\s*([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*(?:async)?\s*{/,
	c: /\b(?:void|int|float|double|char|[A-Za-z0-9_$]+)\s+([a-zA-Z0-9_$]+)\s*\(/,
	shellscript: /\b(?:function\s+)?([a-zA-Z0-9_$]+)\s*\(\s*\)\s*{/,
	haskell: /^([a-zA-Z0-9_$]+)\s+.*=/m
};
const languages = {
	js: "javascript",
	py: "python",
	rs: "rust",
	java: "java",
	cpp: "cpp",
	php: "php",
	cs: "csharp",
	kt: "kotlin",
	swift: "swift",
	ru: "ruby",
	ts: "typescript",
	go: "go",
	dart: "dart",
	c: "c",
	bash: "shellscript",
	hs: "haskell",
	html: "html",
	css: "css"
}


function getFunctionsAsObjects(codeString, language) {
    const regex = patterns[language];
    if (!regex) {
        return [{
			name: "Plain Text",
			text: codeString
		}]
    }
    
    const functions = [];
    let match;
    const globalRegex = new RegExp(regex.source, 'g');
	let wasMatch = false;
    while ((match = globalRegex.exec(codeString)) !== null) {
		wasMatch = true;
        const funcName = match[1];
        const funcStartIndex = match.index;
        let funcBody = match[0]; // Start with the matched line
        let endIndex = funcStartIndex + match[0].length;

        if (language === 'python' || language === 'haskell') {
            const lines = codeString.slice(endIndex).split("\n");
            for (const line of lines) {
                if (/^\s*def\b/.test(line) || /^\s*[a-zA-Z0-9_$]+\s*.*=/.test(line)) break; // Next function or assignment
                if (line.trim()) funcBody += `\n${line}`;
            }
        } else {
            let braceCount = 1;
			let omitFirst = true;
            while (braceCount > 0 && endIndex < codeString.length) {
                const char = codeString[endIndex];
                if (char === '{') {
					if (omitFirst) {
						omitFirst = false;
					} else {
						braceCount++;
					}
				}
                if (char === '}') {
					braceCount--;
				}
                funcBody += char;
                endIndex++;
            }
        }

        functions.push({
            name: funcName,
            text: funcBody.trim()
        });
    }
	if (!wasMatch) {
		return [{
			name: `${language} Script`,
			text: codeString
		}]
	}
    return functions;
}
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
