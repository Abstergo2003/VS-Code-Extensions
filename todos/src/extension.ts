import * as vscode from "vscode";

interface TodoItem {
	fileUri: vscode.Uri;
	line: number;
	text: string;
	important: boolean;
}

export function activate(context: vscode.ExtensionContext) {
	const todoProvider = new TodoTreeDataProvider();
	vscode.window.registerTreeDataProvider("myTodoView", todoProvider);

	// Refresh when the view becomes visible
	context.subscriptions.push(
		vscode.window.onDidChangeVisibleTextEditors(() => {
			todoProvider.refresh();
		})
	);

	// Refresh each time user opens the TODO view
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("myTodoView", todoProvider)
	);

	// React immediately when the active editor changes
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(() => {
			todoProvider.refresh();
		})
	);

	// Start initial scan
	todoProvider.refresh();
}

async function findTodosInWorkspace(): Promise<TodoItem[]> {
	const workspaces = vscode.workspace.workspaceFolders;
	if (!workspaces) {return [];}

	const files = await vscode.workspace.findFiles("**/*", "**/node_modules/**");
	const results: TodoItem[] = [];

	for (const file of files) {
		try {
		const doc = await vscode.workspace.openTextDocument(file);
		const lines = doc.getText().split(/\r?\n/);

		lines.forEach((line, index) => {
		if (line.includes("@TODO")) {
			const important = line.includes("@TODO!");
			results.push({
			fileUri: file,
			line: index + 1,
			text: line.trim(),
			important
			});
		}
		});
		} catch {}
	}

	return results;
}

class TodoTreeDataProvider implements vscode.TreeDataProvider<TodoNode> {
	private items: TodoItem[] = [];
	private _onDidChangeTreeData = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	async refresh() {
		const todos = await findTodosInWorkspace();

		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			const currentFile = activeEditor.document.uri.fsPath.toLowerCase();

			todos.sort((a, b) => {
				const aInCurrent = a.fileUri.fsPath.toLowerCase() === currentFile;
				const bInCurrent = b.fileUri.fsPath.toLowerCase() === currentFile;
				if (aInCurrent && !bInCurrent) {return -1;}
				if (!aInCurrent && bInCurrent) {return 1;}
				return 0;
			});
		}

		this.items = todos;
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: TodoNode): vscode.TreeItem {
		return element;
	}

	getChildren(): Thenable<TodoNode[]> {
		const active = vscode.window.activeTextEditor;
		const currentPath = active?.document.uri.fsPath.toLowerCase() ?? "";

		const currentFileTodos = this.items.filter(
			t => t.fileUri.fsPath.toLowerCase() === currentPath
		);
		const otherTodos = this.items.filter(
			t => t.fileUri.fsPath.toLowerCase() !== currentPath
		);

		const nodes: vscode.TreeItem[] = [];

		for (const item of currentFileTodos) {
			nodes.push(new TodoNode(item));
		}

		if (currentFileTodos.length > 0 && otherTodos.length > 0) {
			nodes.push(new SpacerNode());
		}

		for (const item of otherTodos) {
			nodes.push(new TodoNode(item));
		}

		return Promise.resolve(nodes as TodoNode[]);
	}

}

class TodoNode extends vscode.TreeItem {
	constructor(item: TodoItem) {
		const prefix = item.important ? "⚠ " : "• ";
		super(prefix + `${item.text.replace("@TODO!", "").replace("@TODO", "")}`);

		this.description = true;
		this.tooltip = item.fileUri.fsPath;

		this.command = {
			command: "vscode.open",
			title: "",
			arguments: [
				item.fileUri,
				{ selection: new vscode.Range(item.line - 1, 0, item.line - 1, 0) }
			]
		};
	}
}

class SpacerNode extends vscode.TreeItem {
	constructor() {
		super("──────────", vscode.TreeItemCollapsibleState.None);
		this.tooltip = undefined;
		this.command = undefined;
		this.contextValue = "spacer";
		// No icon, so it’s just a plain text separator.
		this.iconPath = undefined;
	}
}