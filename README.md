# uroboroSQL-fmt for VSCode

![logo](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/images/logo.png)

![demo](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/images/demo.gif)

[uroboroSQL-fmt](https://github.com/future-architect/uroborosql-fmt) is a tool that formats SQL statements according to [SQL coding standards created by Future Corporation](https://future-architect.github.io/coding-standards/documents/forSQL/SQL%E3%82%B3%E3%83%BC%E3%83%87%E3%82%A3%E3%83%B3%E3%82%B0%E8%A6%8F%E7%B4%84%EF%BC%88PostgreSQL%EF%BC%89.html) (Japanese only).

It instantly converts indentation, line breaks, and case distinctions in SQL statements to improve readability and manageability.

Our previous tool, [uroboroSQL formatter](https://github.com/future-architect/uroboroSQL-formatter), was made in python and used lexical analysis to format.

Tools based on lexical analysis had difficulty in processing parentheses, etc., and because it was made in Python, it was difficult to make it a VSCode extension.

Therefore, we have created this tool made in Rust, which formats using parsing.

The main features:

- Written in Rust.
- Only PostgreSQL is supported.
  - However, not all PostgreSQL syntax is supported.
- Supports 2way-sql such as [uroboroSQL](https://future-architect.github.io/uroborosql-doc/) and [doma2](https://doma.readthehttps://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs.io/en/latest/).
- Some Auto Fix functions are available.
- All indentation is done in tabs.
- **Leading comma style**, not a trailing comma style.

 ```sql
	SELECT
		A	AS	A
	,	B	AS	B
	,	C	AS	C
 ```

## Install

1. Open [Visual Studio Code](https://code.visualstudio.com/)
2. Press `Ctrl+P`/`Ctrl+P`/`⌘P` to open the Quick Open dialog
3. Type `ext install uroborosql-fmt` to find the extension
4. Click the `Install` button, then the `Enable` button

## Configuration options

Create `uroborosqlfmt-config.json` in the root of the current working directory.

If there is no configuration file, the default values are used.

| name                                                                           | type                                 | description                                                                                                                                                                                                                                            | default |
| ------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| [`debug`](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/options/debug.md)                                               | bool                                 | Run in debug mode.                                                                                                                                                                                                                                     | false   |
| [`tab_size`](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/options/tab_size.md)                                         | int                                  | Tab size used for formatting.                                                                                                                                                                                                                          | 4       |
| [`complement_alias`](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/options/complement_alias.md)                         | bool                                 | Complement aliases. Currently, column names are auto-completed with the same name. (e.g. `COL1` → `COL1 AS COL1`)                                                                                                                                      | true    |
| [`trim_bind_param`](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/options/trim_bind_param.md)                           | bool                                 | Trim the contents of the [bind parameters](https://future-architect.github.io/uroborosql-doc/background/#%E3%83%8F%E3%82%99%E3%82%A4%E3%83%B3%E3%83%88%E3%82%99%E3%83%8F%E3%82%9A%E3%83%A9%E3%83%A1%E3%83%BC%E3%82%BF). (e.g. `/* foo */` → `/*foo*/`) | false   |
| [`keyword_case`](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/options/keyword_case.md)                                 | [`"upper"`, `"lower"`, `"preserve"`] | Unify the case of keywords. (No conversion in case of `"preserve"`)                                                                                                                                                                                    | upper   |
| [`identifier_case`](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/options/identifier_case.md)                           | [`"upper"`, `"lower"`, `"preserve"`] | Unify the case of identifiers. (No conversion in case of `"preserve"`)                                                                                                                                                                                 | upper   |
| [`max_char_per_line`](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/options/max_char_per_line.md)                       | int                                  | If the total number of characters in the function name and arguments exceeds `max_char_per_line`, the arguments are formatted with new lines.                                                                                                          | 50      |
| [`complement_outer_keyword`](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/options/complement_outer_keyword.md)         | bool                                 | Complement the optional `OUTER`. (e.g. `LEFT JOIN` → `LEFT OUTER JOIN`)                                                                                                                                                                                | true    |
| [`complement_column_as_keyword`](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/options/complement_column_as_keyword.md) | bool                                 | Complement `AS` in column aliases.                                                                                                                                                                                                                     | true    |
| [`remove_table_as_keyword`](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/options/remove_table_as_keyword.md)           | bool                                 | Remove `AS` in table aliases.                                                                                                                                                                                                                          | true    |
| [`remove_redundant_nest`](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/options/remove_redundant_nest.md)               | bool                                 | Remove redundant parentheses. (e.g. `(((foo)))` → `(foo)`)                                                                                                                                                                                             | true    |
| [`complement_sql_id`](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/options/complement_sql_id.md)                       | bool                                 | Complement [SQL ID](https://palette-doc.rtfa.as/coding-standards/forSQL/SQL%E3%82%B3%E3%83%BC%E3%83%87%E3%82%A3%E3%83%B3%E3%82%B0%E8%A6%8F%E7%B4%84%EF%BC%88uroboroSQL%EF%BC%89.html#sql-%E8%AD%98%E5%88%A5%E5%AD%90).                                 | false   |
| [`convert_double_colon_cast`](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/options/convert_double_colon_cast.md)         | bool                                 | Convert casts by `X::type` to the form `CAST(X AS type)`.                                                                                                                                                                                              | true    |

## Structure

- [Overview of the process flow](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/structure/overview_of_the_process_flow.md)
  - This tool uses [tree-sitter](https://github.com/tree-sitter/tree-sitter) and [tree-sitter-sql](https://github.com/future-architect/tree-sitter-sql) (upstream: [m-novikov/tree-sitter-sql](https://github.com/m-novikov/tree-sitter-sql)). Thanks to the developers of these tools.
- [How to format 2way-sql](https://github.com/future-architect/vscode-uroborosql-fmt/tree/main/docs/structure/how_to_format_2way_sql.md)

## License

[Business Source License 1.1](https://github.com/future-architect/vscode-uroborosql-fmt/blob/main/LICENSE)
