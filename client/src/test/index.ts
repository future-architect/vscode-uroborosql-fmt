import { readdir } from "fs/promises";
import * as path from "path";
import * as Mocha from "mocha";

const collectTestFiles = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.resolve(root, entry.name);
      if (entry.isDirectory()) {
        return collectTestFiles(fullPath);
      }
      // multiroot.test.js needs a dedicated multi-folder workspace and runs via
      // its own runner (runMultirootTest), so keep it out of the single-root run.
      if (
        entry.isFile() &&
        entry.name.endsWith(".test.js") &&
        entry.name !== "multiroot.test.js"
      ) {
        return [fullPath];
      }
      return [];
    }),
  );

  return nestedFiles.flat().sort();
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
