import * as path from "path";

import { runE2E } from "./runE2E";

// Opening a `.code-workspace` file makes VS Code report multiple
// workspaceFolders, which is what the multi-root behavior depends on.
runE2E({
  testsPath: "./multi-root/index",
  defaultWorkspace: path.resolve(
    __dirname,
    "../../multirootFixture/multi.code-workspace",
  ),
  isolationPrefix: "vsqlfmt-e2e-multiroot",
});
