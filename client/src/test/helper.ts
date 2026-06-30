import * as vscode from "vscode";
import * as path from "path";

const EXTENSION_ID = "Future.uroborosql-fmt";
const DEFAULT_TIMEOUT_MS = 10_000;

type ExtensionApi = { onReady(): Promise<void> };

export async function activateExtension(): Promise<ExtensionApi> {
  const ext = vscode.extensions.getExtension<ExtensionApi>(EXTENSION_ID);
  if (!ext) {
    throw new Error(`Extension not found: ${EXTENSION_ID}`);
  }
  return ext.activate();
}

export async function activateAndOpen(
  docUri: vscode.Uri,
): Promise<vscode.TextDocument> {
  await waitForLanguageClientReady();
  const doc = await vscode.workspace.openTextDocument(docUri);
  await vscode.window.showTextDocument(doc);
  return doc;
}

export async function waitForLanguageClientReady(
  timeoutMs = 30_000,
): Promise<void> {
  const api = await activateExtension();
  await withTimeout(
    api.onReady(),
    timeoutMs,
    "Timed out waiting for the language client to become ready",
  );
}

const getDocPath = (p: string): string =>
  path.resolve(__dirname, "../../testFixture", p);

export const getDocUri = (p: string): vscode.Uri =>
  vscode.Uri.file(getDocPath(p));

export function getWorkspaceFolderUri(): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error("No workspace folder is open");
  }
  return folder.uri;
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function waitFor<T>(
  getValue: () => Thenable<T> | T,
  predicate: (value: T) => boolean,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  intervalMs = 50,
  timeoutMessage?: string,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await getValue();
    if (predicate(value)) {
      return value;
    }
    if (Date.now() >= deadline) {
      throw new Error(timeoutMessage ?? `Timed out after ${timeoutMs}ms`);
    }
    await delay(intervalMs);
  }
}

export async function waitForDocumentTextChange(
  docUri: vscode.Uri,
  previousText: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Timed out after ${timeoutMs}ms waiting for ${docUri.fsPath} text to change`,
        ),
      );
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      subscription.dispose();
    };

    const check = () => {
      const editor = vscode.window.visibleTextEditors.find(
        (candidate) => candidate.document.uri.toString() === docUri.toString(),
      );
      const text = editor?.document.getText();
      if (text !== undefined && text !== previousText) {
        cleanup();
        resolve(text);
      }
    };

    const subscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === docUri.toString()) {
        check();
      }
    });
    check();
  });
}
