import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ProxyAgent } from "undici";
import * as cp from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

main();

async function main() {
  const agent = autoProxyAgent();
  const res = await fetch(
    "https://future-architect.github.io/uroborosql-fmt/uroborosql-fmt-napi-0.0.0.tgz",
    agent ? { dispatcher: agent } : undefined,
  );
  const destination = join(__dirname, "uroborosql-fmt-napi-0.0.0.tgz");
  writeFileSync(destination, Buffer.from(await res.arrayBuffer()));

  cp.execSync(`npm install ${destination}`, { cwd: __dirname });
}

function autoProxyAgent() {
  const PROXY_ENV = [
    "https_proxy",
    "HTTPS_PROXY",
    "http_proxy",
    "HTTP_PROXY",
    "npm_config_https_proxy",
    "npm_config_http_proxy",
  ];

  const proxyStr = PROXY_ENV.map((k) => process.env[k]).find((v) => v);
  if (!proxyStr) {
    return null;
  }
  const proxyUrl = new URL(proxyStr);

  return new ProxyAgent({
    uri: proxyUrl.protocol + proxyUrl.host,
    token:
      proxyUrl.username || proxyUrl.password
        ? `Basic ${Buffer.from(
            `${proxyUrl.username}:${proxyUrl.password}`,
          ).toString("base64")}`
        : undefined,
  });
}
