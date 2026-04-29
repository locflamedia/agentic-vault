export type Frontmatter = Record<string, unknown>;

export interface ParsedMarkdown {
  frontmatter: Frontmatter;
  body: string;
}

const OBSIDIAN_LINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;

export function parseFrontmatter(markdown: string): ParsedMarkdown {
  if (!markdown.startsWith("---\n")) {
    return { frontmatter: {}, body: markdown };
  }

  const close = markdown.indexOf("\n---\n", 4);
  if (close === -1) {
    return { frontmatter: {}, body: markdown };
  }

  const yaml = markdown.slice(4, close);
  const body = markdown.slice(close + 5);
  return { frontmatter: parseSimpleYaml(yaml), body };
}

export function stringifyMarkdown(frontmatter: Frontmatter, body: string): string {
  const yaml = stringifySimpleYaml(frontmatter);
  const cleanBody = body.startsWith("\n") ? body.slice(1) : body;
  return `---\n${yaml}---\n\n${cleanBody.trimEnd()}\n`;
}

export function extractObsidianLinks(markdown: string): string[] {
  const links = new Set<string>();
  for (const match of markdown.matchAll(OBSIDIAN_LINK_RE)) {
    const value = match[1]?.trim();
    if (value) links.add(value);
  }
  return [...links].sort((a, b) => a.localeCompare(b));
}

export function slugifyTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

export function ensureMarkdownExtension(relativePath: string): string {
  return relativePath.toLowerCase().endsWith(".md") ? relativePath : `${relativePath}.md`;
}

export function wikiTitleFromPath(relativePath: string): string {
  const file = relativePath.split("/").pop() ?? relativePath;
  return file.replace(/\.md$/i, "");
}

function parseSimpleYaml(yaml: string): Frontmatter {
  const result: Frontmatter = {};
  let activeKey: string | null = null;

  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && activeKey) {
      const existing = result[activeKey];
      const values = Array.isArray(existing) ? existing : [];
      values.push(parseYamlScalar(listMatch[1] ?? ""));
      result[activeKey] = values;
      continue;
    }

    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!keyMatch) continue;

    activeKey = keyMatch[1] ?? null;
    const value = keyMatch[2] ?? "";
    if (!activeKey) continue;
    result[activeKey] = value === "" ? [] : parseYamlScalar(value);
  }

  return result;
}

function stringifySimpleYaml(frontmatter: Frontmatter): string {
  return Object.entries(frontmatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length === 0) return `${key}: []\n`;
        return `${key}:\n${value.map((item) => `  - ${formatYamlScalar(item)}`).join("\n")}\n`;
      }
      return `${key}: ${formatYamlScalar(value)}\n`;
    })
    .join("");
}

function parseYamlScalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "[]") return [];
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function formatYamlScalar(value: unknown): string {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const text = String(value ?? "");
  if (!text || /[:#\[\]{},"'\n]/.test(text) || text.trim() !== text) {
    return JSON.stringify(text);
  }
  return text;
}
