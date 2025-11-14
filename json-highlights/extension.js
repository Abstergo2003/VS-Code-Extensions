const vscode = require('vscode');

function activate(context) {
	const selectionDecoration = vscode.window.createTextEditorDecorationType({
		backgroundColor: 'rgba(135, 250, 145, 0.33)'
	});

	const selectionChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
		const editor = vscode.window.activeTextEditor;
		if (!editor || editor.document.languageId !== "json") {
			return;
		}

		if (event.contentChanges.length === 0) {
			return;
		}

		// Get the position where the change occurred
		const changePosition = event.contentChanges[0].range.start;
		const text = editor.document.getText();
		const startIndex = editor.document.offsetAt(changePosition);


		let { open, close } = findObjectBounds(text, startIndex);

		if (open !== -1 && close !== -1) {
			// Convert indices to positions
			const openPosition = editor.document.positionAt(open);
			const closePosition = editor.document.positionAt(close + 1); // +1 to include closing brace

			const range = new vscode.Range(openPosition, closePosition);
			editor.setDecorations(selectionDecoration, [range]);
		}
	});

	context.subscriptions.push(selectionChangeListener, selectionDecoration);
}

function findObjectBounds(jsonText, startIndex) {
	let indexUp = startIndex;
	let indexDown = startIndex;
	let upBraces = 0;
	let downBraces = 0;
	let foundOpening = false;

	// Find opening brace going backwards
	while (indexUp >= 0) {
		const char = jsonText[indexUp];
		
		if (char === '}' || char === ']') {
			upBraces++;
		} else if (char === '{' || char === '[') {
			if (upBraces === 0) {
				foundOpening = true;
				break;
			}
			upBraces--;
		}
		indexUp--;
	}

	if (!foundOpening || indexUp < 0) {
		return { open: -1, close: -1 };
	}

	// Determine which type of brace we're looking for
	const openingBrace = jsonText[indexUp];
	const closingBrace = openingBrace === '{' ? '}' : ']';

	// Find closing brace going forwards
	indexDown = indexUp + 1;
	downBraces = 1;

	while (indexDown < jsonText.length && downBraces > 0) {
		const char = jsonText[indexDown];
		
		if (char === openingBrace) {
			downBraces++;
		} else if (char === closingBrace) {
			downBraces--;
		}
		
		if (downBraces === 0) {
			break;
		}
		indexDown++;
	}

	if (downBraces !== 0) {
		return { open: -1, close: -1 };
	}

	return { open: indexUp, close: indexDown };
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}