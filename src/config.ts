/**
 * Configuration loaded from environment variables.
 *
 * Fails fast with a bilingual error message if required values are missing.
 */

import { z } from "zod";
import { RakutenConfigError } from "./errors.js";

/** Canonical Rakuten API hosts. */
export const HOST_LEGACY = "https://app.rakuten.co.jp";
export const HOST_OPENAPI = "https://openapi.rakuten.co.jp";

/** Default transport when CLI flag is absent. */
export type Transport = "stdio" | "http";

export interface Config {
  applicationId: string;
  accessKey: string;
  /** Optional — when set, every tool that supports affiliate IDs appends it. */
  affiliateId?: string;
  /** Manual host override. Empty string disables override (default). */
  hostOverride?: string;
  transport: Transport;
  httpPort: number;
  httpHost: string;
  httpAuthToken?: string;
  /** Comma-separated Origin allowlist for HTTP transport. Empty array = no cross-origin. */
  httpAllowedOrigins: string[];
  /** Max retries on 429/5xx. Default 3. */
  maxRetries: number;
}

const EnvSchema = z.object({
  RAKUTEN_APP_ID: z.string().min(1).optional(),
  RAKUTEN_ACCESS_KEY: z.string().min(1).optional(),
  RAKUTEN_AFFILIATE_ID: z.string().min(1).optional(),
  RAKUTEN_API_HOST_OVERRIDE: z.string().url().optional(),
  MCP_TRANSPORT: z.enum(["stdio", "http"]).default("stdio"),
  MCP_HTTP_PORT: z.coerce.number().int().positive().default(3000),
  MCP_HTTP_HOST: z.string().default("127.0.0.1"),
  MCP_HTTP_AUTH_TOKEN: z.string().optional(),
  /** Comma-separated origins. Empty default = no cross-origin requests allowed. */
  MCP_HTTP_ALLOWED_ORIGINS: z.string().default(""),
  RAKUTEN_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
});

export function loadConfig(): Config {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  const env = parsed.data;

  if (!env.RAKUTEN_APP_ID || !env.RAKUTEN_ACCESS_KEY) {
    throw new RakutenConfigError();
  }

  const httpAllowedOrigins = env.MCP_HTTP_ALLOWED_ORIGINS
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    applicationId: env.RAKUTEN_APP_ID,
    accessKey: env.RAKUTEN_ACCESS_KEY,
    affiliateId: env.RAKUTEN_AFFILIATE_ID,
    hostOverride: env.RAKUTEN_API_HOST_OVERRIDE,
    transport: env.MCP_TRANSPORT,
    httpPort: env.MCP_HTTP_PORT,
    httpHost: env.MCP_HTTP_HOST,
    httpAuthToken: env.MCP_HTTP_AUTH_TOKEN,
    httpAllowedOrigins,
    maxRetries: env.RAKUTEN_MAX_RETRIES,
  };
}

/**
 * Returns true if a bind host is publicly reachable (i.e. NOT localhost).
 *
 * Localhost set includes: "127.0.0.1", "::1", "localhost", "0.0.0.0" treated as PUBLIC
 * (because 0.0.0.0 binds to ALL interfaces).
 */
export function isPubliclyBound(host: string): boolean {
  const lower = host.trim().toLowerCase();
  return lower !== "127.0.0.1" && lower !== "::1" && lower !== "localhost";
}

/**
 * Lazy config — used by tools that may run before any auth is needed
 * (e.g. resource read), and by the startup banner.
 */
export function tryLoadConfig(): Config | null {
  try {
    return loadConfig();
  } catch {
    return null;
  }
}

/**
 * Parse CLI args into a partial transport override.
 * Supports: --http [port], --stdio
 */
export function parseCliTransport(argv: string[]): Partial<{ transport: Transport; httpPort: number }> {
  const out: Partial<{ transport: Transport; httpPort: number }> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--stdio") {
      out.transport = "stdio";
    } else if (arg === "--http") {
      out.transport = "http";
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        const port = Number(next);
        if (!Number.isNaN(port)) out.httpPort = port;
        i++;
      }
    }
  }
  return out;
}
