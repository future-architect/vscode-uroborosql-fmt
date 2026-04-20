import * as assert from "assert";
import * as vscode from "vscode";
import { activate, executeCommandWithWait, getDocUri, waitFor } from "./helper";

suite("Should format SQL documents", () => {
  const docUri = getDocUri("format.sql");

  test("Formats an entire SQL document", async () => {
    const document = await activate(docUri);
    const original = document.getText();
    await executeCommandWithWait("editor.action.formatDocument");
    const formattedDocument = await waitFor(
      () => vscode.workspace.openTextDocument(docUri),
      (value) => value.getText() !== original,
    );
    const formatted = formattedDocument.getText();

    assert.notStrictEqual(formatted, original);
    assert.match(formatted, /from\n\tb/);
    assert.match(formatted, /a\tas\ta/);
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

    await executeCommandWithWait("editor.action.formatSelection");
    const formattedDocument = await waitFor(
      () => vscode.workspace.openTextDocument(rangeUri),
      (value) => value.getText() !== original,
    );
    const formatted = formattedDocument.getText();

    assert.notStrictEqual(formatted, original);
    assert.match(formatted, /from\n\tb/);
    assert.match(formatted, /a\tas\ta/);
  });
});
