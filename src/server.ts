/**
 * MCP server wiring — registers every tool/prompt/resource and returns the
 * configured McpServer instance.
 */

import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { tryLoadConfig } from "./config.js";
import { RakutenError } from "./errors.js";
import { prompts } from "./prompts/index.js";
import { resources } from "./resources/index.js";
import { tools } from "./tools/index.js";
import { READONLY, withParamTitles } from "./tools/meta.js";

const SERVER_NAME = "rakuten-mcp";
const SERVER_VERSION = "1.2.0";

const SERVER_INSTRUCTIONS = `rakuten-mcp exposes the public Rakuten Web Service as MCP tools across six families: Ichiba (e-commerce), Books, Travel (hotels), Recipe, Kobo (eBooks), and GORA (golf).

All tools are READ-ONLY. There are no money-moving operations.

Auth: set RAKUTEN_APP_ID and RAKUTEN_ACCESS_KEY (free at https://webservice.rakuten.co.jp/). Optionally set RAKUTEN_AFFILIATE_ID to append affiliate links.

When tools error with rate limits, the server retries automatically with exponential backoff (max 3 retries by default; override with RAKUTEN_MAX_RETRIES).

Tool naming: every tool is prefixed by its API family — ichiba_*, books_*, travel_*, recipe_*, kobo_*, gora_*.

Bilingual: every tool description is provided in English (primary) and Japanese ([JA]). Use whichever the user prefers.`;

export function buildServer(): McpServer {
  // Only advertise capabilities the server actually serves. The SDK only
  // registers a `prompts/list` / `resources/list` handler when at least one
  // prompt / resource is registered. Advertising an empty `prompts: {}` while
  // the SDK returns `-32601 Method not found` for `prompts/list` is a spec
  // mismatch that surfaces as a noisy error in Claude Desktop's logs.
  const capabilities: {
    tools: Record<string, unknown>;
    prompts?: Record<string, unknown>;
    resources?: Record<string, unknown>;
  } = { tools: {} };
  if (prompts.length > 0) capabilities.prompts = {};
  // Advertise resources when static resources exist OR any tool ships an MCP Apps UI.
  if (resources.length > 0 || tools.some((t) => t.ui)) capabilities.resources = {};

  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities,
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  // Tools
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title.en,
        description: `${tool.description.en}\n\n[JA] ${tool.description.ja}`,
        inputSchema: withParamTitles(tool.inputSchema.shape),
        annotations: READONLY,
        ...(tool.ui ? { _meta: { ui: { resourceUri: tool.ui.resourceUri } } } : {}),
      },
      async (rawArgs: unknown) => {
        try {
          // Lazy-load config so resources/prompts can be enumerated without auth.
          const config = tryLoadConfig();
          if (!config) {
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: `Configuration error: RAKUTEN_APP_ID and RAKUTEN_ACCESS_KEY must be set.\n\n[JA] 設定エラー: RAKUTEN_APP_ID と RAKUTEN_ACCESS_KEY を設定してください。`,
                },
              ],
            };
          }

          const parsed = tool.inputSchema.parse(rawArgs);
          const result = await tool.handler(parsed, config);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
            // For MCP Apps hosts: same payload, structured, for the UI iframe.
            ...(tool.ui && result && typeof result === "object"
              ? { structuredContent: result as Record<string, unknown> }
              : {}),
          };
        } catch (err) {
          if (err instanceof RakutenError) {
            return {
              isError: true,
              content: [{ type: "text" as const, text: err.toToolError() }],
            };
          }
          const message = err instanceof Error ? err.message : String(err);
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Unexpected error in ${tool.name}: ${message}`,
              },
            ],
          };
        }
      },
    );
  }

  // MCP Apps: single-file UI (built by Vite to dist/ui/index.html) served as
  // a ui:// resource. Hosts that support MCP Apps render it in a sandboxed
  // iframe; text-only hosts ignore it and use the text content as before.
  if (tools.some((t) => t.ui)) {
    const ITEM_SEARCH_UI_URI = "ui://rakuten-mcp/item-search";
    registerAppResource(
      server,
      "Rakuten Item Search UI",
      ITEM_SEARCH_UI_URI,
      {
        description: "Product-card grid for ichiba_item_search results",
        mimeType: RESOURCE_MIME_TYPE,
        _meta: {
          ui: {
            csp: {
              // Rakuten image CDNs (thumbnails in mediumImageUrls).
              resourceDomains: [
                "https://thumbnail.image.rakuten.co.jp",
                "https://shop.r10s.jp",
                "https://image.rakuten.co.jp",
                "https://r.r10s.jp",
              ],
            },
          },
        },
      },
      async () => ({
        contents: [
          { uri: ITEM_SEARCH_UI_URI, mimeType: RESOURCE_MIME_TYPE, text: loadUiHtml() },
        ],
      }),
    );
  }

  // Prompts
  for (const prompt of prompts) {
    const argsSchema = Object.fromEntries(
      (prompt.arguments ?? []).map((a) => [
        a.name,
        (a.required ? z.string() : z.string().optional()).describe(
          `${a.description.en} ${a.description.ja}`,
        ),
      ]),
    );
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.title.en,
        description: `${prompt.description.en}\n\n[JA] ${prompt.description.ja}`,
        argsSchema,
      },
      async (args: Record<string, string | undefined>) => {
        const text = prompt.build(args);
        return {
          messages: [
            {
              role: "user" as const,
              content: { type: "text" as const, text: text.en },
            },
          ],
        };
      },
    );
  }

  // Resources
  for (const resource of resources) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        title: resource.title.en,
        description: `${resource.description.en}\n\n[JA] ${resource.description.ja}`,
        mimeType: resource.mimeType,
      },
      async (uri: URL) => {
        const config = tryLoadConfig();
        if (!config) {
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: resource.mimeType,
                text: "Configuration error: credentials not set.",
              },
            ],
          };
        }
        const text = await resource.read(config);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: resource.mimeType,
              text,
            },
          ],
        };
      },
    );
  }

  return server;
}

export { SERVER_NAME, SERVER_VERSION };

let uiHtmlCache: string | undefined;

/**
 * Load the built single-file UI. In the published package it sits next to the
 * bundled server at dist/ui/index.html; when running from source via tsx it
 * resolves ../dist/ui/index.html (requires `npm run build` first).
 */
function loadUiHtml(): string {
  if (uiHtmlCache) return uiHtmlCache;
  const candidates = [
    new URL("./ui/index.html", import.meta.url),
    new URL("../dist/ui/index.html", import.meta.url),
  ];
  for (const url of candidates) {
    try {
      uiHtmlCache = readFileSync(url, "utf8");
      return uiHtmlCache;
    } catch {
      // try next
    }
  }
  return "<!doctype html><html><body><p>rakuten-mcp UI bundle missing — run `npm run build`.</p></body></html>";
}
