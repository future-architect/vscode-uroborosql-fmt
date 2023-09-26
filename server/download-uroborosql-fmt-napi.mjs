import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import tunnel from "tunnel-agent";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

main();

async function main() {
  const res = await fetch(
    "https://future-architect.github.io/uroborosql-fmt/uroborosql-fmt-napi-0.0.0.tgz"
  );
  const destination = join(__dirname, "uroborosql-fmt-napi-0.0.0.tgz");
  writeFileSync(destination, Buffer.from(await res.arrayBuffer()));
}
