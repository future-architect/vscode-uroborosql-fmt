import globals from "globals";
import tsEslint from "typescript-eslint";
import js from "@eslint/js";

export default [
  {
    ignores: [
      "**/node_modules/",
      "client/node_modules/",
      "client/out/",
      "server/node_modules/",
      "server/out/",
    ],
  },
  js.configs.recommended,
  ...tsEslint.config({
    files: ["**/*.ts", "**/*.mts"],
    extends: [tsEslint.configs.recommended],
  }),
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.mjs"],
  },
];
