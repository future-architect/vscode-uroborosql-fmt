import * as path from "path";

import { runTests } from "@vscode/test-electron";
import { withIsolatedTestDirs } from "./testRunEnvironment";

type RunE2EOptions = {
  // Module (relative to this file) exporting the Mocha `run` entry point.
  testsPath: string;
  // Default workspace to open; overridable via CODE_TESTS_WORKSPACE.
  defaultWorkspace: string;
  // Prefix for the throwaway user-data / extensions directories.
  isolationPrefix: string;
};

export async function runE2E({
  testsPath,
  defaultWorkspace,
  isolationPrefix,
}: RunE2EOptions): Promise<void> {
  try {
    // The folder containing the Extension Manifest package.json,
    // passed to `--extensionDevelopmentPath`.
    const extensionDevelopmentPath = path.resolve(__dirname, "../../../");
    const extensionTestsPath = path.resolve(__dirname, testsPath);
    const workspacePath = process.env.CODE_TESTS_WORKSPACE ?? defaultWorkspace;

    await withIsolatedTestDirs(isolationPrefix, async (dirs) => {
      await runTests({
        extensionDevelopmentPath,
        extensionTestsPath,
        vscodeExecutablePath: process.env.CODE_TESTS_VSCODE_PATH,
        launchArgs: [
          workspacePath,
          "--user-data-dir",
          dirs.userDataDir,
          "--extensions-dir",
          dirs.extensionsDir,
        ],
      });
    });
  } catch (err) {
    console.error("Failed to run tests");
    console.error(err);
    process.exit(1);
  }
}
