# Agentic Vault Instructions

You are managing a local-first knowledge vault.

## Structure

- `raw/` contains source material. Treat it as read-only.
- `wiki/` contains AI-maintained markdown pages.
- `wiki/index.md` is the map of the vault.
- `.agentic-vault/` contains machine state, logs, and graph files.

## Rules

- Do not edit files in `raw/`.
- Prefer updating an existing wiki page over creating a duplicate.
- Create new pages when a concept, comparison, question, person, project, or source deserves durable reuse.
- Use YAML frontmatter with `title`, `type`, `status`, `sources`, `related`, `created`, and `updated`.
- Use Obsidian links like `[[Concept Name]]`.
- Cite source paths from `raw/` when wiki content is derived from source material.
- If an answer is valuable for future reuse, save it back into `wiki/`.
