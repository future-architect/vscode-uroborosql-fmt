import * as assert from "assert";
import {
  activateAndOpen,
  getDocUri,
  replaceDocumentText,
  waitForDiagnostics,
} from "./helper";

suite("Should get diagnostics", () => {
  const docUri = getDocUri("diagnostics.sql");

  test("Publishes diagnostics after save", async () => {
    const document = await activateAndOpen(docUri);
    const originalText = document.getText();

    try {
      await replaceDocumentText(document, "select from");

      const actualDiagnostics = await waitForDiagnostics(
        docUri,
        (value) => value.length > 0,
      );

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
