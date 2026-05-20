import * as assert from "assert";
import * as vscode from "vscode";

import {
  activate,
  captureErrorMessages,
  executeCommandWithWait,
  getDocUri,
  replaceDocumentText,
  waitFor,
} from "./helper";

suite("Should format SQL as command-driven selections", () => {
  const embeddedDocUri = getDocUri("embedded.ts");
  const invalidEmbeddedDocUri = getDocUri("embedded-invalid-sql.ts");
  const sqlDocUri = getDocUri("format-command.sql");
  const wholeDocumentAsSqlUri = getDocUri("whole-document-as-sql.txt");

  const embeddedSql = "select distinct id from users";
  const formattedEmbeddedSql =
    /select\n\tdistinct\n\tid\tas\tid\nfrom\n\tusers/;

  test("Formats the selected embedded SQL", async () => {
    const document = await activate(embeddedDocUri);
    await replaceDocumentText(
      document,
      `export const sql = \`${embeddedSql}\`;\n`,
    );
    const original = document.getText();
    const start = document.getText().indexOf(embeddedSql);
    assert.notStrictEqual(start, -1);
    const end = start + embeddedSql.length;
    const selection = new vscode.Selection(
      document.positionAt(start),
      document.positionAt(end),
    );
    vscode.window.activeTextEditor!.selections = [selection];

    await executeCommandWithWait("uroborosql-fmt.format-selection-as-sql");
    const formattedDocument = await waitFor(
      () => vscode.workspace.openTextDocument(embeddedDocUri),
      (value) => value.getText() !== original,
    );
    const formatted = formattedDocument.getText();

    assert.notStrictEqual(formatted, original);
    assert.match(formatted, formattedEmbeddedSql);
    assert.match(formatted, /const sql = `select/);
  });

  test("Formats the selected embedded SQL through Format SQL", async () => {
    const document = await activate(embeddedDocUri);
    await replaceDocumentText(
      document,
      `export const sql = \`${embeddedSql}\`;\n`,
    );
    const original = document.getText();
    const start = document.getText().indexOf(embeddedSql);
    assert.notStrictEqual(start, -1);
    const selection = new vscode.Selection(
      document.positionAt(start),
      document.positionAt(start + embeddedSql.length),
    );
    vscode.window.activeTextEditor!.selections = [selection];

    await executeCommandWithWait("uroborosql-fmt.uroborosql-format");
    const formattedDocument = await waitFor(
      () => vscode.workspace.openTextDocument(embeddedDocUri),
      (value) => value.getText() !== original,
    );
    const formatted = formattedDocument.getText();

    assert.notStrictEqual(formatted, original);
    assert.match(formatted, formattedEmbeddedSql);
    assert.match(formatted, /const sql = `select/);
  });

  test("Formats an entire SQL document through Format SQL", async () => {
    const document = await activate(sqlDocUri);
    await replaceDocumentText(document, "select A from B\n");
    const original = document.getText();
    vscode.window.activeTextEditor!.selections = [
      new vscode.Selection(document.positionAt(0), document.positionAt(0)),
    ];

    await executeCommandWithWait("uroborosql-fmt.uroborosql-format");
    const formattedDocument = await waitFor(
      () => vscode.workspace.openTextDocument(sqlDocUri),
      (value) => value.getText() !== original,
    );
    const formatted = formattedDocument.getText();

    assert.notStrictEqual(formatted, original);
    assert.match(formatted, /from\n\tb/);
    assert.match(formatted, /a\tas\ta/);
  });

  test("Formats a non-SQL document as a whole document through Format SQL", async () => {
    const document = await activate(wholeDocumentAsSqlUri);
    await replaceDocumentText(document, "select distinct id from users\n");
    const original = document.getText();
    vscode.window.activeTextEditor!.selections = [
      new vscode.Selection(document.positionAt(0), document.positionAt(0)),
    ];

    await executeCommandWithWait("uroborosql-fmt.uroborosql-format");
    const formattedDocument = await waitFor(
      () => vscode.workspace.openTextDocument(wholeDocumentAsSqlUri),
      (value) => value.getText() !== original,
    );
    const formatted = formattedDocument.getText();

    assert.notStrictEqual(formatted, original);
    assert.match(formatted, formattedEmbeddedSql);
  });

  test("Rejects overlapping selections before sending the request", async () => {
    const document = await activate(embeddedDocUri);
    await replaceDocumentText(
      document,
      `export const sql = \`${embeddedSql}\`;\n`,
    );
    const original = document.getText();
    const start = document.getText().indexOf(embeddedSql);
    assert.notStrictEqual(start, -1);
    const first = new vscode.Selection(
      document.positionAt(start),
      document.positionAt(start + 12),
    );
    const second = new vscode.Selection(
      document.positionAt(start + 8),
      document.positionAt(start + embeddedSql.length),
    );
    vscode.window.activeTextEditor!.selections = [first, second];

    const { messages } = await captureErrorMessages(async () => {
      await executeCommandWithWait("uroborosql-fmt.format-selection-as-sql");
    });

    const latestDocument =
      await vscode.workspace.openTextDocument(embeddedDocUri);
    assert.strictEqual(latestDocument.getText(), original);
    assert.deepStrictEqual(messages, ["Selections must not overlap."]);
  });

  test("Shows a format failure when embedded SQL cannot be parsed", async () => {
    const document = await activate(invalidEmbeddedDocUri);
    const original = document.getText();
    const start = document.getText().indexOf("select from");
    assert.notStrictEqual(start, -1);
    vscode.window.activeTextEditor!.selections = [
      new vscode.Selection(
        document.positionAt(start),
        document.positionAt(start + "select from".length),
      ),
    ];

    const { messages } = await captureErrorMessages(async () => {
      await executeCommandWithWait("uroborosql-fmt.format-selection-as-sql");
    });

    const latestDocument = await vscode.workspace.openTextDocument(
      invalidEmbeddedDocUri,
    );
    assert.strictEqual(latestDocument.getText(), original);
    assert.strictEqual(messages.length, 1);
    assert.match(messages[0], /^Format failed: /);
  });
});
