import { readdir } from "fs/promises";
import * as path from "path";
import * as Mocha from "mocha";

// Suites in subdirectories (e.g. multi-root) run in their own VS Code session,
// so only the `.test.js` files directly under this directory belong here.
const collectTestFiles = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.js"))
    .map((entry) => path.resolve(root, entry.name))
    .sort();
};

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
  });
  mocha.timeout(100000);

  const testsRoot = __dirname;
  const files = await collectTestFiles(testsRoot);

  // Add files to the test suite
  files.forEach((file) => mocha.addFile(file));

  return new Promise((resolve, reject) => {
    try {
      // Run the mocha test
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.error(err);
      reject(err);
    }
  });
}
