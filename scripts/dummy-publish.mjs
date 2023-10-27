import { readFileSync } from "node:fs";
import * as cp from "child_process";

main();

// 既に作成済みのバージョンのtagを再度作成しようとしてgithub actionが失敗するのを防ぐため
// tag作成が必要な場合のみ"New tag:"を出力する
function main() {
  cp.execSync("git fetch --tags origin");

  const tags = cp.execSync("git tag").toString().split("\n");
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));

  if (!tags.includes(`v${pkg["version"]}`)) {
    console.log('"New tag:"');
  }
}
