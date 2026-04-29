export const RAW_DIR = "raw";
export const WIKI_DIR = "wiki";
export const STATE_DIR = ".agentic-vault";
export const LOG_DIR = `${STATE_DIR}/logs`;
export const MANIFEST_PATH = `${STATE_DIR}/manifest.json`;
export const GRAPH_PATH = `${STATE_DIR}/graph.json`;
export const INDEX_PATH = `${WIKI_DIR}/index.md`;

export const TEXT_FILE_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".mdx",
  ".txt",
  ".text",
  ".csv",
  ".tsv",
  ".json",
  ".yaml",
  ".yml",
  ".log"
]);
