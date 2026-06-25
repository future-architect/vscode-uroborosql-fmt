import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import {
  activate,
  updateLintConfigurationFilePath,
  waitForDiagnostics,
  waitForDiagnosticsStability,
} from "../helper";

const getMultirootDocUri = (p: string) =>
  vscode.Uri.file(path.resolve(__dirname, "../../../multirootFixture", p));

const hasCode = (diagnostics: readonly vscode.Diagnostic[], code: string) =>
  diagnostics.some((diagnostic) => diagnostic.code === code);

suite("Multi-root workspace E2E", () => {
  test("non-first folder (project-b) uses its own config (no-wildcard on, no-distinct off)", async () => {
    const docUri = getMultirootDocUri("project-b/query.sql");
    await activate(docUri);

    // project-b is the second workspace folder. Resolving to its config proves
    // resolution does not depend on workspaceFolders order.
    const diagnostics = await waitForDiagnostics(docUri, (value) =>
      hasCode(value, "no-wildcard-projection"),
    );

    const wildcard = diagnostics.find(
      (d) => d.code === "no-wildcard-projection",
    );
    assert.ok(wildcard);
    assert.strictEqual(wildcard.severity, vscode.DiagnosticSeverity.Error);
    assert.ok(!hasCode(diagnostics, "no-distinct"));
  });

  test("non-first folder resolves its explicit lint config without borrowing a sibling root", async () => {
    const docUri = getMultirootDocUri("project-b/query.sql");
    await updateLintConfigurationFilePath(
      docUri,
      "custom-lint.json",
      vscode.ConfigurationTarget.Workspace,
    );

    try {
      await activate(docUri);

      const diagnostics = await waitForDiagnostics(
        docUri,
        (value) =>
          hasCode(value, "no-distinct") &&
          hasCode(value, "no-wildcard-projection"),
      );

      assert.ok(hasCode(diagnostics, "no-distinct"));
      assert.ok(hasCode(diagnostics, "no-wildcard-projection"));
    } finally {
      await updateLintConfigurationFilePath(
        docUri,
        null,
        vscode.ConfigurationTarget.Workspace,
      );
    }
  });

  test("document outside every workspace folder gets no diagnostics", async () => {
    const docUri = getMultirootDocUri("outside.sql");
    await activate(docUri);

    // outside.sql lives under neither folder. It must not borrow another
    // workspace's config, so diagnostics stay empty.
    const diagnostics = await waitForDiagnosticsStability(
      docUri,
      (value) => value.length === 0,
      1_000,
      5_000,
    );

    assert.deepStrictEqual(diagnostics, []);
  });
});
