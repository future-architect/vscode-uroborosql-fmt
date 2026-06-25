import * as assert from "assert";
import {
  activate,
  getDocUri,
  waitForDiagnosticsStability,
  updateLintConfigurationFilePath,
} from "./helper";

suite("Lint E2E", () => {
  test("Uses lintConfigurationFilePath when explicitly configured", async () => {
    const docUri = getDocUri("lint/explicit-path.sql");
    await updateLintConfigurationFilePath(docUri, ".vscode/lint-explicit.json");

    try {
      await activate(docUri);

      // Under the explicit config no-distinct is off, so the settled state has
      // no-wildcard-projection but not no-distinct. Waiting for stability avoids
      // latching the transient default-config diagnostics published first.
      const diagnostics = await waitForDiagnosticsStability(
        docUri,
        (value) =>
          value.some(
            (diagnostic) => diagnostic.code === "no-wildcard-projection",
          ) && value.every((diagnostic) => diagnostic.code !== "no-distinct"),
        500,
      );

      assert.ok(
        diagnostics.some(
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
