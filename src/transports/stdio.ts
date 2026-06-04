/**
 * Stdio transport — the default for local MCP clients (Claude Desktop, Claude Code, Cursor).
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer, SERVER_NAME, SERVER_VERSION } from "../server.js";

export async function runStdio(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
}
