import * as esbuild from "esbuild";

const production = process.argv.includes("--production");

const common = {
  bundle: true,
  platform: "node",
  format: "cjs",
  sourcemap: !production,
  minify: production,
};

await esbuild.build({
  ...common,
  entryPoints: ["client/src/extension.ts"],
  outfile: "client/out/extension.js",
  external: ["vscode"],
});

await esbuild.build({
  ...common,
  entryPoints: ["server/src/server.ts"],
  outfile: "server/out/server.js",
  external: ["uroborosql-fmt-napi"],
});
