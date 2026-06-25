import * as path from "path";

import { runTests } from "@vscode/test-electron";
import { withIsolatedTestDirs } from "./testRunEnvironment";

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, "../../../");

    // The path to test runner that only loads the multi-root suite
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, "./multirootIndex");

    // Opening a `.code-workspace` file makes VS Code report multiple
    // workspaceFolders, which is what the multi-root behavior depends on.
    const workspacePath =
      process.env.CODE_TESTS_WORKSPACE ??
      path.resolve(__dirname, "../../multirootFixture/multi.code-workspace");
    await withIsolatedTestDirs("vsqlfmt-e2e-multiroot", async (dirs) => {
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

main();
