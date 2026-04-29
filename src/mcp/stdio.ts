import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAgenticVaultServer } from "./server.js";

export async function startMcpServer(vaultRoot: string): Promise<void> {
  const server = createAgenticVaultServer(vaultRoot);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
