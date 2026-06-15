import * as assert from "assert";
import * as vscode from "vscode";

import { activate, getDocUri, replaceDocumentText, waitFor } from "./helper";

suite("Code Action E2E", () => {
  test("Offers a quick fix that inserts disable-next-line", async () => {
    const docUri = getDocUri("lint/distinct.sql");
    const document = await activate(docUri);
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

  test("Offers a quick fix that appends to an existing directive", async () => {
    const docUri = getDocUri("lint/append.sql");
    const document = await activate(docUri);
    const originalText = document.getText();

    try {
      const diagnostic = await waitForLintDiagnostic(
        docUri,
        "no-wildcard-projection",
      );
      const action = await waitForQuickFix(docUri, diagnostic, (candidate) => {
        return (
          candidate.title === "Disable no-wildcard-projection for next line"
        );
      });

      assert.ok(action.edit);
      const edit = firstDocumentEdit(action, docUri);
      assert.strictEqual(edit.newText, ", no-wildcard-projection");
      assert.strictEqual(edit.range.start.line, 0);
      assert.strictEqual(edit.range.start.character, 48);
      assert.strictEqual(edit.range.end.line, 0);
      assert.strictEqual(edit.range.end.character, 48);
    } finally {
      await replaceDocumentText(document, originalText);
    }
  });

  test("Offers a quick fix that removes an unknown lint rule", async () => {
    const docUri = getDocUri("lint/unknown-rule.sql");
    const document = await activate(docUri);
    const originalText = document.getText();

    try {
      const diagnostic = await waitForLintDiagnostic(
        docUri,
        "invalid-lint-directive",
      );
      const action = await waitForQuickFix(docUri, diagnostic, (candidate) => {
        return candidate.title === "Remove unknown lint rule";
      });

      assert.ok(action.edit);
      const applied = await vscode.workspace.applyEdit(action.edit);
      assert.strictEqual(applied, true);

      const updatedDocument = await waitFor(
        () => vscode.workspace.openTextDocument(docUri),
        (value) =>
          value.getText() ===
          [
            "-- uroborosql-lint-disable-next-line no-distinct",
            "SELECT DISTINCT id",
            "FROM users;",
            "",
          ].join("\n"),
      );

      assert.strictEqual(
        updatedDocument.getText(),
        [
          "-- uroborosql-lint-disable-next-line no-distinct",
          "SELECT DISTINCT id",
          "FROM users;",
          "",
        ].join("\n"),
      );
    } finally {
      await replaceDocumentText(document, originalText);
    }
  });
});

async function waitForLintDiagnostic(
  docUri: vscode.Uri,
  code: string,
): Promise<vscode.Diagnostic> {
  const diagnostics = await waitFor(
    async () => vscode.languages.getDiagnostics(docUri),
    (value) =>
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
