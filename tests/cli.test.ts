import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const cliArgs = ["--import", "tsx", "src/cli/index.ts"];

async function runCli(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<{ code: number; stdout: string }> {
  try {
    const result = await execFileAsync(process.execPath, [...cliArgs, ...args], { env });
    return { code: 0, stdout: result.stdout };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string };
    return { code: failed.code ?? 1, stdout: failed.stdout ?? "" };
  }
}

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

  it("doctor fails when Codex config is missing", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "agentic-vault-doctor-home-"));
    const vault = await tempVault();
    await execFileAsync(process.execPath, [...cliArgs, "init", vault]);

    const result = await runCli(["doctor", vault], { ...process.env, HOME: home });
    const report = JSON.parse(result.stdout);

    expect(result.code).toBe(1);
    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "codex-config", status: "fail" }),
        expect.objectContaining({ name: "codex-skill", status: "fail" })
      ])
    );
  });

  it("doctor --fix creates Codex config, skill, vault, and then passes", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "agentic-vault-doctor-fix-home-"));
    const vault = path.join(home, "my-vault");
    const env = { ...process.env, HOME: home };

    const fixed = await runCli(["doctor", "--fix", vault], env);
    const fixedReport = JSON.parse(fixed.stdout);
    const checked = await runCli(["doctor", vault], env);
    const checkedReport = JSON.parse(checked.stdout);

    expect(fixed.code).toBe(0);
    expect(fixedReport.ok).toBe(true);
    expect(checked.code).toBe(0);
    expect(checkedReport.ok).toBe(true);
    expect(checkedReport.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "vault-health", status: "pass" }),
        expect.objectContaining({ name: "codex-config", status: "pass" }),
        expect.objectContaining({ name: "codex-skill", status: "pass" }),
        expect.objectContaining({ name: "mcp-smoke-test", status: "pass" })
      ])
    );
  });

  it("doctor exits non-zero when vault structure is invalid", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "agentic-vault-doctor-bad-vault-home-"));
    const vault = await tempVault();
    await execFileAsync(process.execPath, [...cliArgs, "codex-install", vault], {
      env: { ...process.env, HOME: home }
    });
    await writeFile(path.join(vault, "wiki", "index.md"), "# not enough to fail\n", "utf8");
    await rm(path.join(vault, "raw"), { recursive: true, force: true });

    const result = await runCli(["doctor", vault], { ...process.env, HOME: home });
    const report = JSON.parse(result.stdout);

    expect(result.code).toBe(1);
    expect(report.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "vault-health", status: "fail" })])
    );
  });
});
