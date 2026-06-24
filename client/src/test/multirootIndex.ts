import * as path from "path";
import * as Mocha from "mocha";

// Multi-root tests need a dedicated multi-folder workspace, so they run in a
// separate VS Code session from the single-root suite (see runMultirootTest.ts).
export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
  });
  mocha.timeout(100000);

  mocha.addFile(path.resolve(__dirname, "multiroot.test.js"));

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
