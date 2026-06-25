import * as assert from "assert";
import * as vscode from "vscode";
import {
  activate,
  getDocUri,
  updateLintConfigurationFilePath,
  waitFor,
  waitForStability,
} from "./helper";

suite("Lint E2E", () => {
  test("Publishes configured lint diagnostics", async () => {
    const docUri = getDocUri("lint/distinct.sql");
    await activate(docUri);

    const diagnostics = await waitFor(
      async () => vscode.languages.getDiagnostics(docUri),
      (value) => value.some((diagnostic) => diagnostic.code === "no-distinct"),
    );

    const distinctDiagnostic = diagnostics.find(
      (diagnostic) => diagnostic.code === "no-distinct",
    );

    assert.ok(distinctDiagnostic);
    assert.strictEqual(distinctDiagnostic.source, "uroborosql-lint");
    assert.match(distinctDiagnostic.message, /DISTINCT/i);
    assert.strictEqual(
      distinctDiagnostic.severity,
      vscode.DiagnosticSeverity.Error,
    );
  });

  test("Loads rules from .uroborosqllintrc.json", async () => {
    const docUri = getDocUri("lint/wildcard.sql");
    await activate(docUri);

    const diagnostics = await waitFor(
      async () => vscode.languages.getDiagnostics(docUri),
      (value) =>
        value.some(
          (diagnostic) => diagnostic.code === "no-wildcard-projection",
        ),
    );

    const wildcardDiagnostic = diagnostics.find(
      (diagnostic) => diagnostic.code === "no-wildcard-projection",
    );

    assert.ok(wildcardDiagnostic);
    assert.strictEqual(wildcardDiagnostic.source, "uroborosql-lint");
    assert.match(wildcardDiagnostic.message, /Wildcard projections/i);
    assert.strictEqual(
      wildcardDiagnostic.severity,
      vscode.DiagnosticSeverity.Error,
    );
  });

  test("Applies override rules from .uroborosqllintrc.json", async () => {
    const docUri = getDocUri("lint/override-warning.sql");
    await activate(docUri);

    const diagnostics = await waitFor(
      async () => vscode.languages.getDiagnostics(docUri),
      (value) =>
        value.some((diagnostic) => diagnostic.code === "no-distinct") &&
        value.some(
          (diagnostic) => diagnostic.code === "no-wildcard-projection",
        ),
    );

    const distinctDiagnostic = diagnostics.find(
      (diagnostic) => diagnostic.code === "no-distinct",
    );
    const wildcardDiagnostic = diagnostics.find(
      (diagnostic) => diagnostic.code === "no-wildcard-projection",
    );

    assert.ok(distinctDiagnostic);
    assert.ok(wildcardDiagnostic);
    assert.strictEqual(
      distinctDiagnostic.severity,
      vscode.DiagnosticSeverity.Warning,
    );
    assert.strictEqual(
      wildcardDiagnostic.severity,
      vscode.DiagnosticSeverity.Error,
    );
  });

  test("Ignores files matched by .uroborosqllintrc.json", async () => {
    const baselineUri = getDocUri("lint/wildcard.sql");
    await activate(baselineUri);
    await waitFor(
      async () => vscode.languages.getDiagnostics(baselineUri),
      (value) =>
        value.some(
          (diagnostic) => diagnostic.code === "no-wildcard-projection",
        ),
    );

    const ignoredUri = getDocUri("lint/ignored.sql");
    await activate(ignoredUri);

    const diagnostics = await waitForStability(
      async () => vscode.languages.getDiagnostics(ignoredUri),
      (value) => value.length === 0,
      1_000,
      5_000,
    );
    assert.deepStrictEqual(diagnostics, []);
  });

  test("Uses lintConfigurationFilePath when explicitly configured", async () => {
    const docUri = getDocUri("lint/explicit-path.sql");
    await updateLintConfigurationFilePath(docUri, ".vscode/lint-explicit.json");

    try {
      await activate(docUri);

      const diagnostics = await waitFor(
        async () => vscode.languages.getDiagnostics(docUri),
        (value) =>
          value.some(
            (diagnostic) => diagnostic.code === "no-wildcard-projection",
          ),
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
      await updateLintConfigurationFilePath(docUri, "");
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

      const diagnostics = await waitForStability(
        async () => vscode.languages.getDiagnostics(docUri),
        (value) => value.length === 0,
        1_000,
        5_000,
      );

      assert.deepStrictEqual(diagnostics, []);
    } finally {
      await updateLintConfigurationFilePath(docUri, "");
    }
  });
});
