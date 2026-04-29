import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initVault } from "../src/core/vault.js";

const clients: Client[] = [];

async function tempVault(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "agentic-vault-mcp-"));
}

describe("mcp stdio integration", () => {
  afterEach(async () => {
    await Promise.allSettled(clients.map((client) => client.close()));
    clients.length = 0;
  });

  it("calls read and write tools through the MCP protocol", async () => {
    const root = await tempVault();
    await initVault(root);
    await writeFile(path.join(root, "raw", "source.md"), "# Source\nUseful source.", "utf8");

    const client = new Client({ name: "agentic-vault-test-client", version: "0.1.0" });
    clients.push(client);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/cli/index.ts", "mcp", root]
    });

    await client.connect(transport);

    const rawList = await client.callTool({ name: "raw_list", arguments: {} });
    expect(textFromTool(rawList)).toContain("raw/source.md");

    const create = await client.callTool({
      name: "wiki_create",
      arguments: {
        path: "wiki/concepts/source.md",
        content: "---\ntitle: Source\n---\n# Source\n\n[[Missing]]"
      }
    });
    expect(textFromTool(create)).toContain("wiki/concepts/source.md");

    const links = await client.callTool({ name: "wiki_check_links", arguments: {} });
    expect(textFromTool(links)).toContain("Missing");

    const forbidden = await client.callTool({
      name: "wiki_create",
      arguments: { path: "raw/bad.md", content: "# Bad" }
    });
    expect((forbidden as { isError?: boolean }).isError).toBe(true);
    expect(textFromTool(forbidden)).toContain("wiki");
  });
});

function textFromTool(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  return content.map((item) => item.text ?? "").join("\n");
}
