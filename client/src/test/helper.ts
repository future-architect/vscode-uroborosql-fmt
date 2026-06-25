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

const getDocPath = (p: string) => {
  return path.resolve(__dirname, "../../testFixture", p);
};
export const getDocUri = (p: string) => {
  return vscode.Uri.file(getDocPath(p));
};

const toTimeoutError = (message: string) => new Error(message);

function waitForCondition<T>(
  subscribe: (notify: () => void) => vscode.Disposable,
  evaluate: () => Thenable<T | undefined> | T | undefined,
  timeoutMessage: string,
  timeoutMs: number = 10_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let completed = false;
    const timeoutTimer = setTimeout(() => {
      finish(reject, toTimeoutError(timeoutMessage));
    }, timeoutMs);

    const finish = (
      settle: typeof resolve | typeof reject,
      value: T | Error,
    ) => {
      if (completed) {
        return;
      }
      completed = true;
      clearTimeout(timeoutTimer);
      subscription.dispose();
      settle(value as T & Error);
    };

    const check = async () => {
      try {
        const value = await evaluate();
        if (value !== undefined) {
          finish(resolve, value);
        }
      } catch (error) {
        finish(
          reject,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    };

    const subscription = subscribe(() => {
      void check();
    });

    void check();
  });
}

export async function waitForDocumentTextChange(
  docUri: vscode.Uri,
  previousText: string,
  timeoutMs: number = 10_000,
): Promise<string> {
  return waitForDocumentText(
    docUri,
    (value) => value !== previousText,
    timeoutMs,
  );
}

export async function waitForDocumentText(
  docUri: vscode.Uri,
  predicate: (value: string) => boolean,
  timeoutMs: number = 10_000,
): Promise<string> {
  return waitForCondition(
    (notify) => subscribeToDocument(docUri, notify),
    async () => {
      const text = (await vscode.workspace.openTextDocument(docUri)).getText();
      return predicate(text) ? text : undefined;
    },
    `Timed out after ${timeoutMs}ms`,
    timeoutMs,
  );
}

function subscribeToDocument(uri: vscode.Uri, notify: () => void) {
  return vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document.uri.toString() !== uri.toString()) {
      return;
    }
    notify();
  });
}

function subscribeToDiagnostics(uri: vscode.Uri, notify: () => void) {
  return vscode.languages.onDidChangeDiagnostics((event) => {
    if (
      event.uris.some((candidate) => candidate.toString() === uri.toString())
    ) {
      notify();
    }
  });
}

function currentDiagnostics(docUri: vscode.Uri): readonly vscode.Diagnostic[] {
  return vscode.languages.getDiagnostics(docUri);
}

export async function waitForDiagnostics(
  docUri: vscode.Uri,
  predicate: (value: readonly vscode.Diagnostic[]) => boolean,
  timeoutMs: number = 10_000,
): Promise<readonly vscode.Diagnostic[]> {
  return waitForCondition(
    (notify) => subscribeToDiagnostics(docUri, notify),
    () => {
      const diagnostics = currentDiagnostics(docUri);
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
  timeoutMs: number = 10_000,
): Promise<readonly vscode.Diagnostic[]> {
  return new Promise<readonly vscode.Diagnostic[]>((resolve, reject) => {
    let completed = false;
    let stableTimer: NodeJS.Timeout | undefined;
    const timeoutTimer = setTimeout(() => {
      finish(
        reject,
        toTimeoutError(
          `Timed out after ${timeoutMs}ms waiting ${stableForMs}ms for stable diagnostics`,
        ),
      );
    }, timeoutMs);

    const subscription = subscribeToDiagnostics(docUri, () => {
      evaluate();
    });

    const clearStableTimer = () => {
      if (stableTimer) {
        clearTimeout(stableTimer);
        stableTimer = undefined;
      }
    };

    const finish = (
      settle: typeof resolve | typeof reject,
      value: readonly vscode.Diagnostic[] | Error,
    ) => {
      if (completed) {
        return;
      }
      completed = true;
      clearTimeout(timeoutTimer);
      clearStableTimer();
      subscription.dispose();
      settle(value as readonly vscode.Diagnostic[] & Error);
    };

    const evaluate = () => {
      const diagnostics = currentDiagnostics(docUri);

      if (!predicate(diagnostics)) {
        clearStableTimer();
        return;
      }

      clearStableTimer();
      stableTimer = setTimeout(() => {
        finish(resolve, currentDiagnostics(docUri));
      }, stableForMs);
    };

    evaluate();
  });
}

export async function waitFor<T>(
  getValue: () => Thenable<T> | T,
  predicate: (value: T) => boolean,
  timeoutMs: number = 10_000,
  intervalMs: number = 100,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let completed = false;
    let attemptTimer: NodeJS.Timeout | undefined;
    const timeoutTimer = setTimeout(() => {
      finish(reject, toTimeoutError(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const finish = (
      settle: typeof resolve | typeof reject,
      value: T | Error,
    ) => {
      if (completed) {
        return;
      }
      completed = true;
      clearTimeout(timeoutTimer);
      if (attemptTimer) {
        clearTimeout(attemptTimer);
      }
      settle(value as T & Error);
    };

    const attempt = async () => {
      if (completed) {
        return;
      }

      try {
        const value = await getValue();
        if (predicate(value)) {
          finish(resolve, value);
          return;
        }
      } catch (error) {
        finish(
          reject,
          error instanceof Error ? error : new Error(String(error)),
        );
        return;
      }

      attemptTimer = setTimeout(attempt, intervalMs);
    };

    void attempt();
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

export async function captureErrorMessages<T>(
  callback: () => Promise<T>,
  expectedMessage?: string | RegExp,
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
    return { result, messages };
  } finally {
    windowWithStub.showErrorMessage = original;
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
