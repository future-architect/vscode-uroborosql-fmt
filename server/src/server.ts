/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult,
	CodeAction,
	TextEdit,
	TextDocumentEdit,
	CodeActionKind,
	Position,
	Range,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';


// eslint-disable-next-line @typescript-eslint/no-var-requires
const { runfmt } = require("../../uroborosql-fmt-napi/index");

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

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
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

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
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders((_event) => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// コマンド実行時に行う処理
connection.onExecuteCommand((params) => {
  if (
    params.command !== "lsp-sample.executeFormat" ||
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
  // バージョン不一致の場合はアーリーリターン
  const version = params.arguments[1];
  if (textDocument.version !== version) {
    return;
  }

  const selections = params.arguments[2];
  const changes: TextEdit[] = [];

  // 全ての選択範囲に対して実行
  for (const selection of selections) {
    // テキストを取得
    const text = textDocument.getText(selection);
    if (text.length === 0) {
      continue;
    }

	// フォーマット
	changes.push(TextEdit.replace(selection, runfmt(text)));
  }

  if (changes.length === 0) {
    // テキスト全体を取得
    const text = textDocument.getText();
	// フォーマット

    changes.push(
      TextEdit.replace(
        Range.create(
          Position.create(0, 0),
          textDocument.positionAt(text.length)
        ),
        runfmt(text)
      )
    );
  }

  // 変更を適用
  connection.workspace.applyEdit({
    documentChanges: [
      TextDocumentEdit.create(
        { uri: textDocument.uri, version: textDocument.version },
        changes
      ),
    ],
  });
});


// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
