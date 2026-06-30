import * as assert from "assert";
import * as vscode from "vscode";

import {
  activateAndOpen,
  getDocUri,
  replaceDocumentText,
  updateLintConfigurationFilePath,
  waitForDiagnostics,
  waitForDiagnosticsStability,
  waitFor,
} from "./helper";

suite("Code Action E2E", () => {
  test("Offers a quick fix that inserts disable-next-line", async () => {
    const docUri = getDocUri("lint/distinct.sql");
    const document = await activateAndOpen(docUri);
    const originalText = document.getText();

    try {
      const diagnostic = await waitForLintDiagnostic(docUri, "no-distinct");
      const action = await waitForQuickFix(docUri, diagnostic, (candidate) => {
        return candidate.title === "Disable no-distinct for next line";
      });

      assert.ok(action.edit);
      const edit = firstDocumentEdit(action, docUri);
      assert.strictEqual(
        edit.newText,
        "-- uroborosql-lint-disable-next-line no-distinct\n",
      );
      assert.strictEqual(edit.range.start.line, 0);
      assert.strictEqual(edit.range.start.character, 0);
    } finally {
      await replaceDocumentText(document, originalText);
    }
  });

  test("Offers no quick fix when lintConfigurationFilePath cannot be resolved", async () => {
    const docUri = getDocUri("lint/explicit-path.sql");
    await updateLintConfigurationFilePath(
      docUri,
      ".vscode/does-not-exist-lint.json",
    );

    try {
      await activateAndOpen(docUri);

      // Wait for diagnostics to settle empty as a sync barrier before asking
      // for code actions; lint.test.ts owns asserting the diagnostics are empty.
      await waitForDiagnosticsStability(
        docUri,
        (value) => value.length === 0,
        1_000,
        5_000,
      );

      const actions = await requestQuickFixes(
        docUri,
        new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
      );

      assert.deepStrictEqual(actions, []);
    } finally {
      await updateLintConfigurationFilePath(docUri, null);
    }
  });
});

async function waitForLintDiagnostic(
  docUri: vscode.Uri,
  code: string,
): Promise<vscode.Diagnostic> {
  const diagnostics = await waitForDiagnostics(docUri, (value) =>
    value.some(
      (diagnostic) =>
        diagnostic.source === "uroborosql-lint" && diagnostic.code === code,
    ),
  );

  const diagnostic = diagnostics.find(
    (candidate) =>
      candidate.source === "uroborosql-lint" && candidate.code === code,
  );
  assert.ok(diagnostic);
  return diagnostic;
}

async function waitForQuickFix(
  docUri: vscode.Uri,
  diagnostic: vscode.Diagnostic,
  predicate: (action: vscode.CodeAction) => boolean,
): Promise<vscode.CodeAction> {
  const actions = await waitFor(
    async () => requestQuickFixes(docUri, diagnostic.range),
    (value) => value.some(predicate),
    undefined,
    undefined,
    `Timed out waiting for a matching quick fix on ${docUri.fsPath}`,
  );

  const action = actions.find(predicate);
  assert.ok(action);
  return action;
}

async function requestQuickFixes(
  docUri: vscode.Uri,
  range: vscode.Range,
): Promise<vscode.CodeAction[]> {
  const actions =
    (await vscode.commands.executeCommand<vscode.CodeAction[]>(
      "vscode.executeCodeActionProvider",
      docUri,
      range,
      vscode.CodeActionKind.QuickFix.value,
    )) ?? [];

  return actions.filter((action) => action.kind?.value === "quickfix");
}

function firstDocumentEdit(
  action: vscode.CodeAction,
  docUri: vscode.Uri,
): vscode.TextEdit {
  assert.ok(action.edit);
  const edits = action.edit.get(docUri);
  assert.ok(edits);
  assert.ok(edits.length > 0);
  return edits[0];
}
