---
name: agentic-vault
description: Use proactively when the user asks about saved knowledge, prior notes, source material, durable memory, wiki pages, Obsidian-style links, or anything that should be remembered for future reuse. Also use when managing a local-first AI knowledge vault with raw/ source files, wiki/ markdown pages, backlinks, and the Agentic Vault MCP server.
---

# Agentic Vault

Use this skill when the user wants an AI-managed local wiki that compounds over time.

## Proactive Use

Use the Agentic Vault MCP without waiting for an explicit tool request when:

- The user asks a question that may be answered from saved notes, prior research, or local source material.
- The user says to remember, save, capture, document, summarize for later, or build durable context.
- The user is working on a topic that could benefit from existing wiki pages or raw sources.
- The answer contains reusable project knowledge, decisions, explanations, comparisons, or operating procedures.
- The user asks for a review, synthesis, gap analysis, weekly review, or next actions for a knowledge/project space.

Default behavior:

1. Start with `vault_scan` or `vault_health_check` when vault context may matter.
2. Use `wiki_find_related` before answering if the topic may already exist in the vault.
3. Read relevant `wiki/` pages and `raw/` sources before making source-backed claims.
4. Offer to save lightweight notes only when the value is uncertain; save directly when the user clearly asks to remember or preserve the answer.

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
