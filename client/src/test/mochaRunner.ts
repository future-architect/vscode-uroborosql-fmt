import { readdir } from "fs/promises";
import * as path from "path";
import * as Mocha from "mocha";

export const collectTestFiles = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.js"))
    .map((entry) => path.resolve(root, entry.name))
    .sort();
};

export async function runMocha(files: string[]): Promise<void> {
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
  });
  mocha.timeout(100000);

  files.forEach((file) => mocha.addFile(file));

  return new Promise((resolve, reject) => {
    try {
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
