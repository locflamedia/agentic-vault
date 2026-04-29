import path from "node:path";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { GRAPH_PATH, INDEX_PATH, LOG_DIR, MANIFEST_PATH, RAW_DIR, STATE_DIR, WIKI_DIR } from "./constants.js";
import { listFilesRecursive } from "./fs.js";
import { buildGraph, findRelatedPages, VaultGraph, WikiPageRecord } from "./graph.js";
import { ensureMarkdownExtension, slugifyTitle } from "./markdown.js";
import { DEFAULT_AGENTS, DEFAULT_CLAUDE, DEFAULT_INDEX, DEFAULT_QUESTIONS } from "./templates.js";
import {
  assertExistingPathInsideVault,
  assertWritablePathInsideVault,
  isUnderDir,
  normalizeVaultRelativePath,
  normalizeVaultRoot,
  pathExists,
  safeJoin
} from "./paths.js";
import { VaultError } from "./errors.js";
import { appendVaultLog } from "./log.js";

export interface VaultScan {
  vaultRoot: string;
  rawFiles: string[];
  wikiFiles: string[];
  hasIndex: boolean;
  manifestPath: string;
  graph: VaultGraph;
  structuralErrors: string[];
}

export async function initVault(vaultRootInput: string): Promise<{ vaultRoot: string; created: string[] }> {
  const vaultRoot = await normalizeVaultRoot(vaultRootInput);
  const created: string[] = [];

  for (const relativePath of [RAW_DIR, WIKI_DIR, `${WIKI_DIR}/questions`, STATE_DIR, LOG_DIR]) {
    const absolutePath = safeJoin(vaultRoot, relativePath);
    if (!(await pathExists(absolutePath))) created.push(relativePath);
    await mkdir(absolutePath, { recursive: true });
  }

  await writeIfMissing(vaultRoot, INDEX_PATH, DEFAULT_INDEX, created);
  await writeIfMissing(vaultRoot, `${WIKI_DIR}/questions.md`, DEFAULT_QUESTIONS, created);
  await writeIfMissing(vaultRoot, "AGENTS.md", DEFAULT_AGENTS, created);
  await writeIfMissing(vaultRoot, "CLAUDE.md", DEFAULT_CLAUDE, created);
  await writeManifestAndGraph(vaultRoot);
  await appendVaultLog(vaultRoot, { action: "vault_init", detail: { created } });

  return { vaultRoot, created };
}

export async function scanVault(vaultRootInput: string): Promise<VaultScan> {
  const vaultRoot = await normalizeVaultRoot(vaultRootInput);
  const rawRoot = safeJoin(vaultRoot, RAW_DIR);
  const wikiRoot = safeJoin(vaultRoot, WIKI_DIR);
  const rawLocal = await listFilesRecursive(rawRoot, { textOnly: true });
  const wikiLocal = (await listFilesRecursive(wikiRoot, { textOnly: true })).filter((file) => file.endsWith(".md"));
  const rawFiles = rawLocal.map((file) => `${RAW_DIR}/${file}`);
  const wikiFiles = wikiLocal.map((file) => `${WIKI_DIR}/${file}`);
  const pages = await Promise.all(
    wikiFiles.map(async (file) => ({ path: file, content: await readVaultText(vaultRoot, file) }))
  );
  const graph = buildGraph(pages);
  const hasIndex = await pathExists(safeJoin(vaultRoot, INDEX_PATH));
  const structuralErrors: string[] = [];

  for (const requiredDir of [RAW_DIR, WIKI_DIR, STATE_DIR]) {
    try {
      const info = await stat(safeJoin(vaultRoot, requiredDir));
      if (!info.isDirectory()) structuralErrors.push(`${requiredDir} exists but is not a directory.`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") structuralErrors.push(`${requiredDir} is missing.`);
      else throw error;
    }
  }

  if (!hasIndex) structuralErrors.push(`${INDEX_PATH} is missing.`);

  return {
    vaultRoot,
    rawFiles,
    wikiFiles,
    hasIndex,
    manifestPath: MANIFEST_PATH,
    graph,
    structuralErrors
  };
}

export async function writeManifestAndGraph(vaultRootInput: string): Promise<void> {
  const vaultRoot = await normalizeVaultRoot(vaultRootInput);
  const scan = await scanVault(vaultRoot);
  const manifest = {
    version: 1,
    updated: new Date().toISOString(),
    rawCount: scan.rawFiles.length,
    wikiCount: scan.wikiFiles.length,
    hasIndex: scan.hasIndex
  };

  await writeVaultText(vaultRoot, MANIFEST_PATH, JSON.stringify(manifest, null, 2), { allowState: true, log: false });
  await writeVaultText(vaultRoot, GRAPH_PATH, JSON.stringify(scan.graph, null, 2), { allowState: true, log: false });
}

export async function readVaultText(vaultRootInput: string, relativePathInput: string): Promise<string> {
  const vaultRoot = await normalizeVaultRoot(vaultRootInput);
  const relativePath = normalizeVaultRelativePath(relativePathInput);
  await assertExistingPathInsideVault(vaultRoot, relativePath);
  return readFile(safeJoin(vaultRoot, relativePath), "utf8");
}

export async function readRawSource(vaultRoot: string, relativePath: string): Promise<string> {
  const normalized = normalizeVaultRelativePath(relativePath);
  if (!isUnderDir(normalized, RAW_DIR)) {
    throw new VaultError("raw_read can only read files under raw/.", "RAW_ONLY");
  }
  return readVaultText(vaultRoot, normalized);
}

export async function readWikiPage(vaultRoot: string, relativePath: string): Promise<string> {
  const normalized = normalizeVaultRelativePath(relativePath);
  if (!isUnderDir(normalized, WIKI_DIR)) {
    throw new VaultError("wiki_read can only read files under wiki/.", "WIKI_ONLY");
  }
  return readVaultText(vaultRoot, normalized);
}

export async function writeWikiPage(
  vaultRootInput: string,
  relativePathInput: string,
  content: string,
  options: { overwrite?: boolean; action?: string } = {}
): Promise<{ path: string }> {
  const relativePath = normalizeWikiWritePath(relativePathInput);
  await writeVaultText(vaultRootInput, relativePath, content, {
    overwrite: options.overwrite ?? true,
    log: true,
    action: options.action ?? "wiki_write"
  });
  return { path: relativePath };
}

export async function saveAnswerAsPage(
  vaultRoot: string,
  title: string,
  content: string,
  sources: string[] = []
): Promise<{ path: string }> {
  const filename = `${slugifyTitle(title)}.md`;
  const sourceBlock = sources.length > 0 ? sources.map((source) => `  - ${source}`).join("\n") : "[]";
  const today = new Date().toISOString().slice(0, 10);
  const page = `---
title: "${title}"
type: question
status: draft
sources:
${sourceBlock}
related: []
created: ${today}
updated: ${today}
---

# ${title}

## Summary

${content.trim()}

## Key Ideas

## Source Notes

## Related
`;
  return writeWikiPage(vaultRoot, `${WIKI_DIR}/questions/${filename}`, page, {
    overwrite: false,
    action: "answer_save_as_page"
  });
}

export async function relatedWikiPages(vaultRoot: string, query: string, limit?: number): Promise<WikiPageRecord[]> {
  const scan = await scanVault(vaultRoot);
  return findRelatedPages(query, scan.graph.pages, limit);
}

export async function vaultHealth(vaultRoot: string): Promise<Record<string, unknown>> {
  const scan = await scanVault(vaultRoot);
  return {
    vaultRoot: scan.vaultRoot,
    rawCount: scan.rawFiles.length,
    wikiCount: scan.wikiFiles.length,
    hasIndex: scan.hasIndex,
    structuralErrors: scan.structuralErrors,
    brokenLinks: scan.graph.brokenLinks,
    orphanPages: scan.graph.orphanPages
  };
}

async function writeVaultText(
  vaultRootInput: string,
  relativePathInput: string,
  content: string,
  options: { overwrite?: boolean; allowState?: boolean; log?: boolean; action?: string } = {}
): Promise<void> {
  const vaultRoot = await normalizeVaultRoot(vaultRootInput);
  const relativePath = normalizeVaultRelativePath(relativePathInput);
  const canWriteWiki = isUnderDir(relativePath, WIKI_DIR);
  const canWriteState = options.allowState === true && isUnderDir(relativePath, STATE_DIR);
  if (!canWriteWiki && !canWriteState) {
    throw new VaultError("Writes are only allowed under wiki/ or approved .agentic-vault/ state paths.", "WRITE_FORBIDDEN");
  }

  const absolutePath = await assertWritablePathInsideVault(vaultRoot, relativePath);
  if (options.overwrite === false && (await pathExists(absolutePath))) {
    throw new VaultError(`Refusing to overwrite existing file: ${relativePath}`, "FILE_EXISTS");
  }

  await writeFile(absolutePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  if (options.log !== false) {
    await appendVaultLog(vaultRoot, { action: options.action ?? "write", path: relativePath });
  }
}

function normalizeWikiWritePath(relativePathInput: string): string {
  const relativePath = ensureMarkdownExtension(normalizeVaultRelativePath(relativePathInput));
  if (!isUnderDir(relativePath, WIKI_DIR)) {
    throw new VaultError("Wiki writes must target a path under wiki/.", "WIKI_WRITE_ONLY");
  }
  return relativePath;
}

async function writeIfMissing(vaultRoot: string, relativePath: string, content: string, created: string[]): Promise<void> {
  const absolutePath = path.resolve(vaultRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  if (await pathExists(absolutePath)) return;
  await writeFile(absolutePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  created.push(relativePath);
}
