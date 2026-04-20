import * as vscode from "vscode";
import * as path from "path";

export let doc: vscode.TextDocument;
export let editor: vscode.TextEditor;

const EXTENSION_ID = "Future.uroborosql-fmt";

export async function activate(
  docUri: vscode.Uri,
): Promise<vscode.TextDocument> {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  if (!ext) {
    throw new Error(`Extension not found: ${EXTENSION_ID}`);
  }

  await ext.activate();

  doc = await vscode.workspace.openTextDocument(docUri);
  editor = await vscode.window.showTextDocument(doc);
  return doc;
}

export async function reopenDocument(
  docUri: vscode.Uri,
): Promise<vscode.TextDocument> {
  doc = await vscode.workspace.openTextDocument(docUri);
  editor = await vscode.window.showTextDocument(doc);
  return doc;
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeCommandWithWait(
  command: string,
  ...args: unknown[]
): Promise<void> {
  await sleep(500);
  await vscode.commands.executeCommand(command, ...args);
  await sleep(1000);
}

export const getDocPath = (p: string) => {
  return path.resolve(__dirname, "../../testFixture", p);
};
export const getDocUri = (p: string) => {
  return vscode.Uri.file(getDocPath(p));
};

export async function setTestContent(content: string): Promise<boolean> {
  const all = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(doc.getText().length),
  );
  return editor.edit((eb) => eb.replace(all, content));
}

export async function waitFor<T>(
  getValue: () => Thenable<T> | T,
  predicate: (value: T) => boolean,
  timeoutMs: number = 10_000,
  intervalMs: number = 100,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const value = await getValue();
    if (predicate(value)) {
      return value;
    }
    await sleep(intervalMs);
  }

  throw new Error(`Timed out after ${timeoutMs}ms`);
}

export async function replaceDocumentText(
  document: vscode.TextDocument,
  content: string,
): Promise<void> {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    document.uri,
    new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length),
    ),
    content,
  );
  await vscode.workspace.applyEdit(edit);
  await document.save();
}
