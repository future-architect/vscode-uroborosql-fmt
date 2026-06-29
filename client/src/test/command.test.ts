import * as assert from "assert";
import * as vscode from "vscode";

import {
  activateAndOpen,
  getDocUri,
  waitForDocumentTextChange,
} from "./helper";

suite("Format SQL command", () => {
  test("formats the whole document when there is no selection", async () => {
    const docUri = getDocUri("format-whole.txt");
    const document = await activateAndOpen(docUri);
    const original = document.getText();

    vscode.window.activeTextEditor!.selections = [
      new vscode.Selection(document.positionAt(0), document.positionAt(0)),
    ];

    await vscode.commands.executeCommand("uroborosql-fmt.uroborosql-format");
    const formatted = await waitForDocumentTextChange(docUri, original);

    const expected = [
      "select",
      "\tdistinct",
      "\tid\tas\tid",
      "from",
      "\tusers",
      "",
    ].join("\n");
    assert.strictEqual(formatted, expected);
  });

  test("formats only the selected range and leaves the rest unchanged", async () => {
    const docUri = getDocUri("format-range.txt");
    const document = await activateAndOpen(docUri);
    const original = document.getText();

    const firstLineEnd = document.lineAt(0).range.end;
    vscode.window.activeTextEditor!.selections = [
      new vscode.Selection(new vscode.Position(0, 0), firstLineEnd),
    ];

    await vscode.commands.executeCommand("uroborosql-fmt.uroborosql-format");
    const formatted = await waitForDocumentTextChange(docUri, original);

    const expected = [
      "select",
      "\ta\tas\ta",
      "from",
      "\tb",
      "",
      "select c from d",
      "",
    ].join("\n");
    assert.strictEqual(formatted, expected);
  });
});
