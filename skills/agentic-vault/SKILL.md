---
name: agentic-vault
description: Use when managing a local-first AI knowledge vault with raw/ source files, wiki/ markdown pages, Obsidian backlinks, and the Agentic Vault MCP server.
---

# Agentic Vault

Use this skill when the user wants an AI-managed local wiki that compounds over time.

## Workflow

1. Run `vault_scan` or `vault_health_check` first.
2. Treat `raw/` as read-only source material.
3. Read relevant raw sources and existing wiki pages before writing.
4. Prefer updating existing pages when they cover the same concept.
5. Create focused markdown pages under `wiki/` when a concept, comparison, question, project, or source deserves durable reuse.
6. Update `wiki/index.md` when the vault map changes.
7. Use `wiki_check_links` after meaningful writes.

## Page Format

Wiki pages should use YAML frontmatter:

```yaml
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
```

Use these body sections by default:

```markdown
# Page Title

## Summary

## Key Ideas

## Source Notes

## Related
```

## Safety

- Never write to `raw/`.
- Never invent source paths.
- Keep source-derived claims traceable to `raw/` paths.
- Save valuable answers back into `wiki/` when they are likely to be reused.
