---
"uroborosql-fmt": minor
---

Migrate the VS Code language server backend from TypeScript to Rust

- Add lint diagnostics and quick fixes through `uroborosql-language-server`
- Add `Format Selection as SQL` for formatting embedded SQL in non-SQL files
- Raise the minimum supported VS Code version to 1.74.0 and replace `activationEvents: ["*"]` with `onLanguage:sql`
