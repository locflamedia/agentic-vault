import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  initVault,
  readRawSource,
  readVaultText,
  readWikiPage,
  relatedWikiPages,
  saveAnswerAsPage,
  scanVault,
  vaultHealth,
  writeManifestAndGraph,
  writeWikiPage
} from "../core/vault.js";
import { GRAPH_PATH, INDEX_PATH, MANIFEST_PATH, RAW_DIR, WIKI_DIR } from "../core/constants.js";
import { errorMessage } from "../core/errors.js";

export function createAgenticVaultServer(vaultRoot: string): McpServer {
  const server = new McpServer(
    {
      name: "agentic-vault",
      version: "0.1.2"
    },
    {
      instructions:
        "Use this server to manage a local-first knowledge vault. raw/ is read-only source material. wiki/ is AI-maintained markdown. Prefer durable wiki pages with source paths and Obsidian backlinks."
    }
  );

  registerTools(server, vaultRoot);
  registerResources(server, vaultRoot);
  registerPrompts(server);

  return server;
}

function registerTools(server: McpServer, vaultRoot: string): void {
  server.registerTool(
    "vault_scan",
    {
      title: "Scan Vault",
      description: "Read-only. Summarize raw files, wiki files, index status, broken links, and orphan pages.",
      inputSchema: {}
    },
    async () => textResult(await scanVault(vaultRoot))
  );

  server.registerTool(
    "raw_list",
    {
      title: "List Raw Sources",
      description: "Read-only. List text-readable source files under raw/.",
      inputSchema: {}
    },
    async () => {
      const scan = await scanVault(vaultRoot);
      return textResult({ rawFiles: scan.rawFiles });
    }
  );

  server.registerTool(
    "raw_read",
    {
      title: "Read Raw Source",
      description: "Read-only. Read one source file under raw/ by vault-relative path.",
      inputSchema: { path: z.string().describe("Vault-relative path under raw/.") }
    },
    async ({ path }) => textResult({ path, content: await readRawSource(vaultRoot, path) })
  );

  server.registerTool(
    "wiki_read",
    {
      title: "Read Wiki Page",
      description: "Read-only. Read one markdown page under wiki/ by vault-relative path.",
      inputSchema: { path: z.string().describe("Vault-relative path under wiki/.") }
    },
    async ({ path }) => textResult({ path, content: await readWikiPage(vaultRoot, path) })
  );

  server.registerTool(
    "wiki_create",
    {
      title: "Create Wiki Page",
      description: "Write. Create a new markdown page under wiki/. Refuses to overwrite existing files.",
      inputSchema: {
        path: z.string().describe("Vault-relative target path under wiki/. .md is added if omitted."),
        content: z.string().describe("Complete markdown page content.")
      }
    },
    async ({ path, content }) => {
      const result = await writeWikiPage(vaultRoot, path, content, { overwrite: false, action: "wiki_create" });
      await writeManifestAndGraph(vaultRoot);
      return textResult(result);
    }
  );

  server.registerTool(
    "wiki_update",
    {
      title: "Update Wiki Page",
      description: "Write. Replace an existing or new markdown page under wiki/.",
      inputSchema: {
        path: z.string().describe("Vault-relative target path under wiki/. .md is added if omitted."),
        content: z.string().describe("Complete replacement markdown page content.")
      }
    },
    async ({ path, content }) => {
      const result = await writeWikiPage(vaultRoot, path, content, { overwrite: true, action: "wiki_update" });
      await writeManifestAndGraph(vaultRoot);
      return textResult(result);
    }
  );

  server.registerTool(
    "wiki_update_index",
    {
      title: "Update Wiki Index",
      description: "Write. Replace wiki/index.md with a complete updated index page.",
      inputSchema: { content: z.string().describe("Complete replacement content for wiki/index.md.") }
    },
    async ({ content }) => {
      const result = await writeWikiPage(vaultRoot, INDEX_PATH, content, { overwrite: true, action: "wiki_update_index" });
      await writeManifestAndGraph(vaultRoot);
      return textResult(result);
    }
  );

  server.registerTool(
    "wiki_find_related",
    {
      title: "Find Related Wiki Pages",
      description: "Read-only. Find likely related wiki pages using simple title/link/frontmatter matching.",
      inputSchema: {
        query: z.string().describe("Topic, title, question, or keywords to match."),
        limit: z.number().int().positive().max(50).optional().describe("Maximum pages to return.")
      }
    },
    async ({ query, limit }) => textResult({ pages: await relatedWikiPages(vaultRoot, query, limit) })
  );

  server.registerTool(
    "wiki_check_links",
    {
      title: "Check Wiki Links",
      description: "Read-only. Detect broken Obsidian links and orphan wiki pages.",
      inputSchema: {}
    },
    async () => {
      const scan = await scanVault(vaultRoot);
      return textResult({ brokenLinks: scan.graph.brokenLinks, orphanPages: scan.graph.orphanPages });
    }
  );

  server.registerTool(
    "vault_health_check",
    {
      title: "Vault Health Check",
      description: "Read-only. Return consolidated vault structure, link, and count diagnostics.",
      inputSchema: {}
    },
    async () => textResult(await vaultHealth(vaultRoot))
  );

  server.registerTool(
    "answer_save_as_page",
    {
      title: "Save Answer as Wiki Page",
      description: "Write. Save a valuable AI answer into wiki/questions/ as a durable markdown page.",
      inputSchema: {
        title: z.string().describe("Human-readable page title."),
        content: z.string().describe("Answer content to preserve."),
        sources: z.array(z.string()).optional().describe("Optional raw/ source paths supporting the answer.")
      }
    },
    async ({ title, content, sources }) => {
      const result = await saveAnswerAsPage(vaultRoot, title, content, sources ?? []);
      await writeManifestAndGraph(vaultRoot);
      return textResult(result);
    }
  );

  server.registerTool(
    "vault_init",
    {
      title: "Initialize Vault",
      description: "Write. Initialize the configured vault root with raw/, wiki/, state, and instruction templates.",
      inputSchema: {}
    },
    async () => textResult(await initVault(vaultRoot))
  );
}

function registerResources(server: McpServer, vaultRoot: string): void {
  server.registerResource(
    "vault-index",
    "vault://index",
    {
      title: "Vault Index",
      description: "Current wiki/index.md content.",
      mimeType: "text/markdown"
    },
    async (uri) => resourceText(uri.href, await readVaultText(vaultRoot, INDEX_PATH))
  );

  server.registerResource(
    "vault-manifest",
    "vault://manifest",
    {
      title: "Vault Manifest",
      description: "Machine-readable vault manifest.",
      mimeType: "application/json"
    },
    async (uri) => resourceText(uri.href, await readOrEmpty(vaultRoot, MANIFEST_PATH, "{}"))
  );

  server.registerResource(
    "vault-graph",
    "vault://graph",
    {
      title: "Vault Graph",
      description: "Machine-readable wiki graph.",
      mimeType: "application/json"
    },
    async (uri) => resourceText(uri.href, await readOrEmpty(vaultRoot, GRAPH_PATH, "{}"))
  );

  server.registerResource(
    "vault-health",
    "vault://health",
    {
      title: "Vault Health",
      description: "Current vault health report.",
      mimeType: "application/json"
    },
    async (uri) => resourceText(uri.href, JSON.stringify(await vaultHealth(vaultRoot), null, 2))
  );

  server.registerResource(
    "wiki-page",
    new ResourceTemplate("vault://wiki/{path}", {
      list: async () => {
        const scan = await scanVault(vaultRoot);
        return {
          resources: scan.wikiFiles.map((file) => ({
            uri: `vault://wiki/${encodeURIComponent(file.slice(`${WIKI_DIR}/`.length))}`,
            name: file,
            mimeType: "text/markdown"
          }))
        };
      }
    }),
    {
      title: "Wiki Page",
      description: "A markdown page under wiki/. Path must be URI-encoded.",
      mimeType: "text/markdown"
    },
    async (uri, { path }) => {
      const decoded = decodeURIComponent(String(path));
      return resourceText(uri.href, await readWikiPage(vaultRoot, `${WIKI_DIR}/${decoded}`));
    }
  );

  server.registerResource(
    "raw-source",
    new ResourceTemplate("vault://raw/{path}", {
      list: async () => {
        const scan = await scanVault(vaultRoot);
        return {
          resources: scan.rawFiles.map((file) => ({
            uri: `vault://raw/${encodeURIComponent(file.slice(`${RAW_DIR}/`.length))}`,
            name: file,
            mimeType: "text/plain"
          }))
        };
      }
    }),
    {
      title: "Raw Source",
      description: "A read-only source file under raw/. Path must be URI-encoded.",
      mimeType: "text/plain"
    },
    async (uri, { path }) => {
      const decoded = decodeURIComponent(String(path));
      return resourceText(uri.href, await readRawSource(vaultRoot, `${RAW_DIR}/${decoded}`));
    }
  );
}

function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "ingest-raw-source",
    {
      title: "Ingest Raw Source",
      description: "Turn one raw source into durable wiki material and update the vault index.",
      argsSchema: { path: z.string().describe("Vault-relative raw/ source path.") }
    },
    ({ path }) => prompt(`Read ${path} with raw_read. Create or update durable pages under wiki/. Cite ${path} in frontmatter sources and Source Notes. Update wiki/index.md when the new material changes the map.`)
  );

  server.registerPrompt(
    "build-topic-wiki",
    {
      title: "Build Topic Wiki",
      description: "Synthesize a topic page from related raw and wiki material.",
      argsSchema: { topic: z.string().describe("Topic to synthesize.") }
    },
    ({ topic }) => prompt(`Build a durable wiki page for "${topic}". Use vault_scan and wiki_find_related first, inspect relevant raw/wiki resources, then create or update one focused wiki page with backlinks and source paths.`)
  );

  server.registerPrompt(
    "compare-sources",
    {
      title: "Compare Sources",
      description: "Create a comparison page for two or more sources or pages.",
      argsSchema: { subject: z.string().describe("Sources/pages/topic to compare.") }
    },
    ({ subject }) => prompt(`Compare ${subject}. Inspect relevant sources, write a comparison page under wiki/comparisons/, include agreements, disagreements, tradeoffs, and source paths, then update wiki/index.md if useful.`)
  );

  server.registerPrompt(
    "find-knowledge-gaps",
    {
      title: "Find Knowledge Gaps",
      description: "Inspect the vault and identify missing pages, weak links, and open questions.",
      argsSchema: { focus: z.string().optional().describe("Optional topic focus.") }
    },
    ({ focus }) => prompt(`Run vault_health_check and wiki_find_related for ${focus ?? "the main vault themes"}. Identify missing concepts, weakly supported claims, orphan pages, and useful next raw sources. Save durable findings if they are useful.`)
  );

  server.registerPrompt(
    "weekly-review",
    {
      title: "Weekly Vault Review",
      description: "Review vault health and suggest the next maintenance actions.",
      argsSchema: {}
    },
    () => prompt("Run vault_health_check. Summarize new raw/wiki state, broken links, orphan pages, and the top next actions. Update wiki/index.md if the vault map is stale.")
  );

  server.registerPrompt(
    "save-answer-to-wiki",
    {
      title: "Save Answer to Wiki",
      description: "Convert the current valuable answer into a durable wiki/questions page.",
      argsSchema: {
        title: z.string().describe("Suggested durable page title."),
        summary: z.string().describe("Short description of the answer to preserve.")
      }
    },
    ({ title, summary }) => prompt(`Save the current answer as "${title}" using answer_save_as_page. Preserve the core insight, add backlinks where natural, and include source paths when available. Context: ${summary}`)
  );
}

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2)
      }
    ]
  };
}

function resourceText(uri: string, text: string) {
  return {
    contents: [
      {
        uri,
        text
      }
    ]
  };
}

function prompt(text: string) {
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text
        }
      }
    ]
  };
}

async function readOrEmpty(vaultRoot: string, path: string, fallback: string): Promise<string> {
  try {
    return await readVaultText(vaultRoot, path);
  } catch (error) {
    return JSON.stringify({ fallback, error: errorMessage(error) }, null, 2);
  }
}
