import * as path from "path";
import {
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

import {
  buildFormatFunction,
  exportSettings,
  buildImportSettingsFunction,
} from "./command";

let client: LanguageClient;

//拡張機能を立ち上げたときに呼び出す関数
export function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js"),
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "sql" }],
    synchronize: {
      configurationSection: "uroborosql-fmt",
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
      buildFormatFunction(),
    ),
  );

  context.subscriptions.push(
    commands.registerCommand("uroborosql-fmt.export", exportSettings),
  );

  context.subscriptions.push(
    commands.registerCommand(
      "uroborosql-fmt.import-to-global",
      buildImportSettingsFunction(ConfigurationTarget.Global),
    ),
  );

  context.subscriptions.push(
    commands.registerCommand(
      "uroborosql-fmt.import-to-workspace",
      buildImportSettingsFunction(ConfigurationTarget.Workspace),
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
