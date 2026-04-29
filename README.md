# Agentic Vault

Agentic Vault is a local-first MCP server and CLI for AI-managed, Obsidian-compatible knowledge vaults.

It helps an AI agent turn source material in `raw/` into durable markdown pages in `wiki/`, with backlinks, an index, source paths, and health checks. The vault stays on your machine as plain files.

## Install

```bash
pnpm install
pnpm build
```

For local development:

```bash
pnpm dev -- init ./my-vault
```

After publishing, the intended install shape is:

```bash
npx agentic-vault init ./my-vault
```

## CLI

```bash
agentic-vault init ./my-vault
agentic-vault scan ./my-vault
agentic-vault check ./my-vault
agentic-vault mcp ./my-vault
```

`init` creates:

```text
raw/
wiki/
  index.md
  questions/
.agentic-vault/
AGENTS.md
CLAUDE.md
```

## MCP

Configure your MCP client to start the server with:

```json
{
  "mcpServers": {
    "agentic-vault": {
      "command": "agentic-vault",
      "args": ["mcp", "/absolute/path/to/my-vault"]
    }
  }
}
```

During development, use the built output:

```json
{
  "mcpServers": {
    "agentic-vault": {
      "command": "node",
      "args": ["/absolute/path/to/agentic-vault/dist/cli/index.js", "mcp", "/absolute/path/to/my-vault"]
    }
  }
}
```

## Vault Rules

- `raw/` is read-only source material.
- `wiki/` is AI-maintained markdown.
- `.agentic-vault/` stores manifest, graph, and write logs.
- Wiki pages use YAML frontmatter and Obsidian links like `[[Concept]]`.
- Valuable answers should be saved back into `wiki/` when they can compound.

## V1 Scope

V1 intentionally does not include a dashboard, vector database, browser clipper, OCR, sync, auth, or team mode.
