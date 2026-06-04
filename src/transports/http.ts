/**
 * Streamable HTTP transport.
 *
 * Wraps `@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport` in a
 * Node.js HTTP server with a security gate in front:
 *
 *   1. **Host header validation** — DNS rebinding protection. Allowed hosts
 *      are the configured bind host plus localhost variants.
 *   2. **Origin header validation** — only if Origin is present (browsers send
 *      it; curl/non-browser clients don't). Empty Origin is allowed.
 *      Configured via `MCP_HTTP_ALLOWED_ORIGINS` (comma-separated).
 *   3. **Bearer token auth** — if `MCP_HTTP_AUTH_TOKEN` is set, every request
 *      must carry `Authorization: Bearer <token>`. If unset AND the bind is
 *      not localhost, the server refuses to start.
 *
 * Stateless mode: one transport per request (simpler, no session state).
 * Multi-client safe because each request gets its own transport instance.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isPubliclyBound, type Config } from "../config.js";
import { buildServer, SERVER_NAME, SERVER_VERSION } from "../server.js";

export interface GateResult {
  ok: boolean;
  status?: number;
  reason?: string;
}

/**
 * Validate an incoming request against the security gate.
 * Returns ok=true to allow, or ok=false with status + reason to reject.
 *
 * Pure function — accepts only the minimum needed from req so it's trivial
 * to unit-test without mocking IncomingMessage.
 */
export function gateRequest(
  headers: {
    host?: string;
    origin?: string;
    authorization?: string;
  },
  config: {
    httpHost: string;
    httpAuthToken?: string;
    httpAllowedOrigins: string[];
  },
): GateResult {
  // 1. Host header validation
  const host = headers.host?.split(":")[0]?.toLowerCase() ?? "";
  const allowedHosts = new Set([
    config.httpHost.toLowerCase(),
    "127.0.0.1",
    "localhost",
    "[::1]",
    "::1",
  ]);
  if (host && !allowedHosts.has(host)) {
    return { ok: false, status: 403, reason: `Host '${host}' not allowed` };
  }

  // 2. Origin validation — only enforced if Origin is present
  if (headers.origin) {
    const lowerOrigin = headers.origin.toLowerCase();
    const allowedOrigins = config.httpAllowedOrigins.map((o) => o.toLowerCase());
    // Localhost origins are always allowed (browsers + dev tools)
    const isLocalhost = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(lowerOrigin);
    if (!isLocalhost && !allowedOrigins.includes(lowerOrigin)) {
      return { ok: false, status: 403, reason: `Origin '${headers.origin}' not allowed` };
    }
  }

  // 3. Bearer auth
  if (config.httpAuthToken) {
    const header = headers.authorization ?? "";
    if (!header.startsWith("Bearer ")) {
      return { ok: false, status: 401, reason: "Missing Bearer token" };
    }
    const presented = header.slice("Bearer ".length).trim();
    if (presented !== config.httpAuthToken) {
      return { ok: false, status: 401, reason: "Invalid Bearer token" };
    }
  }

  return { ok: true };
}

/**
 * Read the request body as a string, then parse as JSON (or null for empty).
 */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk as Uint8Array));
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw.length === 0) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Run the HTTP transport.
 *
 * Refuses to start if bound to a publicly reachable interface without
 * `MCP_HTTP_AUTH_TOKEN` set — preventing accidental open exposure.
 */
export async function runHttp(config: Config): Promise<void> {
  // Safety gate: refuse public bind without auth token
  if (isPubliclyBound(config.httpHost) && !config.httpAuthToken) {
    console.error(
      `Refusing to bind to ${config.httpHost} without MCP_HTTP_AUTH_TOKEN set.\n` +
        `Either bind to 127.0.0.1 (the default), or set MCP_HTTP_AUTH_TOKEN to require authentication.`,
    );
    process.exit(2);
  }

  const httpServer: Server = createServer(async (req, res) => {
    const headers = {
      host: typeof req.headers.host === "string" ? req.headers.host : undefined,
      origin: typeof req.headers.origin === "string" ? req.headers.origin : undefined,
      authorization:
        typeof req.headers.authorization === "string" ? req.headers.authorization : undefined,
    };

    const gate = gateRequest(headers, {
      httpHost: config.httpHost,
      httpAuthToken: config.httpAuthToken,
      httpAllowedOrigins: config.httpAllowedOrigins,
    });

    if (!gate.ok) {
      respondJson(res, gate.status ?? 403, {
        error: gate.reason ?? "Forbidden",
      });
      return;
    }

    // Pre-parse the body so the transport can use it (avoids double-reading)
    const body = await readJsonBody(req);

    // Stateless transport — one per request, no shared session state
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const mcpServer = buildServer();

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // If headers already sent, log and bail. Otherwise emit a clean error response.
      if (!res.headersSent) {
        respondJson(res, 500, { error: `Internal server error: ${message}` });
      } else {
        console.error(`HTTP transport error after response started: ${message}`);
      }
    } finally {
      // Close the per-request transport to release resources
      try {
        await transport.close();
      } catch {
        // best-effort
      }
    }
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(config.httpPort, config.httpHost, () => {
      console.error(
        `${SERVER_NAME} v${SERVER_VERSION} running on http://${config.httpHost}:${config.httpPort}`,
      );
      if (!config.httpAuthToken) {
        console.error(
          `Warning: no MCP_HTTP_AUTH_TOKEN set. Server is only safe on localhost binding.`,
        );
      }
      resolve();
    });
  });

  // Graceful shutdown
  const shutdown = () => {
    console.error("Shutting down HTTP server...");
    httpServer.close(() => {
      process.exit(0);
    });
    // Force-close after 5s if anything hangs
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  // Block forever (server keeps event loop alive)
}

function respondJson(res: ServerResponse, status: number, payload: unknown): void {
  if (res.headersSent) return;
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
}
