import * as vscode from "vscode";
import * as path from "path";

const EXTENSION_ID = "Future.uroborosql-fmt";

export async function activate(
  docUri: vscode.Uri,
): Promise<vscode.TextDocument> {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  if (!ext) {
    throw new Error(`Extension not found: ${EXTENSION_ID}`);
  }

  await ext.activate();

  const doc = await vscode.workspace.openTextDocument(docUri);
  await vscode.window.showTextDocument(doc);
  return doc;
}

async function sleep(ms: number) {
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

const getDocPath = (p: string) => {
  return path.resolve(__dirname, "../../testFixture", p);
};
export const getDocUri = (p: string) => {
  return vscode.Uri.file(getDocPath(p));
};

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

export async function captureErrorMessages<T>(
  callback: () => Promise<T>,
): Promise<{ result: T; messages: string[] }> {
  const messages: string[] = [];
  const original = vscode.window.showErrorMessage;
  const windowWithStub = vscode.window as typeof vscode.window & {
    showErrorMessage: typeof vscode.window.showErrorMessage;
  };

  windowWithStub.showErrorMessage = ((message: string) => {
    messages.push(message);
    return Promise.resolve(undefined);
  }) as typeof vscode.window.showErrorMessage;

  try {
    const result = await callback();
    return { result, messages };
  } finally {
    windowWithStub.showErrorMessage = original;
  }
}
