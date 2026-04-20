declare module "uroborosql-fmt-napi" {
  export function runfmt(
    input: string,
    configPath?: string | null,
  ): string;
  export function runfmtWithSettings(
    input: string,
    settingsJson: string,
    configPath?: string | null,
  ): string;
  export function runLanguageServer(): void;
}
