# Agentic Vault

Agentic Vault is a local-first MCP server and CLI for AI-managed, Obsidian-compatible knowledge vaults.

It helps an AI agent turn source material in `raw/` into durable markdown pages in `wiki/`, with backlinks, an index, source paths, and health checks. The vault stays on your machine as plain files.

## Install

For users:

```bash
npx @locflamedia/agentic-vault init ./my-vault
```

Or install globally:

```bash
npm install -g @locflamedia/agentic-vault
agentic-vault codex-install ~/Documents/my-vault
agentic-vault doctor ~/Documents/my-vault
```

`codex-install` initializes the vault, registers the MCP server in Codex, and installs the proactive Agentic Vault skill. If you omit the path, it uses `~/Documents/my-vault`.
`doctor` verifies the vault, Codex config, proactive skill, MCP command, and an MCP smoke test.

For local development from the repository:

```bash
pnpm install
pnpm build
pnpm dev -- init ./my-vault
```

## CLI

```bash
agentic-vault init ./my-vault
agentic-vault scan ./my-vault
agentic-vault check ./my-vault
agentic-vault mcp ./my-vault
agentic-vault codex-install ~/Documents/my-vault
agentic-vault doctor ~/Documents/my-vault
agentic-vault doctor --fix ~/Documents/my-vault
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
      "command": "npx",
      "args": ["-y", "@locflamedia/agentic-vault", "mcp", "/absolute/path/to/my-vault"]
    }
  }
}
```

If installed globally, you can use:

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

During repository development, use the built output:

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

For Codex CLI:

```bash
codex mcp add agentic-vault -- npx -y @locflamedia/agentic-vault mcp /absolute/path/to/my-vault
```

If you cloned the repo locally:

```bash
codex mcp add agentic-vault -- node /absolute/path/to/agentic-vault/dist/cli/index.js mcp /absolute/path/to/my-vault
```

### Make Codex use the vault proactively

MCP tools are available to the model, but most clients only call them when the current instructions make the vault relevant. For proactive memory behavior in Codex, run:

```bash
agentic-vault codex-install ~/Documents/my-vault
```

This initializes the vault, writes the MCP entry to `~/.codex/config.toml`, and installs the bundled skill to `~/.codex/skills/agentic-vault/SKILL.md`. After restarting Codex, the skill nudges the agent to use `vault_scan`, `wiki_find_related`, and read/write wiki tools when the user asks about saved knowledge, prior notes, durable memory, source material, or reusable answers.

### Verify the install

Run:

```bash
agentic-vault doctor ~/Documents/my-vault
```

If setup is incomplete, run:

```bash
agentic-vault doctor --fix ~/Documents/my-vault
```

Restart Codex after `codex-install` or `doctor --fix` so the new MCP server and skill are loaded.

If `npm install` fails with `ENOTFOUND registry.npmjs.org`, npm cannot resolve the registry host. Check DNS, VPN, proxy, or network access, then retry:

```bash
npm view @modelcontextprotocol/sdk version
npm install -g @locflamedia/agentic-vault
```

## Update

If you installed from npm:

```bash
npm update -g @locflamedia/agentic-vault
```

If your MCP config uses `npx -y @locflamedia/agentic-vault`, restart your MCP client to pick up the latest published version.

If you cloned the repo:

```bash
cd /path/to/agentic-vault
git pull
pnpm install
pnpm build
```

## Vault Rules

- `raw/` is read-only source material.
- `wiki/` is AI-maintained markdown.
- `.agentic-vault/` stores manifest, graph, and write logs.
- Wiki pages use YAML frontmatter and Obsidian links like `[[Concept]]`.
- Valuable answers should be saved back into `wiki/` when they can compound.

## V1 Scope

V1 intentionally does not include a dashboard, vector database, browser clipper, OCR, sync, auth, or team mode.
