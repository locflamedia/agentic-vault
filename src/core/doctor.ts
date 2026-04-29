import { access, readFile } from "node:fs/promises";
import { constants as fsConstants, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { installCodexIntegration } from "./codex.js";
import { errorMessage } from "./errors.js";
import { readPackageInfo } from "./package-info.js";
import { vaultHealth } from "./vault.js";

export type DoctorCheckStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
  name: string;
  status: DoctorCheckStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface DoctorReport {
  ok: boolean;
  checks: DoctorCheck[];
  suggestedActions: string[];
}

interface CodexMcpConfig {
  command: string;
  args: string[];
}

export async function runDoctor(vaultRootInput?: string, options: { fix?: boolean } = {}): Promise<DoctorReport> {
  const vaultRoot = expandHome(vaultRootInput?.trim() || path.join(os.homedir(), "Documents", "my-vault"));
  if (options.fix) await installCodexIntegration(vaultRoot);

  const checks: DoctorCheck[] = [];
  checks.push(checkNodeVersion());
  checks.push(await checkPackageBinary());
  checks.push(await checkVault(vaultRoot));

  const codexConfig = await checkCodexConfig();
  checks.push(codexConfig.check);

  checks.push(await checkCodexSkill());

  const mcpCommand = codexConfig.config ? await checkMcpCommand(codexConfig.config) : missingMcpCommandCheck();
  checks.push(mcpCommand);

  if (codexConfig.config && mcpCommand.status !== "fail") {
    checks.push(await checkMcpSmoke(codexConfig.config));
  } else {
    checks.push({
      name: "mcp-smoke-test",
      status: "fail",
      message: "Cannot run MCP smoke test until the Codex MCP command is configured and executable."
    });
  }

  const suggestedActions = suggestedActionsFor(checks, options.fix === true);
  return {
    ok: !checks.some((check) => check.status === "fail"),
    checks,
    suggestedActions
  };
}

function checkNodeVersion(): DoctorCheck {
  const major = Number(process.versions.node.split(".")[0] ?? 0);
  return {
    name: "node-version",
    status: major >= 20 ? "pass" : "fail",
    message: major >= 20 ? `Node ${process.versions.node} satisfies >=20.` : `Node ${process.versions.node} is below 20.`,
    details: { version: process.versions.node, required: ">=20.0.0" }
  };
}

async function checkPackageBinary(): Promise<DoctorCheck> {
  try {
    const info = await readPackageInfo();
    return {
      name: "package-binary",
      status: "pass",
      message: `${info.name}@${info.version} package metadata is readable and the CLI is running.`,
      details: { name: info.name, version: info.version, argv: process.argv.slice(0, 2) }
    };
  } catch (error) {
    return {
      name: "package-binary",
      status: "fail",
      message: `Package metadata could not be read: ${errorMessage(error)}`
    };
  }
}

async function checkVault(vaultRoot: string): Promise<DoctorCheck> {
  try {
    const health = await vaultHealth(vaultRoot);
    const structuralErrors = Array.isArray(health.structuralErrors) ? health.structuralErrors : [];
    const status = structuralErrors.length === 0 ? "pass" : "fail";
    return {
      name: "vault-health",
      status,
      message: status === "pass" ? "Vault structure is healthy." : "Vault has structural errors.",
      details: health
    };
  } catch (error) {
    return {
      name: "vault-health",
      status: "fail",
      message: `Vault could not be checked: ${errorMessage(error)}`,
      details: { vaultRoot }
    };
  }
}

async function checkCodexConfig(): Promise<{ check: DoctorCheck; config?: CodexMcpConfig }> {
  const configPath = codexConfigPath();
  try {
    const text = await readFile(configPath, "utf8");
    const config = parseAgenticVaultMcpConfig(text);
    if (!config) {
      return {
        check: {
          name: "codex-config",
          status: "fail",
          message: "Codex config exists but does not include [mcp_servers.agentic-vault].",
          details: { configPath }
        }
      };
    }

    return {
      check: {
        name: "codex-config",
        status: "pass",
        message: "Codex MCP config includes agentic-vault.",
        details: { configPath, command: config.command, args: config.args }
      },
      config
    };
  } catch (error) {
    return {
      check: {
        name: "codex-config",
        status: "fail",
        message: `Codex config could not be read: ${errorMessage(error)}`,
        details: { configPath }
      }
    };
  }
}

async function checkCodexSkill(): Promise<DoctorCheck> {
  const skillPath = codexSkillPath();
  try {
    const text = await readFile(skillPath, "utf8");
    const hasAgenticVaultSkill = text.includes("name: agentic-vault") && text.includes("Proactive Use");
    return {
      name: "codex-skill",
      status: hasAgenticVaultSkill ? "pass" : "fail",
      message: hasAgenticVaultSkill
        ? "Codex proactive skill is installed."
        : "Codex skill file exists but does not look like the Agentic Vault skill.",
      details: { skillPath }
    };
  } catch (error) {
    return {
      name: "codex-skill",
      status: "fail",
      message: `Codex skill could not be read: ${errorMessage(error)}`,
      details: { skillPath }
    };
  }
}

async function checkMcpCommand(config: CodexMcpConfig): Promise<DoctorCheck> {
  const commandPath = await resolveCommand(config.command);
  const status = commandPath ? "pass" : "fail";
  return {
    name: "mcp-command",
    status,
    message: status === "pass" ? "Configured MCP command is executable." : "Configured MCP command was not found.",
    details: { command: config.command, resolvedCommand: commandPath, args: config.args }
  };
}

function missingMcpCommandCheck(): DoctorCheck {
  return {
    name: "mcp-command",
    status: "fail",
    message: "MCP command cannot be checked because agentic-vault is missing from Codex config."
  };
}

async function checkMcpSmoke(config: CodexMcpConfig): Promise<DoctorCheck> {
  const client = new Client({ name: "agentic-vault-doctor", version: "0.1.0" });
  try {
    const result = await withTimeout(
      (async () => {
        const transport = new StdioClientTransport({
          command: config.command,
          args: config.args
        });
        await client.connect(transport);
        return client.callTool({ name: "vault_health_check", arguments: {} });
      })(),
      5000,
      "MCP smoke test timed out."
    );
    return {
      name: "mcp-smoke-test",
      status: "pass",
      message: "MCP server responded to vault_health_check.",
      details: { result }
    };
  } catch (error) {
    return {
      name: "mcp-smoke-test",
      status: "fail",
      message: `MCP smoke test failed: ${errorMessage(error)}`,
      details: { command: config.command, args: config.args }
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}

function parseAgenticVaultMcpConfig(config: string): CodexMcpConfig | undefined {
  const match = config.match(/(?:^|\n)\[mcp_servers\.agentic-vault\]\n([\s\S]*?)(?=\n\[[^\]]+\]|$)/);
  const body = match?.[1];
  if (!body) return undefined;

  const commandMatch = body.match(/^command\s*=\s*(".*")\s*$/m);
  const argsMatch = body.match(/^args\s*=\s*(\[.*\])\s*$/m);
  if (!commandMatch?.[1] || !argsMatch?.[1]) return undefined;

  try {
    const command = JSON.parse(commandMatch[1]) as unknown;
    const args = JSON.parse(argsMatch[1]) as unknown;
    if (typeof command !== "string" || !Array.isArray(args) || !args.every((arg) => typeof arg === "string")) {
      return undefined;
    }
    return { command, args };
  } catch (error) {
    return undefined;
  }
}

async function resolveCommand(command: string): Promise<string | undefined> {
  if (path.isAbsolute(command) || command.includes(path.sep)) {
    try {
      await access(command, fsConstants.X_OK);
      return command;
    } catch (error) {
      return undefined;
    }
  }

  if (command === "node") return process.execPath;

  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, command);
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch (error) {
      // Keep looking.
    }
  }

  return undefined;
}

function suggestedActionsFor(checks: DoctorCheck[], fixed: boolean): string[] {
  if (!checks.some((check) => check.status === "fail")) return [];
  if (fixed) return ["Review failing checks and rerun agentic-vault doctor after resolving them."];

  const actions = new Set<string>();
  const failedNames = new Set(checks.filter((check) => check.status === "fail").map((check) => check.name));

  if (failedNames.has("node-version")) actions.add("Install Node.js 20 or newer.");
  if (failedNames.has("vault-health")) actions.add("Run agentic-vault doctor --fix [vault-path] to initialize or repair the vault structure.");
  if (failedNames.has("codex-config") || failedNames.has("codex-skill") || failedNames.has("mcp-command")) {
    actions.add("Run agentic-vault doctor --fix [vault-path] to install Codex MCP config and the proactive skill.");
  }
  if (failedNames.has("mcp-smoke-test")) actions.add("Restart Codex after fixing MCP config, then rerun agentic-vault doctor.");

  return [...actions];
}

function expandHome(input: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

function codexConfigPath(): string {
  return path.join(os.homedir(), ".codex", "config.toml");
}

function codexSkillPath(): string {
  return path.join(os.homedir(), ".codex", "skills", "agentic-vault", "SKILL.md");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
