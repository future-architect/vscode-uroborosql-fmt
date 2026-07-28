import * as path from "path";
import { ExtensionContext, commands, ConfigurationTarget } from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

import {
  exportSettings,
  buildImportSettingsFunction,
  buildFormatSqlCommand,
  buildFormatSelectionsAsSqlCommand,
} from "./command";
import { withFormattingStatus } from "./formattingStatus";
import { createStatusBarController, type StatusBarState } from "./status";

let client: LanguageClient;

type ExtensionApi = {
  onReady(): Promise<void>;
  getStatusState(): StatusBarState;
};

//拡張機能を立ち上げたときに呼び出す関数
export function activate(context: ExtensionContext): ExtensionApi {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js"),
  );
  // Rust 製 language server は stdio へバインドされるため stdio transport で接続する。
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  };

  const statusBar = createStatusBarController(() => {
    client.outputChannel.show();
  });

  const clientOptions: LanguageClientOptions = {
    // 拡張がサーバへ渡すのは SQL 文書のみに限定する。
    documentSelector: [{ scheme: "file", language: "sql" }],
    synchronize: {
      configurationSection: "uroborosql-fmt",
    },
    revealOutputChannelOn: RevealOutputChannelOn.Never,
    middleware: {
      provideDocumentFormattingEdits: async (document, options, token, next) =>
        withFormattingStatus(() => next(document, options, token), statusBar),
      provideDocumentRangeFormattingEdits: async (
        document,
        range,
        options,
        token,
        next,
      ) =>
        withFormattingStatus(
          () => next(document, range, options, token),
          statusBar,
        ),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "Uroborosql-fmt",
    "Uroborosql-fmt",
    serverOptions,
    clientOptions,
  );

  // Start the client. This will also launch the server.
  const readyPromise = client.start();
  // Consumers await this promise on their own timing (or never do, if the
  // format commands are never invoked); attach a no-op catch here so a
  // startup failure doesn't surface as an unhandled rejection.
  readyPromise.catch((error) => {
    client.outputChannel.appendLine(
      `Failed to start language client: ${error}`,
    );
  });

  context.subscriptions.push(
    commands.registerCommand(
      "uroborosql-fmt.uroborosql-format",
      buildFormatSqlCommand(client, readyPromise, statusBar),
    ),
  );

  context.subscriptions.push(
    commands.registerCommand(
      "uroborosql-fmt.format-selection-as-sql",
      buildFormatSelectionsAsSqlCommand(client, readyPromise, statusBar),
    ),
  );

  context.subscriptions.push(
    commands.registerCommand(
      "uroborosql-fmt.show-output",
      statusBar.showOutput,
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

  context.subscriptions.push(statusBar);

  return {
    onReady: () => readyPromise,
    getStatusState: () => statusBar.getState(),
  };
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
