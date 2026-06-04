# AGENTS.md — rakuten-mcp

Instructions for AI coding agents (Codex, Cursor, Copilot, Claude Code, etc.) contributing to this repository.

## What this project is

`rakuten-mcp` is a Model Context Protocol server that exposes the **public Rakuten Web Service** as MCP tools. It is **read-only** — there are no money-moving operations, no merchant-side (RMS) endpoints, no destructive actions. Distribution: npm (`rakuten-mcp`), listed in the Official MCP Registry as `io.github.mrslbt/rakuten-mcp`, plus Glama / Smithery / mcp.so / Cline marketplace / PulseMCP / LobeHub / awesome-mcp-servers.

**28 tools across 6 API families** (as of v1.0.0, verified live on 2026-06-04):

| Family | Prefix | Tools | Host | Path root |
|---|---|---:|---|---|
| Ichiba (e-commerce) | `ichiba_*` | 5 | `openapi.rakuten.co.jp` | `/ichibams/api/`, `/ichibagt/api/`, `/ichibaranking/api/`, `/ichibaproduct/api/` |
| Books | `books_*` | 9 | `openapi.rakuten.co.jp` | `/services/api/` |
| Travel (hotels) | `travel_*` | 7 | `openapi.rakuten.co.jp` | `/engine/api/Travel/` |
| Recipe | `recipe_*` | 2 | `openapi.rakuten.co.jp` | `/recipems/api/` |
| Kobo (eBooks) | `kobo_*` | 2 | `openapi.rakuten.co.jp` | `/services/api/Kobo/` |
| GORA (golf) | `gora_*` | 3 | `openapi.rakuten.co.jp` | `/engine/api/Gora/` |

**Everything is on `openapi.rakuten.co.jp` now.** The pre-migration `app.rakuten.co.jp` host is no longer used by any shipped tool. The constant `HOST_LEGACY` still exists in `src/config.ts` as documentation of the old host, but no tool imports it. What varies per endpoint is the **path root**, not the host. Within Ichiba alone there are four distinct path roots.

This is the result of Rakuten's 2026-04 platform migration. The host moved, the path roots fragmented, and the version date on each endpoint may or may not have bumped. Three Ichiba response shapes were also rewritten in that migration (genre is now flat `ancestors/siblings/children`, tag is tagId-only, product uses `productId` opaque hash).

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

Two additional verification scripts under `scripts/`:

- `node scripts/smoke.mjs` — drives all 28 tools against the live Rakuten API end-to-end. Requires real `RAKUTEN_APP_ID` + `RAKUTEN_ACCESS_KEY` in env. Takes ~21s.
- `node scripts/client-conformance.mjs` — exercises the full MCP protocol surface the way Claude Desktop / Cursor / Cline do on load (initialize handshake, tools/list schemas, prompts/resources spec-compliance, error paths). Catches bugs the smoke test can't.

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
│   └── http.ts         # Streamable HTTP — 3-gate security (Host, Origin, Bearer)
├── tools/
│   ├── types.ts        # ToolDefinition, PromptDefinition, ResourceDefinition
│   ├── index.ts        # Tool registry (aggregates all family files)
│   ├── ichiba.ts       # 5 tools
│   ├── books.ts        # 9 tools
│   ├── travel.ts       # 7 tools
│   ├── recipe.ts       # 2 tools
│   ├── kobo.ts         # 2 tools
│   └── gora.ts         # 3 tools
├── prompts/index.ts    # Prompt registry (currently empty)
└── resources/index.ts  # Resource registry (currently empty)
```

The MCP SDK is `@modelcontextprotocol/sdk` ^1.29. Code uses the high-level `McpServer` API with `registerTool` / `registerPrompt` / `registerResource`. Do NOT use the lower-level `Server` + `setRequestHandler` pattern — it bypasses higher-level type safety.

`server.ts` only advertises a capability (`prompts`, `resources`) when its registry is non-empty. Advertising an empty capability while the SDK doesn't register the corresponding `list` handler results in `-32601 Method not found` errors in client logs.

## Two non-negotiable conventions

### 1. Bilingual descriptions on EVERY user-facing string

Tools, prompts, resources, and Zod field `.describe()` calls all require both English and Japanese text. `rakuten-mcp` targets Japanese e-commerce / travel / books users equally with English-speaking developers.

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

### 2. Verify every endpoint URL before writing the tool

The plan documents and third-party API surveys lie. Endpoints get silently moved, dates get bumped, response shapes change. The pattern is: probe with `curl` + your real `RAKUTEN_APP_ID`, watch the response shape, then write the code.

This convention is what catches Rakuten's silent migrations. Week 1 found that all 5 Ichiba endpoints had moved (host, path root, version date, and response shape). Week 2 found Books and Travel were exactly where the docs said. Week 3 found Kobo genre wouldn't accept `0` / `000` as the top-level ID (you need `101`).

```bash
# Template for a single endpoint probe
curl -sS "https://openapi.rakuten.co.jp/<path-root>/api/<Family>/<Endpoint>/<YYYYMMDD>?applicationId=$APP_ID&accessKey=$ACCESS_KEY&format=json&<param>=<value>" \
  | python3 -m json.tool | head -50
```

If a probe fails, fetch the documentation page directly (`https://webservice.rakuten.co.jp/documentation/<endpoint-slug>`) and quote the URL template verbatim into the docstring on the tool. Don't trust summaries.

## How to add a new tool

1. **Probe the endpoint** with `curl` + real credentials. Confirm path root, version date, and response shape.
2. **Capture a fixture**: `test/fixtures/<family>/<tool_name>_success.json`, plus edge cases (`<tool_name>_empty.json`, `<tool_name>_auth_invalid.json`).
3. **Create or append to** the family file under `src/tools/`.
4. **Define the Zod input schema** with bilingual `.describe()` on every field.
5. **Write the handler** — string-valued query params, `HOST_OPENAPI`, path from the probe.
6. **Export the tool definition**.
7. **Register it** in `src/tools/index.ts` by adding to the `tools` array.
8. **Add msw handlers** in `test/handlers/<family>.handlers.ts`.
9. **Write tests** in `test/<family>.test.ts` covering: tool definition (name, bilingual), Zod validation (missing required, defaults), success, no-results, 400 auth error, 429 rate-limit (retried then succeeds), 5xx (retried then fails).
10. **Update README** tool table and **CHANGELOG.md** under the unreleased section.
11. **Add to `scripts/smoke.mjs`** so the live-API check covers it.

Template:

```ts
// src/tools/<family>.ts
import { z } from "zod";
import { HOST_OPENAPI } from "../config.js";
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
    "Tell the LLM what this does and when to use it.",
    "LLMに何をするツールか、いつ使うかを伝えます。"
  ),
  inputSchema: input,
  async handler(args, config) {
    return rakutenRequest({
      host: HOST_OPENAPI,
      path: "/<path-root>/api/<Family>/<Endpoint>/<YYYYMMDD>",
      params: {
        someField: args.some_field, // string-valued; rakutenRequest handles auth + format
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

Fixture convention: every fixture is a real Rakuten response captured during development. Filename: `test/fixtures/<family>/<tool_name>_<scenario>.json`. Scenarios: `success`, `empty`, `auth_invalid`, `rate_limited`, `server_error`, `not_found`, plus tool-specific edge cases.

When recording a new fixture:

1. `npm run dev:stdio` with real `RAKUTEN_APP_ID` + `RAKUTEN_ACCESS_KEY`
2. Invoke the tool via JSON-RPC over stdio (see `scripts/smoke.mjs` for the wire-up)
3. Save the JSON response body to the appropriate fixture file
4. Add a corresponding handler to `test/handlers/<family>.handlers.ts`
5. Write the test in `test/<family>.test.ts` that uses the handler

msw is configured with `onUnhandledRequest: "error"` so any test that accidentally calls a real URL fails fast.

Current state: 169 unit tests across 7 test files. 28/28 tools pass the live-API smoke. 16/16 protocol-conformance checks pass.

## Error handling

Eight typed error classes in `src/errors.ts`:

| Class | When |
|---|---|
| `RakutenConfigError` | Missing required env vars |
| `RakutenAuthError` | 401/403 from Rakuten |
| `RakutenRateLimitError` | 429; carries parsed `retryAfterMs` |
| `RakutenServerError` | 5xx |
| `RakutenNotFoundError` | 404 (endpoint moved / deprecated) |
| `RakutenBadRequestError` | 400 with extracted error message |
| `RakutenMalformedResponseError` | Body isn't JSON / unexpected shape |
| `RakutenUnknownError` | Other HTTP status not matched above |

Every error carries both English (`message`) and Japanese (`messageJa`) text. Tool handlers in `src/server.ts` automatically convert `RakutenError` instances to bilingual tool errors via `err.toToolError()`.

`parseRakutenError()` normalizes BOTH host response shapes:
- Legacy: `{ "error_description": "...", "error": "wrong_parameter" }` (still emitted by Rakuten on some endpoints)
- New: `{ "errors": { "errorCode": 400, "errorMessage": "..." } }`

Do not introduce a third error shape. If a new endpoint returns something different, extend `parseRakutenError()` rather than adding ad-hoc handling in tool files.

Retry policy:
- Retries on 429 (with Retry-After respected, capped at 60s) and 5xx
- Default 3 retries, configurable via `RAKUTEN_MAX_RETRIES`
- Exponential backoff: 500ms, 1s, 2s, 4s
- Network errors (fetch throws) also retried
- 4xx other than 429 → NOT retried (would just fail again)

## HTTP transport

Shipped in v1.0.0. Streamable HTTP via `--http [port]` CLI flag or `MCP_TRANSPORT=http`.

Three security gates, in order, before any MCP message is processed:

1. **Host validation** — refuses any `Host` header that isn't the configured `MCP_HTTP_HOST` (default `127.0.0.1`) or localhost. DNS rebinding protection.
2. **Origin validation** — refuses any `Origin` not in `MCP_HTTP_ALLOWED_ORIGINS` (default empty; localhost origins always allowed). CSRF protection.
3. **Bearer auth** — when `MCP_HTTP_AUTH_TOKEN` is set, requires `Authorization: Bearer <token>`.

The server refuses to bind to a non-localhost interface unless `MCP_HTTP_AUTH_TOKEN` is set. This is enforced in `src/transports/http.ts` and prevents accidental public exposure.

Gate logic is pure and unit-tested in `test/http-transport.test.ts`.

## What NOT to do

- **Do not** use the low-level `Server` + `setRequestHandler` SDK pattern. Stay on `McpServer` + `registerXxx`.
- **Do not** ship a tool with English-only descriptions. Bilingual is enforced.
- **Do not** ship a tool that mutates Rakuten state. The public Rakuten Web Service is read-only by API design; if you're tempted to add a `create_*` or `delete_*` tool, you're looking at the wrong API surface (that's RMS — a separate authenticated merchant-side API not in scope for this MCP).
- **Do not** introduce third-party dependencies for HTTP, signing, or auth. Use the built-in `fetch` and the existing `auth.ts` helpers.
- **Do not** assume an endpoint's URL from documentation alone. Probe it first.
- **Do not** advertise a capability (`prompts`, `resources`) when its registry is empty. Advertise only what you serve.
- **Do not** commit `dist/`, `.env`, or `node_modules`. They are git-ignored.
- **Do not** log API keys, application IDs, or full responses to stderr.
- **Do not** ship without updating `CHANGELOG.md`. Every release entry follows [Keep a Changelog](https://keepachangelog.com/).
- **Do not** publish to npm without explicit user approval, even when a multi-step plan implies it.

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
# 4. Smoke against the live API
RAKUTEN_APP_ID=... RAKUTEN_ACCESS_KEY=... node scripts/smoke.mjs
# 5. Conformance check
RAKUTEN_APP_ID=... RAKUTEN_ACCESS_KEY=... node scripts/client-conformance.mjs
# 6. Commit + tag
git add -A && git commit -m "release: vX.Y.Z — <one-line summary>"
git tag vX.Y.Z
git push origin main --tags
# 7. Publish to npm (token in ~/.npmrc must have bypass-2FA, OR set NPM_TOKEN
#    as a GH secret to let release.yml handle it)
npm publish
```

CI release workflow at `.github/workflows/release.yml` automates the publish on tag push, gated by an `NPM_TOKEN` repo secret. The dist-tag is inferred from the git tag suffix: `v1.0.0-alpha.N` → `alpha`, `v1.0.0-beta.N` → `beta`, `v1.0.0-rc.N` → `rc`, `v1.0.0` → `latest`.

## Useful Rakuten Web Service references

- **Developer dashboard** (free signup, get App ID + Access Key): https://webservice.rakuten.co.jp/
- **API documentation index**: https://webservice.rakuten.co.jp/documentation
- **Host**: `https://openapi.rakuten.co.jp` — all 28 tools target this single host with varying path roots
- **Rate limit**: ~1 QPS per applicationId (not officially documented; observed empirically; the smoke test sleeps 1.1s between calls to stay polite)

## Maintainer

Built by Marsel Bait (https://marselbait.me). Part of a portfolio of MCP servers focused on the Japan / SEA region and AI-native tooling. Other servers in the catalogue: rippr (YouTube transcripts), paypay-mcp (QR payments), xendit-mcp (SEA payments), japan-ux-mcp (UX patterns), pdf-it (designed PDFs), tabedata-mcp (Japanese food nutrition).
