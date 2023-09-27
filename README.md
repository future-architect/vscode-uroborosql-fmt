# uroboroSQL-fmt for VSCode

![logo](./images/logo.png)

![demo](./images/demo.gif)

A Visual Studio Code extension for [uroboroSQL-fmt](https://github.com/future-architect/uroborosql-fmt) that is a tool that formats SQL statements according to [SQL coding standards created by Future Corporation](https://future-architect.github.io/coding-standards/documents/forSQL/SQL%E3%82%B3%E3%83%BC%E3%83%87%E3%82%A3%E3%83%B3%E3%82%B0%E8%A6%8F%E7%B4%84%EF%BC%88PostgreSQL%EF%BC%89.html) (Japanese only).

## Usage

Once installed in Visual Studio Code, "uroborosql-fmt" will be available as a formatter for SQL files. Please select "uroborosql-fmt" (extension id:`Future.uroborosql-fmt`) as the default formatter. You can do this either by using the context menu (right click on a open SQL file in the editor) and select "Format Document With...", or you can add the following to your settings:

```json
{
  "[sql]": {
    "editor.defaultFormatter": "Future.uroborosql-fmt"
  }
}
```

### Format on save

You can enable format on save for SQL by having the following values in your settings:

```json
{
  "[sql]": {
    "editor.defaultFormatter": "Future.uroborosql-fmt",
    "editor.formatOnSave": true
  }
}
```

## Settings

| Settings                             | Defaults | Description                                                                                                                                                                                                                                                                                               |
| ------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| uroborosql-fmt.configurationFilePath | null     | The path of configuration file. File extension must be `.json`. If you don't specify the path and `./.uroborosqlfmtrc.json` exists, formatter will use `./.uroborosqlfmtrc.json`. If you doesn't specify and `.uroborosqlfmtrc.json` doesn't exist, formatter will use formatters default configurations. |

## License

[Business Source License 1.1](https://github.com/future-architect/vscode-uroborosql-fmt/blob/main/LICENSE)
