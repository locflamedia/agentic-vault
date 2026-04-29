import path from "node:path";
import { mkdir, realpath, stat } from "node:fs/promises";
import { VaultError } from "./errors.js";

export async function normalizeVaultRoot(vaultRoot: string): Promise<string> {
  const root = path.resolve(vaultRoot);
  await mkdir(root, { recursive: true });
  return realpath(root);
}

export function normalizeVaultRelativePath(input: string): string {
  if (!input || input.includes("\0")) {
    throw new VaultError("Path must be a non-empty vault-relative path.", "INVALID_PATH");
  }

  const unixPath = input.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (path.posix.isAbsolute(unixPath) || path.isAbsolute(input)) {
    throw new VaultError("Absolute paths are not allowed inside vault tools.", "ABSOLUTE_PATH");
  }

  const normalized = path.posix.normalize(unixPath);
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    throw new VaultError("Path traversal outside the vault is not allowed.", "PATH_TRAVERSAL");
  }

  return normalized;
}

export function safeJoin(vaultRoot: string, relativePath: string): string {
  const normalized = normalizeVaultRelativePath(relativePath);
  const candidate = path.resolve(vaultRoot, normalized);
  const rootWithSep = vaultRoot.endsWith(path.sep) ? vaultRoot : `${vaultRoot}${path.sep}`;

  if (candidate !== vaultRoot && !candidate.startsWith(rootWithSep)) {
    throw new VaultError("Resolved path escapes the vault root.", "PATH_ESCAPES_VAULT");
  }

  return candidate;
}

export async function assertExistingPathInsideVault(vaultRoot: string, relativePath: string): Promise<string> {
  const absolutePath = safeJoin(vaultRoot, relativePath);
  const [rootReal, targetReal] = await Promise.all([realpath(vaultRoot), realpath(absolutePath)]);
  const rootWithSep = rootReal.endsWith(path.sep) ? rootReal : `${rootReal}${path.sep}`;

  if (targetReal !== rootReal && !targetReal.startsWith(rootWithSep)) {
    throw new VaultError("Existing path resolves outside the vault root.", "SYMLINK_ESCAPES_VAULT");
  }

  return targetReal;
}

export async function assertWritablePathInsideVault(vaultRoot: string, relativePath: string): Promise<string> {
  const absolutePath = safeJoin(vaultRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  const [rootReal, parentReal] = await Promise.all([realpath(vaultRoot), realpath(path.dirname(absolutePath))]);
  const rootWithSep = rootReal.endsWith(path.sep) ? rootReal : `${rootReal}${path.sep}`;

  if (parentReal !== rootReal && !parentReal.startsWith(rootWithSep)) {
    throw new VaultError("Writable path parent resolves outside the vault root.", "SYMLINK_ESCAPES_VAULT");
  }

  return absolutePath;
}

export function toPosixRelative(fromRoot: string, absolutePath: string): string {
  return path.relative(fromRoot, absolutePath).split(path.sep).join("/");
}

export async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function isUnderDir(relativePath: string, dir: string): boolean {
  const normalized = normalizeVaultRelativePath(relativePath);
  return normalized === dir || normalized.startsWith(`${dir}/`);
}
