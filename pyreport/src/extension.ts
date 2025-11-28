import * as vscode from 'vscode';
import * as path from 'path';
import { extractExpressions, detectMatrixes, substituteValues, findTableCommands, createFinalReport } from './helper';
import { pythonCode } from './python_code';
export function activate(context: vscode.ExtensionContext) {

    const disposable = vscode.commands.registerCommand('pyreport.getVariables', async () => {
        const editor = vscode.window.activeNotebookEditor;
        // 1. Check prerequisuites
        if (!editor) {
            vscode.window.showErrorMessage('No active notebook.');
            return;
        }

        const notebook = editor.notebook;
        const lastCellIndex = notebook.cellCount;

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
        let variables = null;

        for (let i = 0; i < 25; i++) {
            if (newCell.outputs.length > 0) {
                const textItem = newCell.outputs[0].items.find(item => item.mime === 'text/plain' || item.mime === 'application/vnd.code.notebook.stdout');
                if (textItem) {
                    const text = new TextDecoder().decode(textItem.data);
                    const match = text.match(/<<VAR_START>>(.*)<<VAR_END>>/);
                    if (match) {
                        variables = JSON.parse(match[1]);
                        break;
                    }
                }
            }
            await new Promise(r => setTimeout(r, 200));
        }

        // 5. Cleanup
        const deleteEdit = new vscode.WorkspaceEdit();
        deleteEdit.set(notebook.uri, [
            new vscode.NotebookEdit(new vscode.NotebookRange(lastCellIndex, lastCellIndex + 1), [])
        ]);
        await vscode.workspace.applyEdit(deleteEdit);

        // 6. Process data & generate report
        if (variables) {
            try {
                // A. Read .ipynb file
                const fileContent = await vscode.workspace.fs.readFile(notebook.uri);
                const fileString = new TextDecoder().decode(fileContent);
                const notebookJson = JSON.parse(fileString);

                // B. Logic Pipeline
                variables = extractExpressions(variables, notebookJson);
                variables = detectMatrixes(variables);
                variables = substituteValues(variables);
                variables = findTableCommands(variables, notebookJson);

                // // C. Save JSON
                // const jsonPath = notebook.uri.path.replace(/\.ipynb$/i, '_vars.json');
                // const jsonUri = notebook.uri.with({ path: jsonPath });
                // await vscode.workspace.fs.writeFile(jsonUri, new TextEncoder().encode(JSON.stringify(variables, null, 4)));

                // D. Generate report
                const reportContent = createFinalReport(variables, notebookJson);
                
                // E. Save Report (.md)
                const mdPath = notebook.uri.path.replace(/\.ipynb$/i, '_report.md');
                const mdUri = notebook.uri.with({ path: mdPath });
                await vscode.workspace.fs.writeFile(mdUri, new TextEncoder().encode(reportContent));

                vscode.window.showInformationMessage(`Report generated: ${path.basename(mdPath)}`);
                
                // F. Open the Report
                const doc = await vscode.workspace.openTextDocument(mdUri);
                await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });

            } catch (err) {
                console.error(err);
                vscode.window.showErrorMessage(`Error processing notebook data: ${err}`);
            }
        } else {
            vscode.window.showErrorMessage('Failed to retrieve variables form Kernel.');
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}