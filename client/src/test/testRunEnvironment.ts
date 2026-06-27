import { mkdir, mkdtemp, rm } from "fs/promises";
import * as os from "os";
import * as path from "path";

type IsolatedTestDirs = {
  userDataDir: string;
  extensionsDir: string;
};

export async function withIsolatedTestDirs<T>(
  prefix: string,
  callback: (dirs: IsolatedTestDirs) => Promise<T>,
): Promise<T> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  const userDataDir = path.join(rootDir, "user-data");
  const extensionsDir = path.join(rootDir, "extensions");

  await mkdir(userDataDir, { recursive: true });
  await mkdir(extensionsDir, { recursive: true });

  try {
    return await callback({ userDataDir, extensionsDir });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}
