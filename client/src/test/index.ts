import { collectTestFiles, runMocha } from "./mochaRunner";

export async function run(): Promise<void> {
  const files = await collectTestFiles(__dirname);
  return runMocha(files);
}
