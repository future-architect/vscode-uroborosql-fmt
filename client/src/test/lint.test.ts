import * as assert from "assert";
import * as vscode from "vscode";
import {
  activate,
  getDocUri,
  waitFor,
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
    assert.strictEqual(
      distinctDiagnostic.message,
      "DISTINCT is not recommended.",
    );
    assert.strictEqual(
      distinctDiagnostic.severity,
      vscode.DiagnosticSeverity.Error,
    );
  });
});
