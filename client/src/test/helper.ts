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
  return new Promise<string>((resolve, reject) => {
    let completed = false;
    const timeoutTimer = setTimeout(() => {
      finish(reject, toTimeoutError(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const subscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== docUri.toString()) {
        return;
      }
      const text = event.document.getText();
      if (predicate(text)) {
        finish(resolve, text);
      }
    });

    const finish = (
      settle: typeof resolve | typeof reject,
      value: string | Error,
    ) => {
      if (completed) {
        return;
      }
      completed = true;
      clearTimeout(timeoutTimer);
      subscription.dispose();
      settle(value as string & Error);
    };

    void vscode.workspace.openTextDocument(docUri).then(
      (document) => {
        const text = document.getText();
        if (predicate(text)) {
          finish(resolve, text);
        }
      },
      (error) => {
        finish(
          reject,
          error instanceof Error ? error : new Error(String(error)),
        );
      },
    );
  });
}

export async function waitForDiagnostics(
  docUri: vscode.Uri,
  predicate: (value: readonly vscode.Diagnostic[]) => boolean,
  timeoutMs: number = 10_000,
): Promise<readonly vscode.Diagnostic[]> {
  return new Promise<readonly vscode.Diagnostic[]>((resolve, reject) => {
    let completed = false;
    const timeoutTimer = setTimeout(() => {
      finish(reject, toTimeoutError(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const evaluate = () => {
      const diagnostics = vscode.languages.getDiagnostics(docUri);
      if (predicate(diagnostics)) {
        finish(resolve, diagnostics);
      }
    };

    const subscription = vscode.languages.onDidChangeDiagnostics((event) => {
      if (event.uris.some((uri) => uri.toString() === docUri.toString())) {
        evaluate();
      }
    });

    const finish = (
      settle: typeof resolve | typeof reject,
      value: readonly vscode.Diagnostic[] | Error,
    ) => {
      if (completed) {
        return;
      }
      completed = true;
      clearTimeout(timeoutTimer);
      subscription.dispose();
      settle(value as readonly vscode.Diagnostic[] & Error);
    };

    evaluate();
  });
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

    const clearStableTimer = () => {
      if (stableTimer) {
        clearTimeout(stableTimer);
        stableTimer = undefined;
      }
    };

    const evaluate = () => {
      const diagnostics = vscode.languages.getDiagnostics(docUri);

      if (!predicate(diagnostics)) {
        clearStableTimer();
        return;
      }

      clearStableTimer();
      stableTimer = setTimeout(() => {
        finish(resolve, vscode.languages.getDiagnostics(docUri));
      }, stableForMs);
    };

    const subscription = vscode.languages.onDidChangeDiagnostics((event) => {
      if (event.uris.some((uri) => uri.toString() === docUri.toString())) {
        evaluate();
      }
    });

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
  value: string,
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace,
): Promise<void> {
  await vscode.workspace
    .getConfiguration("uroborosql-fmt", docUri)
    .update("lintConfigurationFilePath", value, target);
}
