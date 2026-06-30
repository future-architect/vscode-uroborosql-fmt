import * as path from "path";

import { runTests } from "@vscode/test-electron";
import { withIsolatedTestDirs } from "./testRunEnvironment";

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../../");
    const extensionTestsPath = path.resolve(__dirname, "./index");
    const workspacePath = path.resolve(__dirname, "../../testFixture");

    await withIsolatedTestDirs("vsqlfmt-e2e", async (dirs) => {
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
