# Changelog

## 1.1.0

### Minor Changes

- 5df3a5c: Improved to notify the status bar when formatting errors.
- 8751506: Update uroborosql-fmt

  - Support Unary operators
  - Support arithmetic expressions in limit clause
  - Fix consecutive comments at the end of with_clause parentheses
  - Fix swapping positions of comma and comment
  - Supprt filter clause
  - Fix the vertical alignment of 2WaySQL
  - Fix block comment alignment
  - Handle comments after select_statement at the end of insert_statement
  - Support comments after join keyword
  - Handle block comments after recursive keyword
  - support comments after opening parenthesis in IN expression
  - Support comments after SET keyword
  - Support comments before select_statement in insert_statement

- ee4d6d4: Added setting options to apply options of urborosql-fmt.
- f80e2b1: Added commands to import/export configurations.

## 1.0.11

### Patch Changes

- 988c76d: Fixed incorrect indentation when tab_size is 2byte

## 1.0.10

### Patch Changes

- 5fdb841: Support using clause in DELETE statement. Fix formatting of bind parameter in first column of select clause. Improvement error message.
- 804f9d7: Allow formatting even if the workspace folder cannot be obtained

## 1.0.9

### Patch Changes

- 53862d7: Support join clause in update statement

## 1.0.8

- Fix lack of null expression handling in type_cast
- Add option to convert "<>" to "!="
- Add description of configuration to README.md

## 1.0.7

- Change default case format settings to lower
- chore(deps): update actions/setup-node action to v3 (#14)
- chore(deps): update actions/upload-artifact action to v3 (#15)
- fix(deps): update dependency vscode-languageserver to v9 (#17)

## 1.0.6

- chore: update integrity of uroborosql-fmt-napi (#18)

## 1.0.5

- Support for ALL/DISTINCT/ORDER BY in aggregate functions
- chore: support for proxy to download-uroborosql-fmt-napi (#10)
- chore: repository maintenance (#11)
- chore(deps): update actions/download-artifact action to v3 (#13)
- chore(deps): update actions/checkout action to v4 (#12)

## 1.0.4

- fix: add uroborosql-fmt-napi-0.0.0.tgz to .vscodeignore (#9)

## 1.0.3

- Initial release.
