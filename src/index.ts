#!/usr/bin/env node

/**
 * rakuten-mcp entry point.
 *
 * Reads transport from CLI flag (--http [port] / --stdio) or MCP_TRANSPORT env,
 * defaults to stdio, then dispatches to the appropriate transport runner.
 */

import { loadConfig, parseCliTransport, tryLoadConfig } from "./config.js";
import { runHttp } from "./transports/http.js";
import { runStdio } from "./transports/stdio.js";

async function main(): Promise<void> {
  const cliOverride = parseCliTransport(process.argv.slice(2));
  // Try config but tolerate missing creds — let stdio boot and surface the error
  // through tool calls. Useful for inspectors / `npx rakuten-mcp --help`.
  const config = tryLoadConfig();

  const transport = cliOverride.transport ?? config?.transport ?? "stdio";

  if (transport === "http") {
    // HTTP requires config (auth token, port). loadConfig throws if creds missing.
    const httpConfig = loadConfig();
    if (cliOverride.httpPort !== undefined) {
      httpConfig.httpPort = cliOverride.httpPort;
    }
    await runHttp(httpConfig);
    return;
  }

  await runStdio();
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Fatal error: ${message}`);
  process.exit(1);
});
