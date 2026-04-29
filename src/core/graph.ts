import { extractObsidianLinks, parseFrontmatter, wikiTitleFromPath } from "./markdown.js";

export interface WikiPageRecord {
  path: string;
  title: string;
  links: string[];
  frontmatter: Record<string, unknown>;
}

export interface VaultGraph {
  pages: WikiPageRecord[];
  brokenLinks: Array<{ from: string; link: string }>;
  orphanPages: string[];
}

export function buildGraph(pages: Array<{ path: string; content: string }>): VaultGraph {
  const records = pages.map(({ path, content }) => {
    const parsed = parseFrontmatter(content);
    const title = typeof parsed.frontmatter.title === "string" ? parsed.frontmatter.title : wikiTitleFromPath(path);
    return {
      path,
      title,
      links: extractObsidianLinks(content),
      frontmatter: parsed.frontmatter
    };
  });

  const titleSet = new Set(records.map((page) => page.title));
  const stemSet = new Set(records.map((page) => wikiTitleFromPath(page.path)));
  const brokenLinks = records.flatMap((page) =>
    page.links
      .filter((link) => !titleSet.has(link) && !stemSet.has(link))
      .map((link) => ({ from: page.path, link }))
  );

  const linkedTitles = new Set(records.flatMap((page) => page.links));
  const orphanPages = records
    .filter((page) => !page.path.endsWith("index.md"))
    .filter((page) => !linkedTitles.has(page.title) && !linkedTitles.has(wikiTitleFromPath(page.path)))
    .map((page) => page.path)
    .sort((a, b) => a.localeCompare(b));

  return {
    pages: records.sort((a, b) => a.path.localeCompare(b.path)),
    brokenLinks,
    orphanPages
  };
}

export function findRelatedPages(query: string, pages: WikiPageRecord[], limit = 10): WikiPageRecord[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  return pages
    .map((page) => {
      const haystack = tokenize(`${page.title} ${page.path} ${page.links.join(" ")} ${JSON.stringify(page.frontmatter)}`);
      const score = tokens.reduce((total, token) => total + haystack.filter((word) => word.includes(token)).length, 0);
      return { page, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.page.path.localeCompare(b.page.path))
    .slice(0, limit)
    .map((entry) => entry.page);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u00C0-\u1EF9]+/u)
    .filter((token) => token.length >= 2);
}
