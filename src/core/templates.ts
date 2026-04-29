export const DEFAULT_INDEX = `---
title: "Vault Index"
type: index
status: evergreen
sources: []
related: []
---

# Vault Index

## Map

- [[Questions]]

## Recently Added

## Open Questions
`;

export const DEFAULT_QUESTIONS = `---
title: "Questions"
type: index
status: evergreen
sources: []
related:
  - "[[Vault Index]]"
---

# Questions

Durable answers saved from AI conversations live here and in \`wiki/questions/\`.
`;

export const DEFAULT_AGENTS = `# Agentic Vault Instructions

You are managing a local-first knowledge vault.

## Structure

- \`raw/\` contains source material. Treat it as read-only.
- \`wiki/\` contains AI-maintained markdown pages.
- \`wiki/index.md\` is the map of the vault.
- \`.agentic-vault/\` contains machine state, logs, and graph files.

## Rules

- Do not edit files in \`raw/\`.
- Prefer updating an existing wiki page over creating a duplicate.
- Create new pages when a concept, comparison, question, person, project, or source deserves durable reuse.
- Use YAML frontmatter with \`title\`, \`type\`, \`status\`, \`sources\`, \`related\`, \`created\`, and \`updated\`.
- Use Obsidian links like \`[[Concept Name]]\`.
- Cite source paths from \`raw/\` when wiki content is derived from source material.
- If an answer is valuable for future reuse, save it back into \`wiki/\`.
`;

export const DEFAULT_CLAUDE = DEFAULT_AGENTS.replace("Agentic Vault Instructions", "Claude Vault Instructions");

export function defaultWikiPage(title: string, type = "concept", sources: string[] = []): string {
  const now = new Date().toISOString().slice(0, 10);
  const sourceLines = sources.length > 0 ? `\n${sources.map((source) => `  - ${source}`).join("\n")}` : " []";
  return `---
title: "${title}"
type: ${type}
status: draft
sources:${sourceLines}
related: []
created: ${now}
updated: ${now}
---

# ${title}

## Summary

## Key Ideas

## Source Notes

## Related
`;
}
