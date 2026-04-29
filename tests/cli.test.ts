import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
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
});
