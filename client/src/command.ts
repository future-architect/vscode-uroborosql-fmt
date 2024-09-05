import { objectToCamel, objectToSnake } from "ts-case-convert";
import {
  ConfigurationTarget,
  Uri,
  window,
  workspace,
  WorkspaceConfiguration,
} from "vscode";
import { ExecuteCommandRequest } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";

type OptionsRecord = Record<string, boolean | number | string>;

const convertWorkspaceConfigToFormattingConfig = (
  workspaceConfig: WorkspaceConfiguration,
): OptionsRecord => {
  // WorkspaceConfiguration のメンバから以下を除外
  // - 設定値 `configurationFilePath`
  // - value が null のメンバ
  // - その他メソッドと内部オブジェクト
  const formattingConfig: OptionsRecord = Object.fromEntries(
    Object.entries(workspaceConfig).filter(
      ([key, value]) =>
        key !== "configurationFilePath" &&
        value !== null &&
        typeof value !== "function" &&
        typeof value !== "object",
    ),
  );
  return formattingConfig;
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
  defaultName: string = ".uroborosqlfmtrc.json",
): string => {
  // uroborosql-fmt の設定を取得
  const vsCodeConfig = workspace.getConfiguration("uroborosql-fmt");

  // Default value of `uroborosql-fmt.configurationFilePath` is "".
  const vsCodeConfigPath: string = vsCodeConfig.get("configurationFilePath");
  return vsCodeConfigPath !== "" ? vsCodeConfigPath : defaultName;
};

export const buildFormatFunction =
  (client: LanguageClient) => async (): Promise<void> => {
    const uri = window.activeTextEditor.document.uri;
    const version = window.activeTextEditor.document.version;
    const selections = window.activeTextEditor.selections;

    await client.sendRequest(ExecuteCommandRequest.type, {
      command: "uroborosql-fmt.executeFormat",
      arguments: [uri, version, selections],
    });
  };

export const exportSettings = async (): Promise<void> => {
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

  // 設定ファイルのURIを作成
  const configFile = Uri.joinPath(folders[0].uri, getConfigFileName());

  // VSCode拡張側の設定を取得
  const vsCodeConfig = workspace.getConfiguration("uroborosql-fmt");
  const formattingConfig =
    convertWorkspaceConfigToFormattingConfig(vsCodeConfig);

  // 設定ファイルの設定を取得
  let existingConfig: OptionsRecord;
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

    // 設定ファイルのURIを作成
    const configUri = Uri.joinPath(folders[0].uri, getConfigFileName());

    if (!(await isFileExists(configUri))) {
      window.showErrorMessage(
        `Error: Config File is not found: ${configUri.path}`,
      );
      return;
    }

    const blob = await workspace.fs.readFile(configUri);
    const config: OptionsRecord = JSON.parse(blob.toString());

    // VSCode 拡張の設定を取得
    const vsCodeConfig: WorkspaceConfiguration =
      workspace.getConfiguration("uroborosql-fmt");

    // ワークスペース側で設定されている設定項目（そのうち `configurationFilePath` 以外のもの）をすべて null にする
    const nonNullOptions =
      convertWorkspaceConfigToFormattingConfig(vsCodeConfig);
    for (const key of Object.keys(nonNullOptions)) {
      await vsCodeConfig.update(key, null, target);
    }

    // 設定ファイルの値で更新する
    for (const [key, value] of Object.entries(objectToCamel(config))) {
      await vsCodeConfig.update(key, value, target);
    }
  };
