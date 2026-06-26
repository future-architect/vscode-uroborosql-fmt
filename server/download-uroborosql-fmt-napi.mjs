import { writeFileSync } from "node:fs";
import http from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// uroborosql-fmt-napi のバージョン
// update-napi-version.yml ワークフローによって自動更新される
const NAPI_VERSION = "1.1.0";

const releaseTag = `uroborosql-fmt-napi-v${NAPI_VERSION}`;
const tgzName = `uroborosql-fmt-napi-${NAPI_VERSION}.tgz`;
const tarballUrl = `https://github.com/future-architect/uroborosql-fmt/releases/download/${releaseTag}/${tgzName}`;

http.setGlobalProxyFromEnv();

main();

async function main() {
  console.log(`Downloading and installing from: ${tarballUrl}`);

  const response = await fetch(tarballUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${tarballUrl}: ${response.status} ${response.statusText}`,
    );
  }

  const destination = join(__dirname, tgzName);
  writeFileSync(destination, Buffer.from(await response.arrayBuffer()));

  execSync(`npm install ${destination}`, { cwd: __dirname, stdio: "inherit" });
}
