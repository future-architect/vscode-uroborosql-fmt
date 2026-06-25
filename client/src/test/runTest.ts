import * as path from "path";

import { runE2E } from "./runE2E";

runE2E({
  testsPath: "./index",
  defaultWorkspace: path.resolve(__dirname, "../../testFixture"),
  isolationPrefix: "vsqlfmt-e2e",
});
