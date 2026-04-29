import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildGraph } from "../src/core/graph.js";
import { extractObsidianLinks, parseFrontmatter, stringifyMarkdown } from "../src/core/markdown.js";
import {
  initVault,
  readRawSource,
  scanVault,
  saveAnswerAsPage,
  writeManifestAndGraph,
  writeWikiPage
} from "../src/core/vault.js";

async function tempVault(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "agentic-vault-test-"));
}

describe("markdown helpers", () => {
  it("round-trips simple frontmatter and extracts Obsidian links", () => {
    const markdown = stringifyMarkdown(
      {
        title: "Recovery",
        type: "concept",
        sources: ["raw/source.md"],
        related: ["[[Training Volume]]"]
      },
      "# Recovery\n\nSee [[Training Volume]] and [[Sleep|sleep]]."
    );

    const parsed = parseFrontmatter(markdown);
    expect(parsed.frontmatter.title).toBe("Recovery");
    expect(parsed.frontmatter.sources).toEqual(["raw/source.md"]);
    expect(extractObsidianLinks(markdown)).toEqual(["Sleep", "Training Volume"]);
  });
});

describe("vault core", () => {
  it("initializes the expected local-first vault structure", async () => {
    const root = await tempVault();
    const result = await initVault(root);
    const scan = await scanVault(root);

    expect(result.created).toContain("raw");
    expect(result.created).toContain("wiki/index.md");
    expect(scan.hasIndex).toBe(true);
    expect(scan.structuralErrors).toEqual([]);
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain("raw/` contains source material");
  });

  it("rejects path traversal and writes outside wiki/", async () => {
    const root = await tempVault();
    await initVault(root);

    await expect(readRawSource(root, "../secret.txt")).rejects.toThrow(/traversal|outside|Absolute/i);
    await expect(writeWikiPage(root, "raw/changed.md", "# Bad")).rejects.toThrow(/wiki/i);
    await expect(writeWikiPage(root, "/tmp/changed.md", "# Bad")).rejects.toThrow(/Absolute/i);
  });

  it("rejects symlink escapes for existing raw reads", async () => {
    const root = await tempVault();
    const outside = await mkdtemp(path.join(os.tmpdir(), "agentic-vault-outside-"));
    await initVault(root);
    await writeFile(path.join(outside, "secret.txt"), "secret", "utf8");
    await symlink(path.join(outside, "secret.txt"), path.join(root, "raw", "secret-link.txt"));

    await expect(readRawSource(root, "raw/secret-link.txt")).rejects.toThrow(/outside|symlink/i);
  });

  it("builds graph diagnostics for broken links and orphans", async () => {
    const graph = buildGraph([
      {
        path: "wiki/index.md",
        content: "---\ntitle: Index\n---\n# Index\n[[Recovery]] [[Missing]]"
      },
      {
        path: "wiki/recovery.md",
        content: "---\ntitle: Recovery\n---\n# Recovery"
      },
      {
        path: "wiki/orphan.md",
        content: "---\ntitle: Orphan\n---\n# Orphan"
      }
    ]);

    expect(graph.brokenLinks).toEqual([{ from: "wiki/index.md", link: "Missing" }]);
    expect(graph.orphanPages).toEqual(["wiki/orphan.md"]);
  });

  it("updates manifest and graph files from the sample vault", async () => {
    const root = await tempVault();
    await initVault(root);
    await writeFile(path.join(root, "raw", "source.md"), "# Source\n", "utf8");
    await writeWikiPage(root, "wiki/concepts/recovery.md", "---\ntitle: Recovery\n---\n# Recovery\n", {
      overwrite: false
    });
    await writeManifestAndGraph(root);

    const manifest = JSON.parse(await readFile(path.join(root, ".agentic-vault", "manifest.json"), "utf8"));
    const graph = JSON.parse(await readFile(path.join(root, ".agentic-vault", "graph.json"), "utf8"));
    expect(manifest.rawCount).toBe(1);
    expect(graph.pages.some((page: { path: string }) => page.path === "wiki/concepts/recovery.md")).toBe(true);
  });

  it("saves durable answers under wiki/questions without overwriting", async () => {
    const root = await tempVault();
    await initVault(root);

    const result = await saveAnswerAsPage(root, "What is progressive overload?", "Increase stress gradually.", [
      "raw/training.md"
    ]);

    expect(result.path).toBe("wiki/questions/what-is-progressive-overload.md");
    await expect(saveAnswerAsPage(root, "What is progressive overload?", "Duplicate")).rejects.toThrow(/overwrite/i);
  });
});
