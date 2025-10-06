import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult,
  TextEdit,
  TextDocumentEdit,
  Position,
  Range,
  DocumentFormattingRequest,
  DocumentFilter,
  DocumentFormattingRegistrationOptions,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";

import { runfmtWithSettings } from "uroborosql-fmt-napi";
import * as fs from "fs";

import { performance } from "perf_hooks";
import path = require("path");
import { URI } from "vscode-uri";
import { objectToSnake } from "ts-case-convert";
// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
// let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  // hasDiagnosticRelatedInformationCapability = !!(
  //   capabilities.textDocument &&
  //   capabilities.textDocument.publishDiagnostics &&
  //   capabilities.textDocument.publishDiagnostics.relatedInformation
  // );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined,
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(() => {
      connection.console.log("Workspace folder change event received.");
    });
  }

  const filter: DocumentFilter = { language: "sql" };
  const options: DocumentFormattingRegistrationOptions = {
    documentSelector: [filter],
  };
  connection.client.register(DocumentFormattingRequest.type, options);
});

type ConfigurationSettings = {
  configurationFilePath: string;
  debug: boolean | null | undefined;
  tabSize: number | null | undefined;
  complementAlias: boolean | null | undefined;
  trimBindParam: boolean | null | undefined;
  keywordCase: string | null | undefined;
  identifierCase: string | null | undefined;
  maxCharPerLine: number | null | undefined;
  complementOuterKeyword: boolean | null | undefined;
  complementColumnAsKeyword: boolean | null | undefined;
  removeTableAsKeyword: boolean | null | undefined;
  removeRedundantNest: boolean | null | undefined;
  complementSqlId: boolean | null | undefined;
  convertDoubleColonCast: boolean | null | undefined;
  unifyNotEqual: boolean | null | undefined;
  indentTab: boolean | null | undefined;
  useParserErrorRecovery: boolean | null | undefined;
};

function getSettings(resource: string): Thenable<ConfigurationSettings> {
  return connection.workspace.getConfiguration({
    scopeUri: resource,
    section: "uroborosql-fmt",
  });
}

async function getWorkspaceFolder(
  document: TextDocument,
): Promise<string | undefined> {
  const { scheme, fsPath } = URI.parse(document.uri);

  if (scheme === "untitled") {
    const uri = (await connection.workspace.getWorkspaceFolders())?.[0]?.uri;
    return uri ? URI.parse(uri).fsPath : undefined;
  }

  if (fsPath) {
    const workspaceFolders = await connection.workspace.getWorkspaceFolders();

    if (workspaceFolders) {
      const wsFolder = workspaceFolders.find((wsFolder) => {
        const { scheme: wsScheme, fsPath: wsFsPath } = URI.parse(wsFolder.uri);
        const relative = path.relative(wsFsPath, fsPath);
        return (
          scheme == wsScheme &&
          relative &&
          !relative.startsWith("..") &&
          !path.isAbsolute(relative)
        );
      });

      return wsFolder ? wsFolder.uri : undefined;
    }
  }
  return undefined;
}

function getVSCodeOptions(
  settings: ConfigurationSettings,
  workspaceFolder: string | undefined,
): Partial<ConfigurationSettings> | null {
  if (!workspaceFolder) {
    return null;
  }

  // remove configurationFilePath
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { configurationFilePath, ...restConfiguration } = settings;

  // translate null (that means unsupecified option) to undefined
  const removedNullSettings = Object.fromEntries(
    Object.entries(restConfiguration).filter(([, value]) => value != null),
  );

  // to snake case for uroborosql-fmt
  return objectToSnake(removedNullSettings);
}

function determineConfigPath(
  settings: ConfigurationSettings,
  workspaceFolder: string | undefined,
): string | null {
  if (!workspaceFolder) {
    return null;
  }

  // remove scheme
  const workspaceFolderPath = URI.parse(workspaceFolder).fsPath;

  if (!settings.configurationFilePath) {
    const defaultConfigPath = path.join(
      workspaceFolderPath,
      ".uroborosqlfmtrc.json",
    );

    // The path of configuration file is not specified.
    // If defaultConfigPath doesn't exist, fomatters default config will be used.
    if (!fs.existsSync(defaultConfigPath)) {
      return null;
    }

    return defaultConfigPath;
  }

  let specifiedConfigPath = settings.configurationFilePath;
  if (!path.isAbsolute(specifiedConfigPath)) {
    specifiedConfigPath = path.join(workspaceFolderPath, specifiedConfigPath);
  }

  if (!fs.existsSync(specifiedConfigPath)) {
    // If the path is explicitly specified but the file does not exist,
    // it is not formatted and an error is generated.
    throw new Error(`${specifiedConfigPath} doesn't exist.`);
  }

  return specifiedConfigPath;
}

async function formatText(
  uri: string,
  textDocument: TextDocument,
  version: number,
  selections: Range[],
): Promise<TextEdit[]> {
  const workspaceFolder: string | undefined =
    await getWorkspaceFolder(textDocument);

  const settings: ConfigurationSettings = await getSettings(uri);

  let configPath: string | null;

  try {
    configPath = determineConfigPath(settings, workspaceFolder);
  } catch (e) {
    if (e instanceof Error) {
      connection.window.showErrorMessage(e.message);
    }

    return [];
  }

  // version check
  if (version !== textDocument.version) {
    return [];
  }

  // settings specified by vscode ui
  const specifiedSettings = getVSCodeOptions(settings, workspaceFolder);
  const settingsString = specifiedSettings
    ? JSON.stringify(specifiedSettings, null, 2)
    : "{}";
  const changes: TextEdit[] = [];

  console.log("VSCode uroborosql-fmt settings:", settingsString);
  console.log("uroborosql-fmt settings path:", configPath?.toString());

  // 全ての選択範囲に対して実行
  for (const selection of selections) {
    // テキストを取得
    const text = textDocument.getText(selection);
    if (!text.length) {
      continue;
    }

    let formattedText: string;

    try {
      formattedText = runfmtWithSettings(text, settingsString, configPath);
      // ステータスバーの背景を通常色に変更
      connection.sendRequest("custom/normal", []);
    } catch (e) {
      console.error(e);
      // ステータスバーの背景を赤色に変更
      connection.sendRequest("custom/error", []);
      return [];
    }

    // フォーマット
    changes.push(TextEdit.replace(selection, formattedText));
  }

  if (!changes.length) {
    // テキスト全体を取得
    const text = textDocument.getText();

    let formattedText: string;
    const startTime = performance.now();
    try {
      formattedText = runfmtWithSettings(text, settingsString, configPath);
      // ステータスバーの背景を通常色に変更
      connection.sendRequest("custom/normal", []);
    } catch (e) {
      console.error(e);
      // ステータスバーの背景を赤色に変更
      connection.sendRequest("custom/error", []);
      return [];
    }
    //タイマーストップ
    const endTime = performance.now();
    console.log("format complete: " + (endTime - startTime) + "ms"); // 何ミリ秒かかったかを表示する

    // フォーマット
    changes.push(
      TextEdit.replace(
        Range.create(
          Position.create(0, 0),
          textDocument.positionAt(text.length),
        ),
        formattedText,
      ),
    );
  }

  return changes;
}

// コマンド実行時に行う処理
connection.onExecuteCommand(async (params) => {
  if (
    params.command !== "uroborosql-fmt.executeFormat" ||
    params.arguments == null
  ) {
    return;
  }
  const uri = params.arguments[0].external;
  // uriからドキュメントを取得
  const textDocument = documents.get(uri);
  if (textDocument == null) {
    return;
  }

  const version = params.arguments[1];
  const selections = params.arguments[2];

  const changes = await formatText(uri, textDocument, version, selections);

  // 変更を適用
  connection.workspace.applyEdit({
    documentChanges: [
      TextDocumentEdit.create(
        { uri: textDocument.uri, version: textDocument.version },
        changes,
      ),
    ],
  });
});

connection.onDocumentFormatting(async (params): Promise<TextEdit[]> => {
  const uri = params.textDocument.uri;
  const textDocument = documents.get(uri);
  if (textDocument == null) {
    return [];
  }

  return formatText(uri, textDocument, textDocument.version, []);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
