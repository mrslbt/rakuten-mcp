# AGENTS.md — rakuten-mcp

Instructions for AI coding agents (Codex, Cursor, Copilot, Claude Code, etc.) contributing to this repository.

## What this project is

`rakuten-mcp` is a Model Context Protocol server that exposes the **public Rakuten Web Service** as MCP tools. It's a **read-only** server — there are no money-moving operations, no merchant-side (RMS) endpoints, and no destructive actions. Distribution: npm (`rakuten-mcp`), listed in the Official MCP Registry as `io.github.mrslbt/rakuten-mcp`, plus Glama / Smithery / mcp.so / Cline marketplace / PulseMCP / LobeHub / awesome-mcp-servers.

Six API families, ~27 tools when complete (build target: v1.0.0):

| Family | Prefix | Tools (target) | Host |
|---|---|---:|---|
| Ichiba (e-commerce) | `ichiba_*` | 6–7 | `app.rakuten.co.jp` (legacy) |
| Books | `books_*` | 9 | Both — Books migrated to `openapi.rakuten.co.jp` |
| Travel | `travel_*` | 7 | Mixed — vacancy on `openapi/engine/api`, others on legacy |
| Recipe | `recipe_*` | 2 | `app.rakuten.co.jp` (legacy) |
| Kobo (eBooks) | `kobo_*` | 2 | TBD per endpoint |
| GORA (golf) | `gora_*` | 3 | TBD per endpoint |

**Host config is per-endpoint, not blanket.** The verified state of the Rakuten migration is that some endpoint families have moved to `openapi.rakuten.co.jp` and others haven't. Each tool file picks its host explicitly.

## Quick commands

```bash
npm install        # install dependencies (Node >= 20)
npm run typecheck  # tsc --noEmit — must pass before commit
npm run build      # tsup → dist/index.js (ESM, node20 target)
npm test           # vitest run — must pass before commit
npm run test:watch # vitest in watch mode during development
npm run coverage   # vitest with coverage report
npm run dev:stdio  # tsx watch via stdio (default transport)
npm run dev:http   # tsx watch via Streamable HTTP on :3000
```

Pre-commit gate: `npm run typecheck && npm test`. Both must pass.

## Architecture

```
src/
├── index.ts            # Entry point — parses CLI args, picks transport
├── server.ts           # buildServer() — wires tools/prompts/resources into McpServer
├── config.ts           # loadConfig() — env-driven, Zod-validated, fails fast
├── client.ts           # rakutenRequest() — per-endpoint host, retry/backoff
├── errors.ts           # 8 typed error classes, parses BOTH host response shapes
├── i18n.ts             # Bilingual type + helper, error message table
├── auth.ts             # applicationId + accessKey + optional affiliateId
├── transports/
│   ├── stdio.ts        # StdioServerTransport (default)
│   └── http.ts         # Streamable HTTP (added Week 2)
├── tools/
│   ├── types.ts        # ToolDefinition, PromptDefinition, ResourceDefinition
│   ├── index.ts        # Tool registry (aggregates all family files)
│   ├── ichiba.ts       # ichiba_* tools
│   ├── books.ts        # books_* tools
│   ├── travel.ts       # travel_* tools
│   ├── recipe.ts       # recipe_* tools
│   ├── kobo.ts         # kobo_* tools
│   └── gora.ts         # gora_* tools
├── prompts/index.ts    # Prompt registry
└── resources/index.ts  # Resource registry
```

The MCP SDK is `@modelcontextprotocol/sdk` ^1.29. Code uses the high-level `McpServer` API with `registerTool`/`registerPrompt`/`registerResource`. Do NOT use the lower-level `Server` + `setRequestHandler` pattern — it bypasses higher-level type safety.

## Two non-negotiable conventions

### 1. Bilingual descriptions on EVERY user-facing string

Tools, prompts, resources, and Zod field `.describe()` calls all require both English and Japanese text. This is a deliberate product decision — `rakuten-mcp` targets Japanese e-commerce/travel/books users equally with English-speaking developers.

Format: English text, blank line, Japanese text. CI enforces non-empty bilingual values via `test/i18n.test.ts`.

```ts
// CORRECT
description: bilingual(
  "Search Rakuten Ichiba for products by keyword, with optional price filters.",
  "楽天市場で商品をキーワード検索します。価格フィルタも指定できます。"
)

// WRONG — missing JA
description: bilingual("Search products", "")

// WRONG — using a single string
description: "Search products"
```

### 2. Per-endpoint host selection — never blanket-migrate

Each tool file explicitly picks its host (`HOST_LEGACY` or `HOST_OPENAPI`) per endpoint. This is verified-correct as of June 2026: Rakuten's migration to `openapi.rakuten.co.jp` is partial — Books and Travel/vacancy are on the new host; Ichiba, Recipe, and Travel/keyword are still on the legacy host.

```ts
import { HOST_LEGACY, HOST_OPENAPI } from "../config.js";

// Ichiba is on the legacy host today
const ichibaItemSearch: ToolDefinition<typeof input> = {
  name: "ichiba_item_search",
  // ...
  handler: async (args, config) => rakutenRequest({
    host: HOST_LEGACY,
    path: "/services/api/IchibaItem/Search/20220601",
    params: { keyword: args.keyword, hits: String(args.hits) },
  }, config),
};

// Books is on the new host
const booksTotalSearch: ToolDefinition<typeof input> = {
  name: "books_total_search",
  // ...
  handler: async (args, config) => rakutenRequest({
    host: HOST_OPENAPI,
    path: "/services/api/BooksTotal/Search/20170404",
    params: { /* ... */ },
  }, config),
};
```

Users can override every host with `RAKUTEN_API_HOST_OVERRIDE` env var if Rakuten silently moves an endpoint mid-life. Do not remove that escape hatch.

## How to add a new tool

Canonical pattern, derived from `src/tools/ichiba.ts`:

1. **Decide which host serves the endpoint** by hitting it manually with curl + real creds. Don't assume.
2. **Create the tool file** if a family file doesn't exist yet, or append to the existing family file.
3. **Define the Zod input schema** with bilingual `.describe()` on every field.
4. **Write the handler** that calls `rakutenRequest` with the right host, path, and params.
5. **Export the tool definition**.
6. **Register it** in `src/tools/index.ts` by adding to the `tools` array.
7. **Record fixtures**: `test/fixtures/<family>/<tool_name>_success.json` (real response with creds), plus edge cases (no results, validation errors).
8. **Write tests** in `test/<family>.test.ts` covering: success, no-results, missing-required-param (Zod throws), 401 auth, 429 rate-limit (retried then succeeds), 5xx (retried then fails), 4xx (not retried).
9. **Update README** coverage table.
10. **Update CHANGELOG.md** under the unreleased section.

Template:

```ts
// src/tools/<family>.ts
import { z } from "zod";
import { HOST_LEGACY } from "../config.js";
import { bilingual } from "../i18n.js";
import { rakutenRequest } from "../client.js";
import type { ToolDefinition } from "./types.js";

const input = z.object({
  some_field: z.string().describe(
    "English description of the field. 日本語の説明。"
  ),
  // Every field MUST have bilingual .describe().
});

export const someNewTool: ToolDefinition<typeof input> = {
  name: "family_some_new_tool",
  title: bilingual("Human-Readable Title", "人間が読めるタイトル"),
  description: bilingual(
    "Tell the LLM what this does and when to use it. Mention the Rakuten endpoint underneath if useful.",
    "LLMに何をするツールか、いつ使うかを伝えます。"
  ),
  inputSchema: input,
  async handler(args, config) {
    return rakutenRequest({
      host: HOST_LEGACY, // or HOST_OPENAPI — verify per endpoint
      path: "/services/api/Family/Endpoint/YYYYMMDD",
      params: {
        // string-valued query params; rakutenRequest handles auth + format
        someField: args.some_field,
      },
    }, config);
  },
};
```

Then add it to `src/tools/index.ts`:

```ts
import { someNewTool } from "./family.js";

export const tools: ToolDefinition[] = [
  // ...existing tools,
  someNewTool,
];
```

## Tests

`vitest` for unit + integration. **No live API calls in CI** — `msw` intercepts every Rakuten request and returns recorded fixtures.

Fixture convention: every fixture is a real Rakuten response captured during development. Filename: `test/fixtures/<family>/<tool_name>_<scenario>.json`. Scenarios: `success`, `no_results`, `auth_invalid`, `rate_limited`, `server_error`, `not_found`, plus tool-specific edge cases.

When recording a new fixture:

1. Run `npm run dev:stdio` with real `RAKUTEN_APP_ID` + `RAKUTEN_ACCESS_KEY`
2. Invoke the tool via MCP Inspector (or directly via JSON-RPC over stdio)
3. Save the JSON response body to the appropriate fixture file
4. Add a corresponding handler to `test/handlers/<family>.handlers.ts`
5. Write the test in `test/<family>.test.ts` that uses the handler

msw must be configured with `onUnhandledRequest: "error"` so any test that accidentally calls a real URL fails fast.

Acceptance: ≥ 80% line coverage before v1.0.0.

## Error handling

Eight typed error classes in `src/errors.ts`:

| Class | When |
|---|---|
| `RakutenConfigError` | Missing required env vars |
| `RakutenAuthError` | 401/403 from Rakuten |
| `RakutenRateLimitError` | 429; carries parsed `retryAfterMs` |
| `RakutenServerError` | 5xx |
| `RakutenNotFoundError` | 404 (endpoint moved/deprecated) |
| `RakutenBadRequestError` | 400 with extracted error message |
| `RakutenMalformedResponseError` | Body isn't JSON / unexpected shape |
| `RakutenUnknownError` | Other HTTP status not matched above |

Every error carries both English (`message`) and Japanese (`messageJa`) text. Tool handlers in `src/server.ts` automatically convert `RakutenError` instances to bilingual tool errors via `err.toToolError()`.

`parseRakutenError()` normalizes BOTH host response shapes:
- Legacy: `{ "error_description": "...", "error": "wrong_parameter" }`
- New: `{ "errors": { "errorCode": 400, "errorMessage": "..." } }`

Do not introduce a third error shape. If a new endpoint returns something different, extend `parseRakutenError()` rather than adding ad-hoc handling in tool files.

Retry policy:
- Retries on 429 (with Retry-After respected, capped at 60s) and 5xx
- Default 3 retries, configurable via `RAKUTEN_MAX_RETRIES`
- Exponential backoff: 500ms, 1s, 2s, 4s
- Network errors (fetch throws) also retried
- 4xx other than 429 → NOT retried (would just fail again)

## HTTP transport

Coming in Week 2 (Day 4 per `PLAN-v1.0.md`). Will support:
- `--http [port]` CLI flag or `MCP_TRANSPORT=http`
- Bearer token auth via `MCP_HTTP_AUTH_TOKEN`
- Origin header validation
- Default bind to `127.0.0.1` (do not expose publicly without explicit opt-in)

Current stub at `src/transports/http.ts` exits with code 2 and a pointer to the plan.

## What NOT to do

- **Do not** use the low-level `Server` + `setRequestHandler` SDK pattern. Stay on `McpServer` + `registerXxx`.
- **Do not** ship a tool with English-only descriptions. Bilingual is enforced.
- **Do not** ship a tool that mutates Rakuten state. The public Rakuten Web Service is read-only by API design; if you're tempted to add a "create_*" or "delete_*" tool, you're looking at the wrong API surface (that's RMS — a separate authenticated merchant-side API not in scope for this MCP).
- **Do not** introduce third-party dependencies for HTTP, signing, or auth. Use the built-in `fetch` and the existing `auth.ts` helpers.
- **Do not** blanket-migrate all endpoints to `openapi.rakuten.co.jp`. Migration is partial. Verify per endpoint.
- **Do not** commit `dist/`, `.env`, or `node_modules`. They are git-ignored.
- **Do not** log API keys, application IDs, or full responses to stderr. The logger goes to stderr only and must avoid sensitive payloads.
- **Do not** ship without updating CHANGELOG.md. Every release entry follows [Keep a Changelog](https://keepachangelog.com/).

## Release process

All four version locations must match:

1. `package.json` `version`
2. `src/server.ts` `SERVER_VERSION` constant
3. `server.json` top-level `version`
4. `server.json` `packages[0].version`

Steps:

```bash
# 1. Bump versions in all 4 locations
# 2. Verify
npm run typecheck && npm test
# 3. Build
npm run build
# 4. Run a smoke test against the real API with valid creds
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}' | RAKUTEN_APP_ID=... RAKUTEN_ACCESS_KEY=... node dist/index.js
# 5. Commit + tag
git add -A && git commit -m "release: vX.Y.Z — <one-line summary>"
git tag vX.Y.Z
git push origin main --tags
# 6. Publish to npm (token in ~/.npmrc must have bypass-2FA)
npm publish
# 7. Refresh aggregators
# - Glama auto-rebuilds via glama.json
# - Smithery picks up via smithery.yaml on push
# - Official MCP Registry: mcp-publisher publish (requires GH OIDC auth)
```

CI on tag push automates steps 5–7 once Week 3 Day 5's `release.yml` lands.

## Useful Rakuten Web Service references

- **Developer dashboard** (free signup, get App ID + Access Key): https://webservice.rakuten.co.jp/
- **API documentation index**: https://webservice.rakuten.co.jp/documentation
- **API Explorer** (for manual endpoint testing): https://webservice.rakuten.co.jp/explorer/api
- **Legacy host**: `https://app.rakuten.co.jp` — Ichiba, Recipe, Travel/keyword, etc.
- **New host**: `https://openapi.rakuten.co.jp` — Books, Travel/vacancy (on `/engine/api/`)
- **Rate limit**: ~1 QPS per applicationId (not officially documented; observed empirically)

## Maintainer

Built by Marsel Bait (https://marselbait.me). Part of a portfolio of MCP servers focused on the Japan/SEA region and AI-native tooling. Other servers in the catalogue: rippr (YouTube transcripts), paypay-mcp (QR payments), xendit-mcp (SEA payments), japan-ux-mcp (UX patterns), pdf-it (designed PDFs), tabedata-mcp (Japanese food nutrition).
