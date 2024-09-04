import * as path from "path";
import {
  workspace,
  ExtensionContext,
  window,
  commands,
  StatusBarAlignment,
  ThemeColor,
  StatusBarItem,
  ConfigurationTarget,
} from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

import { exportSettings, format, importSettings } from "./command";

let client: LanguageClient;

//拡張機能を立ち上げたときに呼び出す関数
export function activate(context: ExtensionContext) {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js"),
  );
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  // 対象とする言語。今回はplaintext
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [
      { pattern: "**", scheme: "file" },
      { pattern: "**", scheme: "untitled" },
    ],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "Uroborosql-fmt",
    "Uroborosql-fmt",
    serverOptions,
    clientOptions,
  );

  context.subscriptions.push(
    commands.registerCommand(
      "uroborosql-fmt.uroborosql-format",
      format(client),
    ),
  );

  context.subscriptions.push(
    commands.registerCommand("uroborosql-fmt.export", exportSettings),
  );

  context.subscriptions.push(
    commands.registerCommand(
      "uroborosql-fmt.import-to-global",
      importSettings(ConfigurationTarget.Global),
    ),
  );

  context.subscriptions.push(
    commands.registerCommand(
      "uroborosql-fmt.import-to-workspace",
      importSettings(ConfigurationTarget.Workspace),
    ),
  );

  // ステータスバーの作成と表示
  const statusBar = createStatusBar();
  statusBar.show();

  client.onReady().then(() => {
    // ステータスバーの背景色を黄色に変更
    client.onRequest("custom/warning", () => {
      statusBar.backgroundColor = new ThemeColor(
        "statusBarItem.warningBackground",
      );
      statusBar.text = "$(warning) Uroborosql-fmt";
    });

    // ステータスバーの背景色を赤色に変更
    client.onRequest("custom/error", () => {
      statusBar.backgroundColor = new ThemeColor(
        "statusBarItem.errorBackground",
      );
      statusBar.text = "$(alert) Uroborosql-fmt";
    });

    // ステータスバーの背景色を通常色に変更
    client.onRequest("custom/normal", () => {
      statusBar.backgroundColor = new ThemeColor(
        "statusBarItem.fourgroundBackground",
      );
      statusBar.text = "Uroborosql-fmt";
    });
  });

  // Start the client. This will also launch the server
  client.start();
}

function createStatusBar(): StatusBarItem {
  commands.registerCommand("uroborosql-fmt.show-output", async () => {
    const output_channnel = client.outputChannel;
    output_channnel.show();
  });

  const statusBar = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  statusBar.text = "Uroborosql-fmt";
  statusBar.name = "Uroborosql-fmt";
  statusBar.command = "uroborosql-fmt.show-output";

  return statusBar;
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
