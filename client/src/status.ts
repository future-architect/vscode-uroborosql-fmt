import { StatusBarAlignment, ThemeColor, window } from "vscode";

export type StatusBarState = "normal" | "error";

export type StatusBarController = {
  showNormal(): void;
  showError(): void;
  showOutput(): void;
  getState(): StatusBarState;
  dispose(): void;
};

const NORMAL_TEXT = "Uroborosql-fmt";
const ERROR_TEXT = "$(alert) Uroborosql-fmt";

export function createStatusBarController(
  showOutput: () => void,
): StatusBarController {
  const statusBar = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  let state: StatusBarState = "normal";

  statusBar.name = NORMAL_TEXT;
  statusBar.command = "uroborosql-fmt.show-output";

  const applyState = (nextState: StatusBarState) => {
    state = nextState;
    statusBar.text = nextState === "error" ? ERROR_TEXT : NORMAL_TEXT;
    statusBar.backgroundColor =
      nextState === "error"
        ? new ThemeColor("statusBarItem.errorBackground")
        : undefined;
  };

  applyState("normal");
  statusBar.show();

  return {
    showNormal: () => applyState("normal"),
    showError: () => applyState("error"),
    showOutput,
    getState: () => state,
    dispose: () => statusBar.dispose(),
  };
}
