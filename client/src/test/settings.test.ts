import * as assert from "assert";
import * as vscode from "vscode";

import { activateExtension, getWorkspaceFolderUri, waitFor } from "./helper";

suite("Configuration export/import (single-root)", () => {
  const CONFIG_FILE_NAME = ".uroborosqlfmtrc.json";

  const getConfig = () => vscode.workspace.getConfiguration("uroborosql-fmt");

  const configFileUri = () =>
    vscode.Uri.joinPath(getWorkspaceFolderUri(), CONFIG_FILE_NAME);

  const exists = async (uri: vscode.Uri): Promise<boolean> => {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  };

  const writeConfigFile = async (value: unknown): Promise<void> => {
    await vscode.workspace.fs.writeFile(
      configFileUri(),
      Buffer.from(JSON.stringify(value, null, 2)),
    );
  };

  const readConfigFile = async (): Promise<Record<string, unknown>> => {
    const bytes = await vscode.workspace.fs.readFile(configFileUri());
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  };

  const deleteConfigFile = async (): Promise<void> => {
    const uri = configFileUri();
    if (await exists(uri)) {
      await vscode.workspace.fs.delete(uri);
    }
  };

  const clearSettings = async (
    keys: string[],
    target: vscode.ConfigurationTarget,
  ): Promise<void> => {
    const config = getConfig();
    await Promise.all(keys.map((key) => config.update(key, undefined, target)));
  };

  const deleteWorkspaceSettingsFile = async (): Promise<void> => {
    const vscodeDir = vscode.Uri.joinPath(getWorkspaceFolderUri(), ".vscode");
    if (!(await exists(vscodeDir))) {
      return;
    }
    const settingsFile = vscode.Uri.joinPath(vscodeDir, "settings.json");
    if (await exists(settingsFile)) {
      await vscode.workspace.fs.delete(settingsFile);
    }
    const remaining = await vscode.workspace.fs.readDirectory(vscodeDir);
    if (remaining.length === 0) {
      await vscode.workspace.fs.delete(vscodeDir, { recursive: false });
    }
  };

  setup(async () => {
    await activateExtension();
  });

  test("export merges VS Code settings into the config file in snake_case", async () => {
    await writeConfigFile({ tab_size: 2, complement_alias: true });
    await getConfig().update(
      "tabSize",
      4,
      vscode.ConfigurationTarget.Workspace,
    );
    await getConfig().update(
      "keywordCase",
      "lower",
      vscode.ConfigurationTarget.Workspace,
    );

    try {
      await waitFor(
        () => getConfig().inspect<string>("keywordCase")?.workspaceValue,
        (value) => value === "lower",
        undefined,
        undefined,
        "Timed out waiting for workspace settings to settle before export",
      );

      await vscode.commands.executeCommand("uroborosql-fmt.export");

      const merged = await waitFor(
        () => readConfigFile(),
        (value) => "keyword_case" in value,
        undefined,
        undefined,
        "Timed out waiting for export to write keyword_case",
      );

      assert.deepStrictEqual(merged, {
        tab_size: 4,
        complement_alias: true,
        keyword_case: "lower",
      });
    } finally {
      await clearSettings(
        ["tabSize", "keywordCase"],
        vscode.ConfigurationTarget.Workspace,
      );
      await deleteWorkspaceSettingsFile();
      await deleteConfigFile();
    }
  });

  test("import-to-workspace applies config file values to the workspace settings", async () => {
    await clearSettings(
      ["tabSize", "keywordCase"],
      vscode.ConfigurationTarget.Workspace,
    );
    await writeConfigFile({ tab_size: 8, keyword_case: "upper" });

    try {
      await vscode.commands.executeCommand(
        "uroborosql-fmt.import-to-workspace",
      );

      await waitFor(
        () => getConfig().inspect<number>("tabSize")?.workspaceValue,
        (value) => value === 8,
        undefined,
        undefined,
        "Timed out waiting for tabSize to reach the workspace settings",
      );

      assert.strictEqual(
        getConfig().inspect<string>("keywordCase")?.workspaceValue,
        "upper",
      );
    } finally {
      await clearSettings(
        ["tabSize", "keywordCase"],
        vscode.ConfigurationTarget.Workspace,
      );
      await deleteWorkspaceSettingsFile();
      await deleteConfigFile();
    }
  });

  test("import-to-global applies values to global settings without leaking to the workspace", async () => {
    await clearSettings(
      ["tabSize", "keywordCase"],
      vscode.ConfigurationTarget.Global,
    );
    await clearSettings(
      ["tabSize", "keywordCase"],
      vscode.ConfigurationTarget.Workspace,
    );
    await writeConfigFile({ tab_size: 8, keyword_case: "upper" });

    try {
      await vscode.commands.executeCommand("uroborosql-fmt.import-to-global");

      await waitFor(
        () => getConfig().inspect<number>("tabSize")?.globalValue,
        (value) => value === 8,
        undefined,
        undefined,
        "Timed out waiting for tabSize to reach the global settings",
      );

      assert.strictEqual(
        getConfig().inspect<string>("keywordCase")?.globalValue,
        "upper",
      );

      assert.strictEqual(
        getConfig().inspect<number>("tabSize")?.workspaceValue,
        undefined,
      );
      assert.strictEqual(
        getConfig().inspect<string>("keywordCase")?.workspaceValue,
        undefined,
      );
    } finally {
      await clearSettings(
        ["tabSize", "keywordCase"],
        vscode.ConfigurationTarget.Global,
      );
      await deleteWorkspaceSettingsFile();
      await deleteConfigFile();
    }
  });
});
