/**
 * MCP server wiring — registers every tool/prompt/resource and returns the
 * configured McpServer instance.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tryLoadConfig } from "./config.js";
import { RakutenError } from "./errors.js";
import { prompts } from "./prompts/index.js";
import { resources } from "./resources/index.js";
import { tools } from "./tools/index.js";
import { READONLY, withParamTitles } from "./tools/meta.js";
import { renderComponent } from "./ui/render.js";

const SERVER_NAME = "rakuten-mcp";
const SERVER_VERSION = "1.2.2";

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
  // MCP Apps ui:// widgets are resources, so tools with a ui block also
  // require the resources capability.
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
        ...(tool.ui ? { _meta: { ui: { resourceUri: tool.ui.uri } } } : {}),
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

          // MCP Apps: append the rendered widget for hosts that support it.
          // The JSON text block stays first so non-Apps clients lose nothing.
          if (tool.ui) {
            const data = tool.ui.map(result, parsed);
            if (data !== null && data !== undefined) {
              const render = renderComponent({
                uri: tool.ui.uri,
                template: tool.ui.template,
                data,
              });
              return {
                content: [
                  { type: "text" as const, text: JSON.stringify(result, null, 2) },
                  render.contentBlock,
                ],
                _meta: render.resultMeta,
              };
            }
          }

          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
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

  // MCP Apps ui:// widgets. The static document shows a loading state until
  // the host pushes the tool result; preload-capable hosts fetch it via the
  // tool's _meta.ui.resourceUri link.
  for (const tool of tools) {
    if (!tool.ui) continue;
    const staticDoc = renderComponent({
      uri: tool.ui.uri,
      template: tool.ui.template,
      data: null,
    }).staticHtml;
    server.registerResource(
      tool.ui.title.en,
      tool.ui.uri,
      {
        title: tool.ui.title.en,
        description: `Interactive MCP Apps widget for ${tool.name}.\n\n[JA] ${tool.name} の MCP Apps ウィジェット。`,
        mimeType: "text/html",
      },
      async (uri: URL) => ({
        contents: [{ uri: uri.href, mimeType: "text/html", text: staticDoc }],
      }),
    );
  }

  return server;
}

export { SERVER_NAME, SERVER_VERSION };
