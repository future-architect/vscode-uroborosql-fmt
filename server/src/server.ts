import { runLanguageServer } from "uroborosql-fmt-napi";

// Node.js から uroborosql-language-server の LSP を起動するだけの薄いラッパー。
// 標準入出力へバインドされるため、VS Code 側からは stdio transport で接続する。
runLanguageServer();
