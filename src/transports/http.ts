/**
 * Streamable HTTP transport — opt-in via --http flag or MCP_TRANSPORT=http.
 *
 * Full implementation lands in Week 2 of the v1.0 build. This stub keeps the
 * import surface stable and refuses to run with a clear error pointing the user
 * at stdio for now.
 */

import { buildServer, SERVER_NAME, SERVER_VERSION } from "../server.js";
import type { Config } from "../config.js";

export async function runHttp(_config: Config): Promise<void> {
  // Touch the builder so it stays imported during the alpha
  void buildServer;
  void SERVER_NAME;
  void SERVER_VERSION;
  console.error(
    `HTTP transport is not yet implemented in this alpha. Use stdio (the default) for now.\n` +
      `Tracking: see PLAN-v1.0.md, Week 2 Day 4.`,
  );
  process.exit(2);
}
