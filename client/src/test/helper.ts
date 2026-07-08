import * as vscode from "vscode";
import * as path from "path";

const EXTENSION_ID = "Future.uroborosql-fmt";
const DEFAULT_TIMEOUT_MS = 10_000;

type ExtensionApi = {
  onReady(): Promise<void>;
  getStatusState(): "normal" | "error";
};

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

export async function getStatusState(): Promise<"normal" | "error"> {
  const api = await activateExtension();
  return api.getStatusState();
}

export async function waitForStatusState(
  expected: "normal" | "error",
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<"normal" | "error"> {
  return waitFor(
    () => getStatusState(),
    (value) => value === expected,
    timeoutMs,
    50,
    `Timed out waiting for status state ${expected}`,
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

/**
 * Resolve once `evaluate()` returns a defined value. `subscribe` registers a
 * listener that calls `notify` whenever the value might have changed; the value
 * is also evaluated eagerly so an already-satisfied condition resolves at once.
 */
function waitForEvent<T>(
  subscribe: (notify: () => void) => vscode.Disposable,
  evaluate: () => Thenable<T | undefined> | T | undefined,
  timeoutMessage: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutTimer = setTimeout(() => {
      cleanup();
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeoutTimer);
      subscription.dispose();
    };

    const check = async () => {
      try {
        const value = await evaluate();
        if (value !== undefined) {
          cleanup();
          resolve(value);
        }
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    const subscription = subscribe(() => void check());
    void check();
  });
}

function onDiagnosticsChange(uri: vscode.Uri, notify: () => void) {
  return vscode.languages.onDidChangeDiagnostics((event) => {
    if (
      event.uris.some((candidate) => candidate.toString() === uri.toString())
    ) {
      notify();
    }
  });
}

export async function waitForDiagnostics(
  docUri: vscode.Uri,
  predicate: (value: readonly vscode.Diagnostic[]) => boolean,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<readonly vscode.Diagnostic[]> {
  return waitForEvent(
    (notify) => onDiagnosticsChange(docUri, notify),
    () => {
      const diagnostics = vscode.languages.getDiagnostics(docUri);
      return predicate(diagnostics) ? diagnostics : undefined;
    },
    `Timed out after ${timeoutMs}ms waiting for diagnostics on ${docUri.fsPath}`,
    timeoutMs,
  );
}

/**
 * Resolve once `predicate` over the diagnostics has held continuously for
 * `stableForMs`. Used to assert the *absence* of a change: the value must
 * settle and stay settled rather than merely be reached once.
 */
export async function waitForDiagnosticsStability(
  docUri: vscode.Uri,
  predicate: (value: readonly vscode.Diagnostic[]) => boolean,
  stableForMs: number,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<readonly vscode.Diagnostic[]> {
  const read = () => vscode.languages.getDiagnostics(docUri);
  return new Promise<readonly vscode.Diagnostic[]>((resolve, reject) => {
    let stableTimer: NodeJS.Timeout | undefined;
    const timeoutTimer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Timed out after ${timeoutMs}ms waiting ${stableForMs}ms for stable diagnostics on ${docUri.fsPath}`,
        ),
      );
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeoutTimer);
      if (stableTimer) {
        clearTimeout(stableTimer);
      }
      subscription.dispose();
    };

    const evaluate = () => {
      if (stableTimer) {
        clearTimeout(stableTimer);
        stableTimer = undefined;
      }
      if (!predicate(read())) {
        return;
      }
      stableTimer = setTimeout(() => {
        cleanup();
        resolve(read());
      }, stableForMs);
    };

    const subscription = onDiagnosticsChange(docUri, evaluate);
    evaluate();
  });
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

/**
 * Run `callback` while capturing every `window.showErrorMessage` call. When
 * `expectedMessage` is given, wait until a matching message has been captured.
 */
export async function captureErrorMessages(
  callback: () => Promise<void>,
  expectedMessage?: string | RegExp,
): Promise<string[]> {
  const messages: string[] = [];
  // `showErrorMessage` is a read-only namespace binding at the type level, so a
  // mutable view is needed to swap it out for the duration of `callback`.
  const windowStub = vscode.window as {
    showErrorMessage: typeof vscode.window.showErrorMessage;
  };
  const original = windowStub.showErrorMessage;

  windowStub.showErrorMessage = ((message: string) => {
    messages.push(message);
    return Promise.resolve(undefined);
  }) as typeof vscode.window.showErrorMessage;

  try {
    await callback();
    if (expectedMessage !== undefined) {
      await waitFor(
        () => messages,
        (value) =>
          value.some((message) =>
            typeof expectedMessage === "string"
              ? message === expectedMessage
              : expectedMessage.test(message),
          ),
        undefined,
        undefined,
        `Timed out waiting for error message matching ${expectedMessage}`,
      );
    }
    return messages;
  } finally {
    windowStub.showErrorMessage = original;
  }
}

export async function updateLintConfigurationFilePath(
  docUri: vscode.Uri,
  value: string | null,
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace,
): Promise<void> {
  await vscode.workspace
    .getConfiguration("uroborosql-fmt", docUri)
    .update("lintConfigurationFilePath", value, target);
}
