import { objectToCamel, objectToSnake } from "ts-case-convert";
import { Uri, window, workspace, WorkspaceConfiguration } from "vscode";
import { ExecuteCommandRequest } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";

type OptionsRecord = Record<string, boolean | number | string>;

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

export const format = (client: LanguageClient) => async (): Promise<void> => {
  const uri = window.activeTextEditor.document.uri;
  const version = window.activeTextEditor.document.version;
  const selections = window.activeTextEditor.selections;

  await client.sendRequest(ExecuteCommandRequest.type, {
    command: "uroborosql-fmt.executeFormat",
    arguments: [uri, version, selections],
  });
};

export const syncSettings = async (): Promise<void> => {
  // VSCodeで開いているディレクトリを取得
  // 開いていない場合はエラーを出して終了
  const folders = workspace.workspaceFolders;
  if (folders === undefined) {
    window.showErrorMessage(
      "Error: Open the folder before executing this command.",
    );
    return;
  }

  // 設定ファイルのURIを作成
  const configFile = Uri.joinPath(folders[0].uri, getConfigFileName());

  // uroborosql-fmt の設定を取得
  const vsCodeConfig = workspace.getConfiguration("uroborosql-fmt");
  // 設定値 `configurationFilePath` の除外・ value が null のエントリを除外・ WorkSpaceConfiguration が持つメソッドと内部オブジェクトを除外
  const formattingConfig: OptionsRecord = Object.fromEntries(
    Object.entries(vsCodeConfig).filter(
      ([key, value]) =>
        key !== "configurationFilePath" &&
        value !== null &&
        typeof value !== "function" &&
        typeof value !== "object",
    ),
  );

  let existingConfig: OptionsRecord;
  if (await isFileExists(configFile)) {
    const file = await workspace.fs.readFile(configFile);
    existingConfig = JSON.parse(file.toString());
  } else {
    existingConfig = {};
  }

  // 明示的に設定したものだけを上書きする
  const merged = {
    ...existingConfig,
    ...objectToSnake(formattingConfig),
  };
  const content = JSON.stringify(merged, null, 2);

  const blob: Uint8Array = Buffer.from(content);
  await workspace.fs.writeFile(configFile, blob);
};

// uroborosqlfmtrc.json の設定を settings.json に反映
export const importSettings = async (): Promise<void> => {
  // VSCodeで開いているディレクトリを取得
  // 開いていない場合はエラーを出して終了
  const folders = workspace.workspaceFolders;
  if (folders === undefined) {
    window.showErrorMessage(
      "Error: Open the folder before executing this command.",
    );
    return;
  }

  // 設定ファイルのURIを作成
  const configUri = Uri.joinPath(folders[0].uri, getConfigFileName());

  if (!(await isFileExists(configUri))) {
    window.showErrorMessage(
      `Error: Config File of uroborosql-fmt is not found: ${configUri.path}`,
    );
    return;
  }

  const blob = await workspace.fs.readFile(configUri);
  const config: OptionsRecord = JSON.parse(blob.toString());

  // uroborosql-fmt の設定を取得
  const vsCodeConfig: WorkspaceConfiguration =
    workspace.getConfiguration("uroborosql-fmt");
  // 設定値 `configurationFilePath` の除外・ value が null のエントリを除外・ WorkSpaceConfiguration が持つメソッドと内部オブジェクトを除外
  const nonNullOptions: OptionsRecord = Object.fromEntries(
    Object.entries(vsCodeConfig).filter(
      ([key, value]) =>
        key !== "configurationFilePath" &&
        value !== null &&
        typeof value !== "function" &&
        typeof value !== "object",
    ),
  );

  // ワークスペース側で設定されている内容（`configurationFilePath` 以外）をすべてundefinedにする
  // - undefined を設定する場合： settings.json の該当項目が削除される
  // - null を設定する場合： settings.json の該当項目の値として明示的にnullが設定される
  for (const key of Object.keys(nonNullOptions)) {
    await vsCodeConfig.update(key, undefined);
  }

  // format config の値で更新する
  for (const [key, value] of Object.entries(objectToCamel(config))) {
    await vsCodeConfig.update(key, value);
  }
};
