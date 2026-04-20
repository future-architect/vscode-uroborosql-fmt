import * as assert from "assert";
import * as vscode from "vscode";

import {
  activate,
  executeCommandWithWait,
  getDocUri,
  waitFor,
} from "./helper";

suite("Should format embedded SQL selections", () => {
  const docUri = getDocUri("embedded.ts");

  test("Formats the selected text as SQL", async () => {
    const document = await activate(docUri);
    const original = document.getText();
    const start = document.getText().indexOf("select distinct id from users");
    assert.notStrictEqual(start, -1);
    const end = start + "select distinct id from users".length;
    const selection = new vscode.Selection(
      document.positionAt(start),
      document.positionAt(end),
    );
    vscode.window.activeTextEditor!.selections = [selection];

    await executeCommandWithWait("uroborosql-fmt.format-selection-as-sql");
    const formattedDocument = await waitFor(
      () => vscode.workspace.openTextDocument(docUri),
      (value) => value.getText() !== original,
    );
    const formatted = formattedDocument.getText();

    assert.notStrictEqual(formatted, original);
    assert.match(formatted, /select\n\tdistinct\n\tid\tas\tid\nfrom\n\tusers/);
    assert.match(formatted, /const sql = `select/);
  });
});
