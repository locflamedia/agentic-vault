import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initVault } from "./vault.js";

const CODEX_SKILL = `---
name: agentic-vault
description: Use proactively when the user asks about saved knowledge, prior notes, source material, durable memory, wiki pages, Obsidian-style links, or anything that should be remembered for future reuse. Also use when managing a local-first AI knowledge vault with raw/ source files, wiki/ markdown pages, backlinks, and the Agentic Vault MCP server.
---

# Agentic Vault

Use this skill when the user wants an AI-managed local wiki that compounds over time.

## Proactive Use

Use the Agentic Vault MCP without waiting for an explicit tool request when:

- The user asks a question that may be answered from saved notes, prior research, or local source material.
- The user says to remember, save, capture, document, summarize for later, or build durable context.
- The user is working on a topic that could benefit from existing wiki pages or raw sources.
- The answer contains reusable project knowledge, decisions, explanations, comparisons, or operating procedures.
- The user asks for a review, synthesis, gap analysis, weekly review, or next actions for a knowledge/project space.

Default behavior:

1. Start with \`vault_scan\` or \`vault_health_check\` when vault context may matter.
2. Use \`wiki_find_related\` before answering if the topic may already exist in the vault.
3. Read relevant \`wiki/\` pages and \`raw/\` sources before making source-backed claims.
4. Offer to save lightweight notes only when the value is uncertain; save directly when the user clearly asks to remember or preserve the answer.

## Workflow

1. Run \`vault_scan\` or \`vault_health_check\` first.
2. Treat \`raw/\` as read-only source material.
3. Read relevant raw sources and existing wiki pages before writing.
4. Prefer updating existing pages when they cover the same concept.
5. Create focused markdown pages under \`wiki/\` when a concept, comparison, question, project, or source deserves durable reuse.
6. Update \`wiki/index.md\` when the vault map changes.
7. Use \`wiki_check_links\` after meaningful writes.

## Page Format

Wiki pages should use YAML frontmatter:

\`\`\`yaml
---
title: "Page Title"
type: concept
status: draft
sources:
  - raw/example.md
related:
  - "[[Related Page]]"
created: 2026-04-29
updated: 2026-04-29
---
\`\`\`

Use these body sections by default:

\`\`\`markdown
# Page Title

## Summary

## Key Ideas

## Source Notes

## Related
\`\`\`

## Safety

- Never write to \`raw/\`.
- Never invent source paths.
- Keep source-derived claims traceable to \`raw/\` paths.
- Save valuable answers back into \`wiki/\` when they are likely to be reused.
`;

export interface CodexInstallResult {
  vaultRoot: string;
  configPath: string;
  skillPath: string;
  mcpServer: {
    name: string;
    command: string;
    args: string[];
  };
}

export async function installCodexIntegration(vaultRootInput?: string): Promise<CodexInstallResult> {
  const defaultVaultRoot = path.join(os.homedir(), "Documents", "my-vault");
  const vaultRoot = expandHome(vaultRootInput?.trim() || defaultVaultRoot);
  const init = await initVault(vaultRoot);
  const codexRoot = path.join(os.homedir(), ".codex");
  const configPath = path.join(codexRoot, "config.toml");
  const skillPath = path.join(codexRoot, "skills", "agentic-vault", "SKILL.md");
  const mcpServer = serverCommand(init.vaultRoot);

  await mkdir(path.dirname(skillPath), { recursive: true });
  await writeFile(skillPath, CODEX_SKILL.endsWith("\n") ? CODEX_SKILL : `${CODEX_SKILL}\n`, "utf8");

  await mkdir(codexRoot, { recursive: true });
  const existingConfig = existsSync(configPath) ? await readFile(configPath, "utf8") : "";
  await writeFile(configPath, upsertMcpServer(existingConfig, mcpServer.command, mcpServer.args), "utf8");

  return {
    vaultRoot: init.vaultRoot,
    configPath,
    skillPath,
    mcpServer: {
      name: "agentic-vault",
      ...mcpServer
    }
  };
}

function expandHome(input: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

function serverCommand(vaultRoot: string): { command: string; args: string[] } {
  const cliPath = process.argv[1] ?? "";
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const distCliPath = path.join(packageRoot, "dist", "cli", "index.js");

  if (existsSync(distCliPath) && !packageRoot.includes(`${path.sep}_npx${path.sep}`)) {
    return { command: "node", args: [distCliPath, "mcp", vaultRoot] };
  }

  if (cliPath && existsSync(cliPath)) {
    if (cliPath.endsWith(".ts")) {
      return { command: process.execPath, args: [...process.execArgv, cliPath, "mcp", vaultRoot] };
    }
    return { command: "node", args: [cliPath, "mcp", vaultRoot] };
  }

  return { command: "npx", args: ["-y", "@locflamedia/agentic-vault", "mcp", vaultRoot] };
}

function upsertMcpServer(config: string, command: string, args: string[]): string {
  const block = [
    "[mcp_servers.agentic-vault]",
    `command = ${tomlString(command)}`,
    `args = [${args.map(tomlString).join(", ")}]`
  ].join("\n");
  const sectionPattern = /(?:^|\n)\[mcp_servers\.agentic-vault\]\n[\s\S]*?(?=\n\[[^\]]+\]|$)/;
  const trimmedBlock = `\n${block}\n`;

  if (sectionPattern.test(config)) {
    return ensureTrailingNewline(config.replace(sectionPattern, trimmedBlock));
  }

  return ensureTrailingNewline(`${config.trimEnd()}${trimmedBlock}`);
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}
