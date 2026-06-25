import * as path from "path";
import * as Mocha from "mocha";

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
  });
  mocha.timeout(100000);

  // Multi-root tests live under a dedicated directory and run in their own
  // VS Code session with a `.code-workspace` fixture.
  mocha.addFile(path.resolve(__dirname, "multi-root", "multiroot.test.js"));

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
