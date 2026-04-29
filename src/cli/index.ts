#!/usr/bin/env node
import { initVault, scanVault, vaultHealth } from "../core/vault.js";
import { errorMessage } from "../core/errors.js";
import { startMcpServer } from "../mcp/stdio.js";
import { installCodexIntegration } from "../core/codex.js";

async function main(argv: string[]): Promise<void> {
  const [command, pathArg] = argv;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const vaultRoot = pathArg ?? ".";

  if (command === "init") {
    const result = await initVault(vaultRoot);
    printJson(result);
    return;
  }

  if (command === "scan") {
    const scan = await scanVault(vaultRoot);
    printJson({
      vaultRoot: scan.vaultRoot,
      rawCount: scan.rawFiles.length,
      wikiCount: scan.wikiFiles.length,
      hasIndex: scan.hasIndex,
      brokenLinkCount: scan.graph.brokenLinks.length,
      orphanPageCount: scan.graph.orphanPages.length,
      structuralErrors: scan.structuralErrors
    });
    return;
  }

  if (command === "check") {
    const health = await vaultHealth(vaultRoot);
    printJson(health);
    const structuralErrors = Array.isArray(health.structuralErrors) ? health.structuralErrors : [];
    if (structuralErrors.length > 0) process.exitCode = 1;
    return;
  }

  if (command === "mcp") {
    await startMcpServer(vaultRoot);
    return;
  }

  if (command === "codex-install") {
    const result = await installCodexIntegration(pathArg);
    printJson({
      ...result,
      restartRequired: true
    });
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function printHelp(): void {
  process.stdout.write(`agentic-vault

Usage:
  agentic-vault init <vault-path>
  agentic-vault scan <vault-path>
  agentic-vault check <vault-path>
  agentic-vault mcp <vault-path>
  agentic-vault codex-install [vault-path]

V1 is local-first: raw/ is read-only source material, wiki/ is AI-maintained markdown.
`);
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${errorMessage(error)}\n`);
  process.exitCode = 1;
});
