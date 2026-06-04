# Changelog

All notable changes to `rakuten-mcp`. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased — v1.0.0-alpha.0]

### Architecture

- Full rewrite from single-file 628-LOC `src/index.ts` (legacy 0.1.x) into a modular tree under `src/`. See `AGENTS.md` for the architecture brief.
- Modern MCP SDK: `@modelcontextprotocol/sdk` ^1.29, using the high-level `McpServer` API (`registerTool`/`registerPrompt`/`registerResource`).
- Per-endpoint host configuration (legacy `app.rakuten.co.jp` vs new `openapi.rakuten.co.jp`). No blanket migration — verified per-endpoint with direct HTTP probes.
- `RAKUTEN_API_HOST_OVERRIDE` env var as an escape hatch when Rakuten silently moves an endpoint mid-life.
- Typed error tree (`src/errors.ts`) with 8 classes covering Config / Auth / RateLimit / Server / NotFound / BadRequest / MalformedResponse / Unknown.
- Error parser handles both Rakuten response shapes:
  - Legacy: `{"error_description": "...", "error": "wrong_parameter"}`
  - New host: `{"errors": {"errorCode": 400, "errorMessage": "..."}}`
- Retry-with-backoff on 429 and 5xx (configurable via `RAKUTEN_MAX_RETRIES`, default 3). `Retry-After` parsed as both numeric seconds and HTTP-date.
- Bilingual EN/JA on every tool, prompt, and resource. Required convention.

### Added — Ichiba tools (5)

- `ichiba_item_search` — Search Ichiba products by keyword with price filters, sort, genre/shop restrictions. Endpoint: `/services/api/IchibaItem/Search/20220601` (legacy host).
- `ichiba_genre_search` — Browse the Ichiba genre tree. Endpoint: `/services/api/IchibaGenre/Search/20140222` (legacy host).
- `ichiba_tag_search` — Fetch tag groups for a genre, or details for a specific tag. Endpoint: `/services/api/IchibaTag/Search/20140222` (legacy host).
- `ichiba_item_ranking` — Bestseller rankings (overall or by genre/period/demographic). Endpoint: `/services/api/IchibaItem/Ranking/20220601` (legacy host).
- `ichiba_product_search` — Item Price Navi: cross-seller product comparison with min/max/average pricing. Endpoint: `/services/api/Product/Search/20170426` (legacy host).

### Removed (vs prior 0.1.x)

- **Dropped `get_product_reviews`** (was in 0.1.3). The underlying `IchibaItem/Review/20220601` endpoint **does not exist** on Rakuten's API — verified 2026-06-04 via direct probe (legacy host returned `"Operation IchibaItem/Review doesn't exist"`; new host returned 404). The 0.1.x tool has been broken since launch.
- **Did not implement `ichiba_attribute_search`** (was on the v1.0 plan). Direct probes against three candidate version dates all returned `"Operation IchibaItem/AttributeSearch doesn't exist"`. The endpoint appeared in third-party API surveys but is not real.

### Build & dev

- Node 20+ (was 18+ in 0.1.x).
- Test stack: vitest 4 + msw 2 with recorded fixtures (no live API calls in CI).
- Build: tsup → ESM, target node20, with shebang shim.
- Scripts: `test`, `test:watch`, `coverage`, `typecheck`, `dev:stdio`, `dev:http`, `build`, `prepublishOnly`.

### Documentation

- New `AGENTS.md` (297 lines) for AI coding agents — architecture, conventions, "how to add a new tool" template, what NOT to do, release process.
- New `PLAN-v1.0.md` (the executable 3-week build bible).
- Updated `README.md` planned for Week 3.

---

## [0.2.0] — 2026-04-30

Previous published version on npm at the start of the v1.0 rewrite. Single-file architecture; see git history for details.

## [0.1.0–0.1.3] — 2026-04-14 to 2026-04-24

Initial launches. See git history.
