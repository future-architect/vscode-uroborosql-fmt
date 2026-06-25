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
  // Both rules are on by default, so each project's config turns the *other*
  // rule off. The disabled rule showing up would mean the wrong workspace
  // config was used (e.g. the sibling folder's, or none at all). The document
  // text triggers both rules, so only the config decides what surfaces.
  test("project-a uses its own config (no-distinct on, no-wildcard off)", async () => {
    const docUri = getMultirootDocUri("project-a/query.sql");
    await activate(docUri);

    const diagnostics = await waitForDiagnostics(docUri, (value) =>
      hasCode(value, "no-distinct"),
    );

    const distinct = diagnostics.find((d) => d.code === "no-distinct");
    assert.ok(distinct);
    assert.strictEqual(distinct.severity, vscode.DiagnosticSeverity.Error);
    // Disabled in project-a's config; its presence would mean a foreign config.
    assert.ok(!hasCode(diagnostics, "no-wildcard-projection"));
  });

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
        "",
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
