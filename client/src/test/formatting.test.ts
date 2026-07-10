import * as assert from "assert";
import * as vscode from "vscode";
import {
  activateAndOpen,
  getDocUri,
  replaceDocumentText,
  waitForDocumentTextChange,
  waitForStatusState,
} from "./helper";

suite("Should format SQL documents", () => {
  const docUri = getDocUri("format.sql");
  const rangeUri = getDocUri("range.sql");
  const originalFullDocument = "select A from B\n";
  const originalRangeDocument = "select a from b;\n";
  const expectedFullDocument = ["select", "\ta\tas\ta", "from", "\tb", ""].join(
    "\n",
  );
  const expectedSelectedRange = [
    "select",
    "\ta\tas\ta",
    "from",
    "\tb",
    ";",
    "",
  ].join("\n");
  const invalidFullDocument = "select from\n";
  const invalidRangeDocument = "select from;\n";

  const resetFormattingFixtures = async (): Promise<void> => {
    await vscode.workspace.fs.writeFile(
      docUri,
      Buffer.from(originalFullDocument),
    );
    await vscode.workspace.fs.writeFile(
      rangeUri,
      Buffer.from(originalRangeDocument),
    );
  };

  setup(resetFormattingFixtures);
  teardown(resetFormattingFixtures);

  const selectFullDocument = (document: vscode.TextDocument) => {
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length),
    );
    vscode.window.activeTextEditor!.selection = new vscode.Selection(
      fullRange.start,
      fullRange.end,
    );
  };

  test("Formats an entire SQL document", async () => {
    const document = await activateAndOpen(docUri);
    const original = document.getText();
    await vscode.commands.executeCommand("editor.action.formatDocument");
    const formatted = await waitForDocumentTextChange(docUri, original);
    const status = await waitForStatusState("normal");

    assert.notStrictEqual(formatted, original);
    assert.strictEqual(formatted, expectedFullDocument);
    assert.strictEqual(status, "normal");
  });

  test("Marks status as error for document formatting failures and recovers on success", async () => {
    const document = await activateAndOpen(docUri);
    await replaceDocumentText(document, invalidFullDocument);
    const invalidText = document.getText();

    await vscode.commands.executeCommand("editor.action.formatDocument");
    const errorStatus = await waitForStatusState("error");
    const unchangedAfterFailure = document.getText();

    assert.strictEqual(unchangedAfterFailure, invalidText);
    assert.strictEqual(errorStatus, "error");

    await replaceDocumentText(document, originalFullDocument);
    const recoverySource = document.getText();

    await vscode.commands.executeCommand("editor.action.formatDocument");
    const recoveredText = await waitForDocumentTextChange(
      docUri,
      recoverySource,
    );
    const recoveredStatus = await waitForStatusState("normal");

    assert.strictEqual(recoveredText, expectedFullDocument);
    assert.strictEqual(recoveredStatus, "normal");
  });

  test("Formats a selected SQL range", async () => {
    const document = await activateAndOpen(rangeUri);
    const original = document.getText();
    selectFullDocument(document);

    await vscode.commands.executeCommand("editor.action.formatSelection");
    const formatted = await waitForDocumentTextChange(rangeUri, original);
    const status = await waitForStatusState("normal");

    assert.notStrictEqual(formatted, original);
    assert.strictEqual(formatted, expectedSelectedRange);
    assert.strictEqual(status, "normal");
  });

  test("Marks status as error for range formatting failures and recovers on success", async () => {
    const document = await activateAndOpen(rangeUri);
    await replaceDocumentText(document, invalidRangeDocument);
    selectFullDocument(document);
    const invalidText = document.getText();

    await vscode.commands.executeCommand("editor.action.formatSelection");
    const errorStatus = await waitForStatusState("error");
    const unchangedAfterFailure = document.getText();

    assert.strictEqual(unchangedAfterFailure, invalidText);
    assert.strictEqual(errorStatus, "error");

    await replaceDocumentText(document, originalRangeDocument);
    selectFullDocument(document);
    const recoverySource = document.getText();

    await vscode.commands.executeCommand("editor.action.formatSelection");
    const recoveredText = await waitForDocumentTextChange(
      rangeUri,
      recoverySource,
    );
    const recoveredStatus = await waitForStatusState("normal");

    assert.strictEqual(recoveredText, expectedSelectedRange);
    assert.strictEqual(recoveredStatus, "normal");
  });
});
