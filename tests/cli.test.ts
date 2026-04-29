import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const cliArgs = ["--import", "tsx", "src/cli/index.ts"];

async function tempVault(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "agentic-vault-cli-"));
}

describe("cli", () => {
  it("init, scan, and check work against a fresh vault", async () => {
    const root = await tempVault();

    const init = await execFileAsync(process.execPath, [...cliArgs, "init", root]);
    expect(JSON.parse(init.stdout).created).toContain("wiki/index.md");

    const scan = await execFileAsync(process.execPath, [...cliArgs, "scan", root]);
    const scanJson = JSON.parse(scan.stdout);
    expect(scanJson.hasIndex).toBe(true);
    expect(scanJson.structuralErrors).toEqual([]);

    const check = await execFileAsync(process.execPath, [...cliArgs, "check", root]);
    expect(JSON.parse(check.stdout).structuralErrors).toEqual([]);
  });

  it("installs Codex MCP config and proactive skill in one command", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "agentic-vault-home-"));
    const vault = path.join(home, "my-vault");
    const configPath = path.join(home, ".codex", "config.toml");
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, 'model = "gpt-5.5"\n', "utf8");

    const install = await execFileAsync(process.execPath, [...cliArgs, "codex-install", vault], {
      env: { ...process.env, HOME: home }
    });
    const result = JSON.parse(install.stdout);
    const config = await readFile(configPath, "utf8");
    const skill = await readFile(path.join(home, ".codex", "skills", "agentic-vault", "SKILL.md"), "utf8");

    expect(result.vaultRoot).toContain("agentic-vault-home-");
    expect(result.restartRequired).toBe(true);
    expect(config).toContain("[mcp_servers.agentic-vault]");
    expect(config).toContain(`"mcp", "${result.vaultRoot}"`);
    expect(skill).toContain("Use the Agentic Vault MCP without waiting for an explicit tool request");
  });
});
