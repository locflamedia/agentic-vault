import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface PackageInfo {
  name: string;
  version: string;
}

export async function readPackageInfo(): Promise<PackageInfo> {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const packageJsonPath = path.join(packageRoot, "package.json");
  const parsed = JSON.parse(await readFile(packageJsonPath, "utf8")) as { name?: unknown; version?: unknown };

  return {
    name: typeof parsed.name === "string" ? parsed.name : "agentic-vault",
    version: typeof parsed.version === "string" ? parsed.version : "0.0.0"
  };
}
