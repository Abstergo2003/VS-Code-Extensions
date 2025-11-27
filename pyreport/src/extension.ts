import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('PyReport (Clean Scope) is active!');

    const disposable = vscode.commands.registerCommand('pyreport.getVariables', async () => {
        const editor = vscode.window.activeNotebookEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active notebook.');
            return;
        }

        const notebook = editor.notebook;
        const lastCellIndex = notebook.cellCount;

        const pythonCode = `
			import json
			import sys
			import types

			def _pyreport_extract_variables():
				# 1. Blocklist
				# We explicitly add variables from previous runs ('excluded_names', 'all_globals') 
				# to ensure they are cleaned out if they exist in memory.
				ignore_set = {
					'In', 'Out', 'get_ipython', 'exit', 'quit', 'open', 'json', 'sys', 'types', 
					'_pyreport_extract_variables', # Ignore this function itself
					'excluded_names', 'all_globals', 'variables_data' # Ignore leftovers from previous script versions
				}

				result = {}
				
				# 2. Iterate Globals
				# Since we are inside a function, 'result', 'ignore_set', etc. are LOCAL.
				# They will NOT appear in globals(), so we don't need to filter them out manually.
				for name, val in globals().items():
					if not name.startswith('_') and name not in ignore_set and not isinstance(val, types.ModuleType):
						try:
							# Get string representation
							val_str = str(val)
							result[name] = {"value": val_str, "type": type(val).__name__}
						except:
							result[name] = {"value": "<Error>", "type": "Unknown"}
				return result

			# Execute and print
			print("<<VAR_START>>" + json.dumps(_pyreport_extract_variables()) + "<<VAR_END>>")

			# Clean up the function itself from the global namespace
			del _pyreport_extract_variables
		`;

        // 2. Inject Cell
        const edit = new vscode.WorkspaceEdit();
        edit.set(notebook.uri, [
            new vscode.NotebookEdit(new vscode.NotebookRange(lastCellIndex, lastCellIndex), [
                new vscode.NotebookCellData(vscode.NotebookCellKind.Code, pythonCode, 'python')
            ])
        ]);
        await vscode.workspace.applyEdit(edit);

        // 3. Execute Cell
        const range = new vscode.NotebookRange(lastCellIndex, lastCellIndex + 1);
        editor.selection = range;
        await vscode.commands.executeCommand('notebook.cell.execute');

        // 4. Poll for Output
        const newCell = notebook.cellAt(lastCellIndex);
        let foundData = null;

        for (let i = 0; i < 25; i++) {
            if (newCell.outputs.length > 0) {
                const textItem = newCell.outputs[0].items.find(item => item.mime === 'text/plain' || item.mime === 'application/vnd.code.notebook.stdout');
                if (textItem) {
                    const text = new TextDecoder().decode(textItem.data);
                    const match = text.match(/<<VAR_START>>(.*)<<VAR_END>>/);
                    if (match) {
                        foundData = JSON.parse(match[1]);
                        break;
                    }
                }
            }
            await new Promise(r => setTimeout(r, 200));
        }

        // 5. Cleanup (Delete the temporary cell)
        const deleteEdit = new vscode.WorkspaceEdit();
        deleteEdit.set(notebook.uri, [
            new vscode.NotebookEdit(new vscode.NotebookRange(lastCellIndex, lastCellIndex + 1), [])
        ]);
        await vscode.workspace.applyEdit(deleteEdit);

        // 6. Save to JSON
        if (foundData) {
            try {
                const notebookUri = editor.notebook.uri;
                const jsonPath = notebookUri.path.replace(/\.ipynb$/i, '_vars.json');
                const jsonUri = notebookUri.with({ path: jsonPath });

                const fileContent = JSON.stringify(foundData, null, 4);
                const encodedData = new TextEncoder().encode(fileContent);

                await vscode.workspace.fs.writeFile(jsonUri, encodedData);

                vscode.window.showInformationMessage(`Saved clean variables to: ${path.basename(jsonPath)}`);
                
                // Open the JSON file
                const doc = await vscode.workspace.openTextDocument(jsonUri);
                await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });

                // (Optional) Update the webview panel if you still have that code
                // const panel = vscode.window.createWebviewPanel(...)

            } catch (err) {
                vscode.window.showErrorMessage(`Error saving file: ${err}`);
            }
        } else {
            vscode.window.showErrorMessage('Failed to retrieve variables.');
        }
    });

    context.subscriptions.push(disposable);
}