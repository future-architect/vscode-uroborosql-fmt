import * as assert from "assert";
import * as vscode from "vscode";
import { activate, getDocUri, replaceDocumentText, waitFor } from "./helper";

suite("Should get diagnostics", () => {
  const docUri = getDocUri("diagnostics.sql");

  test("Publishes diagnostics after save", async () => {
    const document = await activate(docUri);
    const originalText = document.getText();

    try {
      await replaceDocumentText(document, "select from");

      const actualDiagnostics = await waitFor(
        async () => vscode.languages.getDiagnostics(docUri),
        (value) => value.length > 0,
      );

      assert.ok(actualDiagnostics.length > 0);
      assert.ok(
        actualDiagnostics.some(
          (diagnostic) =>
            diagnostic.source === "uroborosql-lint" &&
            diagnostic.message.includes("Failed to parse SQL"),
        ),
      );
    } finally {
      await replaceDocumentText(document, originalText);
    }
  });
});
