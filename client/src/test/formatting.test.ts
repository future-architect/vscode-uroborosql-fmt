import * as assert from "assert";
import * as vscode from "vscode";
import { activate, getDocUri, waitForDocumentTextChange } from "./helper";

suite("Should format SQL documents", () => {
  const docUri = getDocUri("format.sql");
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

  test("Formats an entire SQL document", async () => {
    const document = await activate(docUri);
    const original = document.getText();
    await vscode.commands.executeCommand("editor.action.formatDocument");
    const formatted = await waitForDocumentTextChange(docUri, original);

    assert.notStrictEqual(formatted, original);
    assert.strictEqual(formatted, expectedFullDocument);
  });

  test("Formats a selected SQL range", async () => {
    const rangeUri = getDocUri("range.sql");
    const document = await activate(rangeUri);
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length),
    );
    const original = document.getText();
    vscode.window.activeTextEditor!.selection = new vscode.Selection(
      fullRange.start,
      fullRange.end,
    );

    await vscode.commands.executeCommand("editor.action.formatSelection");
    const formatted = await waitForDocumentTextChange(rangeUri, original);

    assert.notStrictEqual(formatted, original);
    assert.strictEqual(formatted, expectedSelectedRange);
  });
});
