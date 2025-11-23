import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

interface TodoItem {
	fileUri: vscode.Uri;
	line: number;
	text: string;
	important: boolean;
}

export function activate(context: vscode.ExtensionContext) {
	const todoProvider = new TodoTreeDataProvider();
	vscode.window.registerTreeDataProvider("myTodoView", todoProvider);

	// Refresh when documents are saved or changed
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(() => {
			todoProvider.refresh();
		})
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((e) => {
			// Debounce: only refresh if the document contains @TODO
			const text = e.document.getText();
			if (text.includes("@TODO")) {
				todoProvider.refresh();
			}
		})
	);

	// Refresh when the active editor changes
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(() => {
			todoProvider.refresh();
		})
	);

	// Refresh when visible editors change
	context.subscriptions.push(
		vscode.window.onDidChangeVisibleTextEditors(() => {
			todoProvider.refresh();
		})
	);

	// Manual refresh command
	context.subscriptions.push(
		vscode.commands.registerCommand("myTodoView.refresh", () => {
			todoProvider.refresh();
		})
	);

	// Periodic refresh every 60s
	const interval = setInterval(() => todoProvider.refresh(), 60_000);
	context.subscriptions.push({ dispose: () => clearInterval(interval) });

	// Start initial scan
	todoProvider.refresh();
}

async function readTodoIgnore(): Promise<string[]> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {return [];};

	const ignoreFiles: string[] = [];
	for (const folder of workspaceFolders) {
		const ignorePath = path.join(folder.uri.fsPath, ".todoignore");
		if (fs.existsSync(ignorePath)) {
			const lines = fs.readFileSync(ignorePath, "utf-8")
				.split(/\r?\n/)
				.map(l => l.trim())
				.filter(l => !!l && !l.startsWith("#"));
			lines.forEach(l => ignoreFiles.push(l));
		}
	}
	return ignoreFiles;
}

async function findTodosInWorkspace(): Promise<TodoItem[]> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {return [];};

	const ignorePatterns = await readTodoIgnore();
	const ignoreGlob = ignorePatterns.length > 0 ? `{${ignorePatterns.join(",")}}` : undefined;

	const files = await vscode.workspace.findFiles("**/*", ignoreGlob ?? "**/node_modules/**");
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
		} catch {
			// Silently skip files that can't be read
		}
	}

	return results;
}

class TodoTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	private items: TodoItem[] = [];
	private _onDidChangeTreeData = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private isSearching = false;
	private refreshPromise: Promise<void> | null = null;

	async refresh() {
		// Prevent multiple simultaneous refreshes
		if (this.refreshPromise) {
			return this.refreshPromise;
		}

		this.refreshPromise = this.doRefresh();
		await this.refreshPromise;
		this.refreshPromise = null;
	}

	private async doRefresh() {
		try {
			this.isSearching = true;
			this._onDidChangeTreeData.fire();

			const todos = await findTodosInWorkspace();
			this.items = todos;
		} catch (error) {
			console.error("Error refreshing TODOs:", error);
		} finally {
			this.isSearching = false;
			this._onDidChangeTreeData.fire();
		}
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(): Thenable<vscode.TreeItem[]> {
		if (this.isSearching) {
			return Promise.resolve([new SearchingNode("Searching for TODOs...")]);
		}

		if (this.items.length === 0) {
			return Promise.resolve([new EmptyNode()]);
		}

		const activeEditor = vscode.window.activeTextEditor;
		const currentPath = activeEditor?.document.uri.fsPath.toLowerCase() ?? "";

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

		return Promise.resolve(nodes);
	}
}

class TodoNode extends vscode.TreeItem {
	constructor(item: TodoItem) {
		const prefix = item.important ? "⚠ " : "• ";
		const text = item.text.replace(/^.*@TODO!?/, "").trim();
		const fileName = path.basename(item.fileUri.fsPath);
		
		super(`${prefix}${text || "(no description)"}`);
		this.description = `${fileName}:${item.line}`;
		this.tooltip = `${item.fileUri.fsPath}:${item.line}\n${item.text}`;

		this.command = {
			command: "vscode.open",
			title: "Open TODO",
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
		this.contextValue = "spacer";
	}
}

class SearchingNode extends vscode.TreeItem {
	constructor(label: string) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.iconPath = new vscode.ThemeIcon("loading~spin");
		this.contextValue = "searching";
	}
}

class EmptyNode extends vscode.TreeItem {
	constructor() {
		super("No TODOs found", vscode.TreeItemCollapsibleState.None);
		this.iconPath = new vscode.ThemeIcon("check");
		this.contextValue = "empty";
	}
}