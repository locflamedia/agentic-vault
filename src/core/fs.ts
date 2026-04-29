import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import { TEXT_FILE_EXTENSIONS } from "./constants.js";
import { toPosixRelative } from "./paths.js";

export async function listFilesRecursive(root: string, options: { textOnly?: boolean } = {}): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".agentic-vault") continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (options.textOnly && !TEXT_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      results.push(toPosixRelative(root, absolute));
    }
  }

  try {
    const rootStat = await stat(root);
    if (!rootStat.isDirectory()) return [];
    await walk(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  return results.sort((a, b) => a.localeCompare(b));
}
