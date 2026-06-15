import * as os from "os";
import * as path from "path";

import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, "../../../");

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, "./index");
    const workspacePath =
      process.env.CODE_TESTS_WORKSPACE ??
      path.resolve(__dirname, "../../testFixture");
    const userDataDir = path.join(os.tmpdir(), "vsqlfmt-e2e-user");
    const extensionsDir = path.join(os.tmpdir(), "vsqlfmt-e2e-ext");

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      vscodeExecutablePath: process.env.CODE_TESTS_VSCODE_PATH,
      launchArgs: [
        workspacePath,
        "--user-data-dir",
        userDataDir,
        "--extensions-dir",
        extensionsDir,
      ],
    });
  } catch (err) {
    console.error("Failed to run tests");
    console.error(err);
    process.exit(1);
  }
}

main();
