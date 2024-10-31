// The module 'vscode' contains the VS Code extensibility API

// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	const selectionDecoration = vscode.window.createTextEditorDecorationType({
		backgroundColor: 'rgba(135,206,250, 0.3)' // Light blue background with 30% opacity
	});


	const selectionChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
		console.log("Selection changed"); // Debugging line
	
		const editor = vscode.window.activeTextEditor
		
		// Get all selected ranges
		const startIndex = event.contentChanges[0].range.start.character;
		const text = editor.document.getText();
		console.log(editor.document.languageId);
		if (editor.document.languageId == "json") {
			let {open, close} = findObjectBounds(text, startIndex);
			console.log(open, close);
			const openLine = getLineAndCharacterAtIndex(open, editor.document);
			const closeLine = getLineAndCharacterAtIndex(close, editor.document);

			const range = new vscode.Range(
				new vscode.Position(openLine, open + 1),  // Start position
				new vscode.Position(closeLine, close + 1)       // End position
			);

			editor.setDecorations(selectionDecoration, [range]);
		}

      // Apply the decoration to the edited ranges
		//editor.setDecorations(selectionDecoration, changedRanges);
	});
	
	  // Push listener to context.subscriptions for cleanup on deactivation
	context.subscriptions.push(selectionChangeListener, selectionDecoration);
}

function getLineAndCharacterAtIndex(index, document) {
	return document.positionAt(index).line;
}

function findObjectBounds(jsonText, startIndex) {
	let openingBrace = "";
	let indexUp = startIndex;
	let indexDown = startIndex;
	let openSBrace = 1;
	let openBBrace = 1;
	while (indexUp >= 0 && openBBrace != 0 && openSBrace != 0) {
		if (jsonText[indexUp] == "{") {
			openingBrace = jsonText[indexUp];
			openBBrace -= 1;
		} else if (jsonText[indexUp] == "}"){
			openBBrace += 1;
		}
		if (jsonText[indexUp] == "[") {
			openingBrace = jsonText[indexUp];
			openSBrace -= 1;
		} else if (jsonText[indexUp] == "]"){
			openSBrace += 1;
		}
		indexUp--;
	}
	const closingBrace = openingBrace == "{" ? "}" : "]";
	let bracesCount = 1;
	while (bracesCount != 0 && indexDown <= jsonText.length) {
		indexDown++;
		if (jsonText[indexDown] == openingBrace) bracesCount += 1;
		if (jsonText[indexDown] == closingBrace) bracesCount -= 1;
		console.log(bracesCount);
	}
	return {open: indexUp, close: indexDown}
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
