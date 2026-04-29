import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { LOG_DIR } from "./constants.js";
import { assertWritablePathInsideVault } from "./paths.js";

export interface VaultLogEntry {
  action: string;
  path?: string;
  detail?: Record<string, unknown>;
  timestamp?: string;
}

export async function appendVaultLog(vaultRoot: string, entry: VaultLogEntry): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const relativePath = `${LOG_DIR}/${today}.jsonl`;
  const absolutePath = await assertWritablePathInsideVault(vaultRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await appendFile(absolutePath, `${JSON.stringify({ ...entry, timestamp: entry.timestamp ?? new Date().toISOString() })}\n`);
}
