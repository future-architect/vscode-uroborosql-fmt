import * as assert from "assert";
import {
  activate,
  getDocUri,
  waitForDiagnostics,
  waitForDiagnosticsStability,
  updateLintConfigurationFilePath,
} from "./helper";

suite("Lint E2E", () => {
  test("Uses lintConfigurationFilePath when explicitly configured", async () => {
    const docUri = getDocUri("lint/explicit-path.sql");
    await updateLintConfigurationFilePath(docUri, ".vscode/lint-explicit.json");

    try {
      await activate(docUri);

      // The wait already proves no-wildcard-projection is present; the explicit
      // config must additionally keep no-distinct disabled.
      const diagnostics = await waitForDiagnostics(docUri, (value) =>
        value.some(
          (diagnostic) => diagnostic.code === "no-wildcard-projection",
        ),
      );

      assert.ok(
        diagnostics.every((diagnostic) => diagnostic.code !== "no-distinct"),
      );
    } finally {
      await updateLintConfigurationFilePath(docUri, null);
    }
  });

  test("Disables lint diagnostics when lintConfigurationFilePath cannot be resolved", async () => {
    const docUri = getDocUri("lint/explicit-path.sql");
    await updateLintConfigurationFilePath(
      docUri,
      ".vscode/does-not-exist-lint.json",
    );

    try {
      await activate(docUri);

      const diagnostics = await waitForDiagnosticsStability(
        docUri,
        (value) => value.length === 0,
        1_000,
        5_000,
      );

      assert.deepStrictEqual(diagnostics, []);
    } finally {
      await updateLintConfigurationFilePath(docUri, null);
    }
  });
});
