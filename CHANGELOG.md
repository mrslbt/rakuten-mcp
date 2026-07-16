# Changelog

All notable changes to `rakuten-mcp`. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [1.2.2] — 2026-07-13

### Changed

- **MCP Apps UI now ships from the [mcp-apps-ui](https://github.com/mrslbt/mcp-apps-ui) kit** — one self-contained HTML product-list component vendored to `src/ui/`, replacing the 1.2.0 Vite + `@modelcontextprotocol/ext-apps` build. No build step, no UI dependencies. Handlers stay pure: the tool declares a `ui` block and the server edge renders it.
- Widget links are http(s)-only — non-web URL schemes in item data render as plain text.
- Ratings with a non-numeric `reviewAverage` are omitted instead of rendering NaN.
- Conformance script extended with MCP Apps checks, including a live assertion that a non-empty search returns the widget block with baked data.

### Added

- Rakuten image CDNs declared on the `ui://` resource via `_meta.ui.csp` (`thumbnail.image.rakuten.co.jp`, `shop.r10s.jp`, `image.rakuten.co.jp`) so strict MCP Apps hosts load product thumbnails.

### Removed

- `ui/` Vite source, `vite.config.ts`, and the `@modelcontextprotocol/ext-apps` / `vite` / `vite-plugin-singlefile` dependencies.

## [1.2.0] / [1.2.1] — 2026-07-10

Entries written retroactively; these versions shipped without changelog notes.

### Added

- **1.2.0** — first MCP Apps UI for `ichiba_item_search`: a product-card grid built with Vite + `@modelcontextprotocol/ext-apps` (superseded by 1.2.2's kit-based component).
- **1.2.1** — locale-aware widget chrome, Japanese-keyword hint, and an image-error placeholder fallback.

## [1.1.0] — 2026-06-06

Quality + discoverability pass. No tool behavior changed — all 28 tools and their endpoints are unchanged.

### Added

- **Tool annotations** on every tool (`readOnlyHint` / `idempotentHint` / `openWorldHint`) — all tools are read-only calls to the external Rakuten API.
- **Parameter titles** — all 141 parameters now carry a display `title` (via the central `withParamTitles` helper) alongside their bilingual description.
- **Prompt `plan_rakuten_trip`** — a guided Travel workflow chaining `travel_get_area_class` → `travel_vacant_hotel_search` → `travel_hotel_detail_search`.
- **`smithery.yaml`** — stdio config schema; the auth fields (`rakutenAppId` / `rakutenAccessKey` / `rakutenAffiliateId`) are optional (`required: []`), so the server starts without them and tools return a clear config error.

### Changed

- `server.json` description trimmed to the MCP registry's 100-character limit; version synced to 1.1.0 across `package.json`, `server.json`, and `src/server.ts`.

---

## [1.0.0] — 2026-06-04

First production release. 28 tools across 6 Rakuten Web Service families, all verified against the live API on the release date.

### Added — Ichiba tools (5)

- `ichiba_item_search` — Keyword search with price filters, sort, genre/shop restriction. Endpoint: `/ichibams/api/IchibaItem/Search/20260401`.
- `ichiba_genre_search` — Browse the genre tree. Endpoint: `/ichibagt/api/IchibaGenre/Search/20260401`. Response shape rewritten in the 2026-04 migration to flat `{genre, ancestors, siblings, children}` with `nameJa/level` (no wrapped `{child: {...}}`). Public output preserves `current/ancestors/siblings/children` for stability.
- `ichiba_tag_search` — Tag detail lookup. Endpoint: `/ichibagt/api/IchibaTag/Search/20140222`. The endpoint now requires `tagId` only; the previous "list tags for a genre" mode was removed in the 2026-04 migration.
- `ichiba_item_ranking` — Bestseller ranking with genre/period/age/gender filters. Endpoint: `/ichibaranking/api/IchibaItem/Ranking/20220601`. Note: Rakuten returns ranks 30→1 per page (descending); this tool sorts to ascending so item[0] is rank 1.
- `ichiba_product_search` — Item Price Navi (cross-seller comparison). Endpoint: `/ichibaproduct/api/Product/Search/20250801`. Primary key is now `productId` (opaque hash); `productNo` may be null on the new endpoint.

### Added — Books tools (9)

- `books_total_search` — Cross-category search. `/services/api/BooksTotal/Search/20170404`.
- `books_book_search` — Books by title/author/ISBN/publisher. `/services/api/BooksBook/Search/20170404`.
- `books_cd_search` — `/services/api/BooksCD/Search/20170404`.
- `books_dvd_search` — `/services/api/BooksDVD/Search/20170404`.
- `books_foreign_book_search` — Non-Japanese books with `japaneseTitle` when a translation exists. `/services/api/BooksForeignBook/Search/20170404`.
- `books_magazine_search` — `/services/api/BooksMagazine/Search/20170404`.
- `books_game_search` — `/services/api/BooksGame/Search/20170404`.
- `books_software_search` — `/services/api/BooksSoftware/Search/20170404`.
- `books_genre_search` — Browse the Books genre tree. `/services/api/BooksGenre/Search/20121128`. Uses the legacy wrapped `{current, parents:[{parent}], children:[{child}]}` shape with `booksGenreId/booksGenreName/genreLevel` fields.

### Added — Travel tools (7)

- `travel_simple_hotel_search` — Hotels by area code or lat/lon. `/engine/api/Travel/SimpleHotelSearch/20170426`.
- `travel_vacant_hotel_search` — Availability search by date range. Returns plans with per-night and total pricing. `/engine/api/Travel/VacantHotelSearch/20170426`.
- `travel_hotel_detail_search` — Full hotel profile by `hotelNo`. `/engine/api/Travel/HotelDetailSearch/20170426`.
- `travel_get_area_class` — Area-code hierarchy (日本 → 47 prefectures → cities → districts). `/engine/api/Travel/GetAreaClass/20140210`.
- `travel_keyword_hotel_search` — Free-text hotel search. `/engine/api/Travel/KeywordHotelSearch/20170426`.
- `travel_get_hotel_chain_list` — All 307 hotel chains. `/engine/api/Travel/GetHotelChainList/20131024`.
- `travel_hotel_ranking` — Top hotels by ranking genre (8 genres). `/engine/api/Travel/HotelRanking/20170426`.

Travel search responses come back with a double-wrap (`hotels:[{hotel:[{hotelBasicInfo}, {hotelRatingInfo}, ...]}]`). `flattenHotel()` merges those info blocks into a single `Hotel` object per result.

### Added — Recipe tools (2)

- `recipe_category_list` — Full Rakuten Recipe category tree (43 large → ~540 medium → ~1500 small). Supports `level` parameter to fetch one tier (the full tree is ~430KB). `/recipems/api/Recipe/CategoryList/20170426`.
- `recipe_category_ranking` — Top recipes in a category with title, ingredient list, prep time, cost estimate, image, and author. `/recipems/api/Recipe/CategoryRanking/20170426`.

### Added — Kobo tools (2)

- `kobo_ebook_search` — Search Kobo's eBook catalogue. Returns title, series, author, publisher, language code, price, and sale URL. `/services/api/Kobo/EbookSearch/20170426`.
- `kobo_genre_search` — Browse the Kobo genre tree. Top-level is `koboGenreId=101` (電子書籍); passing `0` or `000` returns "the genre id is not valid". `/services/api/Kobo/GenreSearch/20131010`.

### Added — GORA tools (3)

- `gora_golf_course_search` — Golf courses by area code, keyword, or coordinates. `/engine/api/Gora/GoraGolfCourseSearch/20170623`.
- `gora_golf_course_detail` — Full course profile by ID. Merges the 5 `golfCourseImageUrlN` slots into a single `imageUrls` array. `/engine/api/Gora/GoraGolfCourseDetail/20170623`.
- `gora_plan_search` — Reservation plans on a specific play date. Returns per-plan prices, cart/caddie/lunch inclusions, player-count constraints. Flattens the nested `planInfo:[{plan:{...}}]` into a clean `plans:[...]` array per course. `/engine/api/Gora/GoraPlanSearch/20170623`.

### Architecture

- Modular rewrite from the single-file 628-LOC `src/index.ts` of v0.1.x into a tree under `src/tools/<family>.ts`.
- `@modelcontextprotocol/sdk` ^1.29, high-level `McpServer` API with `registerTool` / `registerPrompt` / `registerResource`.
- Per-endpoint host + path-root selection. All 28 endpoints target `openapi.rakuten.co.jp`. Path roots differ per family: `/ichibams/api/`, `/ichibagt/api/`, `/ichibaranking/api/`, `/ichibaproduct/api/`, `/services/api/`, `/recipems/api/`, `/engine/api/`.
- `RAKUTEN_API_HOST_OVERRIDE` env var as an escape hatch if Rakuten silently moves an endpoint mid-life.
- Typed error tree (`src/errors.ts`) with 8 classes: Config / Auth / RateLimit / Server / NotFound / BadRequest / MalformedResponse / Unknown. Every error carries both English and Japanese text.
- Error parser handles both Rakuten response shapes (legacy `{error_description, error}` and new `{errors: {errorCode, errorMessage}}`).
- Retry-with-backoff on 429 and 5xx. `Retry-After` parsed as both numeric seconds and HTTP-date. Configurable via `RAKUTEN_MAX_RETRIES` (default 3).
- Streamable HTTP transport with 3-gate security (Host validation → Origin validation → Bearer auth). Refuses to bind to non-localhost without `MCP_HTTP_AUTH_TOKEN`.
- Bilingual EN/JA on every tool, prompt, resource, and Zod field. Required convention; CI-enforced.

### Fixed

- `prompts` and `resources` capabilities are no longer advertised when their registries are empty. Prior alpha advertised these but the SDK returns `-32601 Method not found` for the corresponding `list` methods, surfacing as noisy errors in client logs.

### Removed (vs prior 0.1.x)

- `get_product_reviews` — the underlying `/IchibaItem/Review/20220601` endpoint does not exist on Rakuten's API. Verified 2026-06-04 by direct probe (legacy host: `"Operation IchibaItem/Review doesn't exist"`; new host: 404). The 0.1.x tool was broken since launch.
- `ichiba_attribute_search` — was on the v1.0 plan; probes across three candidate version dates all returned `"Operation IchibaItem/AttributeSearch doesn't exist"`. The endpoint appeared in third-party API surveys but is not real.

### Build & dev

- Node 20+ (was 18+ in 0.1.x).
- Test stack: vitest 4 + msw 2 with recorded fixtures (no live API calls in CI).
- 169 unit tests across 7 test files.
- `scripts/smoke.mjs` — 28-tool live-API end-to-end check (~21s).
- `scripts/client-conformance.mjs` — full MCP protocol-conformance check mimicking Claude Desktop / Cursor / Cline load behaviour (16 checks).
- Build: tsup → ESM, target node20.
- Tarball: 32 KB compressed, 124 KB unpacked, 5 files shipped.
- Runtime deps: 2 (`@modelcontextprotocol/sdk`, `zod`).

### Documentation

- `AGENTS.md` rewritten for the post-migration reality (all endpoints on `openapi.rakuten.co.jp`, path-root patterns per family, conformance check workflow).
- `README.md` rewritten with the 28-tool surface.

---

## [1.0.0-alpha.0] — 2026-06-03

**Superseded by 1.0.0 and deprecated on npm.** This pre-release shipped against Rakuten's pre-migration Ichiba URLs (`app.rakuten.co.jp/services/api/IchibaItem/Search/20220601` etc.) which return `"specify valid applicationId"` against the new UUID-format credentials. Only the 5 Ichiba tools were registered; Books / Travel / Recipe / Kobo / GORA were not yet implemented.

## [0.2.0] — 2026-04-30

Previous published version on npm at the start of the v1.0 rewrite. Single-file architecture; see git history for details.

## [0.1.0–0.1.3] — 2026-04-14 to 2026-04-24

Initial launches. See git history.
