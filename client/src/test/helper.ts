import * as vscode from "vscode";
import * as path from "path";

const EXTENSION_ID = "Future.uroborosql-fmt";
const DEFAULT_TIMEOUT_MS = 10_000;

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

const getDocPath = (p: string) => {
  return path.resolve(__dirname, "../../testFixture", p);
};
export const getDocUri = (p: string) => {
  return vscode.Uri.file(getDocPath(p));
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

/**
 * Resolve once `predicate(read())` has held continuously for `stableForMs`.
 * Used to assert the *absence* of a change: the value must settle and stay
 * settled rather than merely be reached once.
 */
function waitForStableEvent<T>(
  subscribe: (notify: () => void) => vscode.Disposable,
  read: () => T,
  predicate: (value: T) => boolean,
  stableForMs: number,
  timeoutMessage: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let stableTimer: NodeJS.Timeout | undefined;
    const timeoutTimer = setTimeout(() => {
      cleanup();
      reject(new Error(timeoutMessage));
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

    const subscription = subscribe(evaluate);
    evaluate();
  });
}

/** Poll `getValue()` until `predicate` holds; for state with no change event. */
export async function waitFor<T>(
  getValue: () => Thenable<T> | T,
  predicate: (value: T) => boolean,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  intervalMs: number = 100,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await getValue();
    if (predicate(value)) {
      return value;
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out after ${timeoutMs}ms`);
    }
    await delay(intervalMs);
  }
}

export async function waitForDocumentTextChange(
  docUri: vscode.Uri,
  previousText: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  return waitForEvent(
    (notify) =>
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() === docUri.toString()) {
          notify();
        }
      }),
    async () => {
      const text = (await vscode.workspace.openTextDocument(docUri)).getText();
      return text !== previousText ? text : undefined;
    },
    `Timed out after ${timeoutMs}ms`,
    timeoutMs,
  );
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
    `Timed out after ${timeoutMs}ms`,
    timeoutMs,
  );
}

export async function waitForDiagnosticsStability(
  docUri: vscode.Uri,
  predicate: (value: readonly vscode.Diagnostic[]) => boolean,
  stableForMs: number,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<readonly vscode.Diagnostic[]> {
  return waitForStableEvent(
    (notify) => onDiagnosticsChange(docUri, notify),
    () => vscode.languages.getDiagnostics(docUri),
    predicate,
    stableForMs,
    `Timed out after ${timeoutMs}ms waiting ${stableForMs}ms for stable diagnostics`,
    timeoutMs,
  );
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
