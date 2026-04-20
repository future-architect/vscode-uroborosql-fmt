import path = require("path");
import { objectToCamel, objectToSnake } from "ts-case-convert";
import type { ObjectToSnake } from "ts-case-convert/lib/caseConvert";
import {
  ConfigurationTarget,
  Position,
  Range,
  Selection,
  TextDocument,
  Uri,
  window,
  workspace,
  WorkspaceConfiguration,
  WorkspaceFolder,
  WorkspaceEdit,
} from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";

const FORMAT_SELECTIONS_AS_SQL_METHOD = "uroborosql/formatSelectionsAsSql";
const EMPTY_SELECTION_MESSAGE = "Select text to format as SQL.";
const OVERLAPPING_SELECTIONS_MESSAGE = "Selections must not overlap.";
const VERSION_MISMATCH_MESSAGE =
  "Document changed while formatting selection as SQL.";

type FormatSelectionAsSqlRequest = {
  hostDocumentUri: string;
  hostDocumentVersion: number;
  selections: {
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    text: string;
  }[];
};

type FormatSelectionAsSqlResponse = {
  hostDocumentVersion: number;
  edits: {
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    newText: string;
  }[];
};

const vsCodeConfigurationsObject = {
  configurationFilePath: "",
  lintConfigurationFilePath: "",
  debug: null,
  tabSize: null,
  complementAlias: null,
  trimBindParam: null,
  keywordCase: null,
  identifierCase: null,
  maxCharPerLine: null,
  complementOuterKeyword: null,
  complementColumnAsKeyword: null,
  removeTableAsKeyword: null,
  removeRedundantNest: null,
  complementSqlId: null,
  convertDoubleColonCast: null,
  unifyNotEqual: null,
  indentTab: null,
  useParserErrorRecovery: null,
} satisfies ConfigurationRecord;

type ConfigurationRecord = {
  configurationFilePath: string;
  lintConfigurationFilePath: string;
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

// WorkspaceConfigurationを受け取り、フォーマッタで利用する設定のみのRecordにして返す
const extractFormattingConfigurations = (
  workspaceConfig: WorkspaceConfiguration,
): Partial<ConfigurationRecord> => {
  // uroborosql-fmtのVSCode拡張で有効な設定項目のうち、明示的に設定されているもののみを取得
  const config: Partial<ConfigurationRecord> = {};
  for (const key of Object.keys(vsCodeConfigurationsObject)) {
    const value = workspaceConfig.get(key);
    if (value != null) {
      config[key] = value;
    }
  }
  // configurationFilePath を除外
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { configurationFilePath, ...restConfiguration } = config;

  return restConfiguration;
};

const isFileExists = async (uri: Uri): Promise<boolean> => {
  try {
    await workspace.fs.stat(uri);
    return true;
  } catch (_) {
    return false;
  }
};

// uroborosql-fmt の設定ファイル名を取得する
// ワークスペースの側で設定されている場合はその値を、設定されていない場合は ".uroborosqlfmtrc.json"を返す
const getConfigFileName = (
  documentUri: Uri,
  defaultName: string = ".uroborosqlfmtrc.json",
): string => {
  // uroborosql-fmt の設定を取得
  const vsCodeConfig = workspace.getConfiguration(
    "uroborosql-fmt",
    documentUri,
  );

  // Default value of `uroborosql-fmt.configurationFilePath` is "".
  const vsCodeConfigPath: string = vsCodeConfig.get("configurationFilePath");
  return vsCodeConfigPath !== "" ? vsCodeConfigPath : defaultName;
};

const getTargetFolder = (): WorkspaceFolder | undefined => {
  const folders = workspace.workspaceFolders;
  if (folders === undefined) {
    // ワークスペースとしてではなく、ファイルを直接開いている場合
    window.showErrorMessage(
      "Error: Open the folder before executing commands.",
    );
    return;
  } else if (folders.length == 0) {
    // ワークスペースにフォルダが一つも存在しない場合
    window.showErrorMessage(
      "Error: There is no folder in the workspace. To execute the command, at least one folder must be added to the workspace.",
    );
    return;
  }
  if (folders.length === 1) {
    return folders[0];
  }

  // ワークスペースに複数のフォルダが存在する場合
  if (!window.activeTextEditor) {
    // activeTextEditorが存在しない場合
    return;
  }
  const activeEditorPath = window.activeTextEditor.document.uri.fsPath;

  const matchingWorkspace = folders.find((wsFolder) => {
    const relative = path.relative(wsFolder.uri.fsPath, activeEditorPath);
    return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
  });

  if (matchingWorkspace) {
    return matchingWorkspace;
  }

  window.showErrorMessage(
    "Error: There are multiple folders in the workspace, and it could not be determined which folder's settings to target. Please select a file that belongs to the folder you want to target before executing the command.",
  );
  return;
};

export const exportSettings = async (): Promise<void> => {
  const folder = getTargetFolder();
  if (!folder) {
    return;
  }

  // 設定ファイルのURIを作成
  const configFile = Uri.joinPath(folder.uri, getConfigFileName(folder.uri));

  // VSCode拡張側の設定を取得
  const vsCodeConfig = workspace.getConfiguration("uroborosql-fmt");
  const formattingConfig = extractFormattingConfigurations(vsCodeConfig);

  // 設定ファイルの設定を取得
  let existingConfig: ObjectToSnake<Partial<ConfigurationRecord>>;
  if (await isFileExists(configFile)) {
    const file = await workspace.fs.readFile(configFile);
    existingConfig = JSON.parse(file.toString());
  } else {
    // ファイルが存在しなければ設定値なし
    existingConfig = {};
  }

  // VSCode 側で明示的に設定したものだけを上書きする
  const merged = {
    ...existingConfig,
    ...objectToSnake(formattingConfig),
  };
  const content = JSON.stringify(merged, null, 2);

  const blob: Uint8Array = Buffer.from(content);
  await workspace.fs.writeFile(configFile, blob);
};

// uroborosqlfmtrc.json の設定を settings.json に反映
export const buildImportSettingsFunction =
  (target: ConfigurationTarget) => async (): Promise<void> => {
    const folder = getTargetFolder();
    if (!folder) {
      return;
    }

    // 設定ファイルのURIを作成
    const configFile = Uri.joinPath(folder.uri, getConfigFileName(folder.uri));

    if (!(await isFileExists(configFile))) {
      window.showErrorMessage(
        `Error: Config File is not found: ${configFile.path}`,
      );
      return;
    }

    const blob = await workspace.fs.readFile(configFile);
    const config: ObjectToSnake<ConfigurationRecord> = JSON.parse(
      blob.toString(),
    );

    // VSCode 拡張の設定を取得
    const vsCodeConfig: WorkspaceConfiguration =
      workspace.getConfiguration("uroborosql-fmt");

    // ワークスペース側で設定されている設定項目（そのうち `configurationFilePath` 以外のもの）をすべて null にする
    const vsCodeOptions = extractFormattingConfigurations(vsCodeConfig);
    await Promise.all(
      Object.keys(vsCodeOptions).map((key) =>
        vsCodeConfig.update(key, null, target),
      ),
    );

    // 設定ファイルの値で更新する
    await Promise.all(
      Object.entries(objectToCamel(config)).map(([key, value]) =>
        vsCodeConfig.update(key, value, target),
      ),
    );
  };

const selectionToRange = (selection: Selection): Range =>
  new Range(selection.start, selection.end);

const rangeToRequestRange = (range: Range) => ({
  start: { line: range.start.line, character: range.start.character },
  end: { line: range.end.line, character: range.end.character },
});

const requestRangeToRange = (range: {
  start: { line: number; character: number };
  end: { line: number; character: number };
}): Range =>
  new Range(
    new Position(range.start.line, range.start.character),
    new Position(range.end.line, range.end.character),
  );

export const selectionsMustNotOverlap = (
  document: TextDocument,
  selections: readonly Selection[],
): boolean => {
  const sortedRanges = selections
    .map(selectionToRange)
    .map((range) => ({
      start: document.offsetAt(range.start),
      end: document.offsetAt(range.end),
    }))
    .sort((left, right) => left.start - right.start);

  for (let i = 1; i < sortedRanges.length; i += 1) {
    if (sortedRanges[i].start < sortedRanges[i - 1].end) {
      return false;
    }
  }

  return true;
};

export const buildFormatSelectionsAsSqlCommand =
  (client: LanguageClient) => async (): Promise<void> => {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }

    const { document, selections } = editor;
    if (
      selections.length === 0 ||
      selections.some((selection) => selection.isEmpty)
    ) {
      window.showErrorMessage(EMPTY_SELECTION_MESSAGE);
      return;
    }

    if (!selectionsMustNotOverlap(document, selections)) {
      window.showErrorMessage(OVERLAPPING_SELECTIONS_MESSAGE);
      return;
    }

    const requestVersion = document.version;
    const params: FormatSelectionAsSqlRequest = {
      hostDocumentUri: document.uri.toString(),
      hostDocumentVersion: requestVersion,
      selections: selections.map((selection) => {
        const range = selectionToRange(selection);
        return {
          range: rangeToRequestRange(range),
          text: document.getText(range),
        };
      }),
    };

    await client.onReady();
    const result = await client.sendRequest<FormatSelectionAsSqlResponse>(
      FORMAT_SELECTIONS_AS_SQL_METHOD,
      params,
    );

    if (
      document.version !== requestVersion ||
      result.hostDocumentVersion !== requestVersion
    ) {
      window.showErrorMessage(VERSION_MISMATCH_MESSAGE);
      return;
    }

    const edit = new WorkspaceEdit();
    for (const textEdit of result.edits) {
      edit.replace(
        document.uri,
        requestRangeToRange(textEdit.range),
        textEdit.newText,
      );
    }

    await workspace.applyEdit(edit);
  };
