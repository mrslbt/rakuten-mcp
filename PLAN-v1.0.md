Acknowledging but skipping the task tool reminder — this is a single-deliverable research task being written as one long markdown report. I have everything I need.

Now writing the executable plan.

---

# rakuten-mcp v1.0 — Executable 3-Week Build Plan

## Executive summary

`rakuten-mcp` ships v1.0.0 in 3 weeks as a modular, fully-tested, bilingual MCP server covering **27 verified Rakuten Web Service endpoints** across Ichiba (7), Books (9), Travel (7), Recipe (2), Kobo (2), and GORA (3 — with 2 unverified versions noted as risks). The current single-file `src/index.ts` (628 LOC, 7 tools, version 0.1.3 in repo) is rewritten into a `~12-file` module tree with stdio + Streamable HTTP transports, typed Rakuten error mapping, 429/5xx retry-after backoff, vitest + msw fixtures (no live API in CI), and EN/JA bilingual tool descriptions. Distribution targets npm, the Official MCP Registry, Smithery, Glama, mcp.so, Cline marketplace, PulseMCP, LobeHub, and `punkpeye/awesome-mcp-servers`. **Critical risk identified**: the Item Review endpoint that the current code uses (`/IchibaItem/Review/20220601`) is no longer in the public Rakuten documentation index post-migration — `get_product_reviews` must be dropped or downgraded to "best effort, undocumented" before v1.0. Also: domain migration to `openapi.rakuten.co.jp` completes **2026-05-14** (already past), so the current `RAKUTEN_API_BASE = "https://app.rakuten.co.jp/services/api"` constant is already serving traffic on borrowed time — every endpoint must move to the new host before v1.0 ships.

---

## 1. File and module structure

Proposed layout under `/Users/marselbait/Desktop/code_related/MCP/rakuten-mcp/`:

```
rakuten-mcp/
├── src/
│   ├── index.ts                 # Entry point. Parses CLI args, picks transport (stdio default, --http for Streamable HTTP), wires server.
│   ├── server.ts                # Builds the McpServer instance, registers all tools/prompts/resources from registries.
│   ├── config.ts                # Loads + validates env (RAKUTEN_APP_ID, RAKUTEN_ACCESS_KEY, RAKUTEN_AFFILIATE_ID, optional HTTP port/host). Throws typed ConfigError on missing required vars.
│   ├── client.ts                # rakutenRequest() wrapper: URL building, query-string auth, fetch, JSON parse, retry-with-backoff, Retry-After header handling, error mapping.
│   ├── errors.ts                # Typed error classes (RakutenAuthError, RakutenRateLimitError, RakutenNotFoundError, RakutenServerError, RakutenValidationError, ConfigError) with bilingual EN/JA messages.
│   ├── auth.ts                  # Builds applicationId + accessKey headers/query, supports both query-string and header transport per Rakuten docs.
│   ├── i18n.ts                  # Bilingual string table {en, ja} for tool descriptions, prompt text, error messages. Single source of truth.
│   ├── transports/
│   │   ├── stdio.ts             # StdioServerTransport wiring.
│   │   └── http.ts              # Streamable HTTP transport (StreamableHTTPServerTransport from @modelcontextprotocol/sdk). Listens on RAKUTEN_MCP_PORT (default 3000).
│   ├── tools/
│   │   ├── types.ts             # ToolDefinition<Input, Output> interface, shared Zod helpers (paginationSchema, sortSchema), ToolHandler type.
│   │   ├── index.ts             # Tool registry — imports each family and exports a flat array consumed by server.ts.
│   │   ├── ichiba.ts            # 7 Ichiba tools (item_search, genre_search, tag_search, attribute_search, item_ranking, product_search, item_review*).
│   │   ├── books.ts             # 9 Books tools (total, book, cd, dvd, foreign, magazine, game, software, genre).
│   │   ├── travel.ts            # 7 Travel tools (simple_hotel, vacant_hotel, hotel_detail, area_class, keyword_hotel, hotel_chain_list, hotel_ranking).
│   │   ├── recipe.ts            # 2 Recipe tools (category_list, category_ranking).
│   │   ├── kobo.ts              # 2 Kobo tools (ebook_search, genre_search).
│   │   └── gora.ts              # 3 GORA tools (course_search, course_detail, plan_search).
│   ├── prompts/
│   │   ├── index.ts             # Prompt registry.
│   │   └── prompts.ts           # All 8+ bilingual prompts (existing 8 modernized + 2 new: find_recipe, find_golf_plan).
│   └── resources/
│       ├── index.ts             # Resource registry.
│       └── genres.ts            # rakuten://genres (Ichiba), rakuten://books-genres, rakuten://travel-areas, rakuten://kobo-genres.
├── test/
│   ├── setup.ts                 # msw server setup (beforeAll/afterEach/afterAll).
│   ├── fixtures/                # Recorded JSON fixtures per family.
│   │   ├── ichiba/
│   │   ├── books/
│   │   ├── travel/
│   │   ├── recipe/
│   │   ├── kobo/
│   │   └── gora/
│   ├── handlers/                # msw request handlers per family; map URLs to fixtures.
│   │   ├── ichiba.handlers.ts
│   │   ├── books.handlers.ts
│   │   ├── travel.handlers.ts
│   │   ├── recipe.handlers.ts
│   │   ├── kobo.handlers.ts
│   │   ├── gora.handlers.ts
│   │   └── errors.handlers.ts   # 401, 429, 500 simulators.
│   ├── client.test.ts           # rakutenRequest retry/backoff/auth.
│   ├── errors.test.ts           # Typed error mapping per status code.
│   ├── config.test.ts           # Env validation.
│   ├── ichiba.test.ts
│   ├── books.test.ts
│   ├── travel.test.ts
│   ├── recipe.test.ts
│   ├── kobo.test.ts
│   ├── gora.test.ts
│   └── server.test.ts           # End-to-end tool registration smoke test.
├── .github/
│   └── workflows/
│       ├── ci.yml               # lint, typecheck, vitest on push/PR.
│       └── release.yml          # On tag v*, build + npm publish + mcp-publisher publish.
├── AGENTS.md                    # Architecture, add-a-tool pattern, conventions.
├── CHANGELOG.md                 # Keep a Changelog format.
├── README.md                    # Updated for v1.0 — coverage table, transports, env vars, examples.
├── smithery.yaml                # Smithery deployment config.
├── server.json                  # MCP Registry manifest, bumped to v1.0.0.
├── glama.json                   # Already present.
├── llms.txt                     # SKIPPED for v1.0 (no website planned in 3 weeks).
├── vitest.config.ts
├── tsconfig.json
├── tsup.config.ts               # Replaces inline tsup args.
├── package.json                 # Version 1.0.0, scripts updated.
├── Dockerfile                   # Already present, minor updates.
└── LICENSE
```

Total: 12 source files + 3 transport/index files + tests + config. Counts: `src/` has 16 files; project root adds ~10.

---

## 2. Per-tool specs (27 tools, verified)

**Host migration note:** Every tool MUST use `https://openapi.rakuten.co.jp/...` — the old `app.rakuten.co.jp/services/api` was shut down 2026-05-14. The current code is already broken in production unless Rakuten kept the redirect; the v1.0 cutover is non-negotiable.

**Affiliate support pattern:** All endpoints accept optional `affiliateId`. Read from `process.env.RAKUTEN_AFFILIATE_ID` once in `config.ts` and inject in `client.ts` if present. No per-tool flag needed.

### 2.1 Ichiba family (7 tools)

#### `ichiba_item_search`
- **EN:** Search Rakuten Ichiba marketplace for products by keyword, shop, item code, or genre.
- **JA:** 楽天市場の商品をキーワード・ショップ・商品コード・ジャンルで検索します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401`
- **Required (one of):** `keyword` (string, UTF-8, ≤128 bytes), `shopCode` (string), `itemCode` (string), `genreId` (long).
- **Optional Zod:**
  ```ts
  z.object({
    keyword: z.string().optional(),
    shopCode: z.string().optional(),
    itemCode: z.string().optional(),
    genreId: z.string().optional(),
    hits: z.number().int().min(1).max(30).default(10),
    page: z.number().int().min(1).max(100).default(1),
    sort: z.enum(["standard","+itemPrice","-itemPrice","+reviewCount","-reviewCount","+reviewAverage","-reviewAverage","+affiliateRate","-affiliateRate","+updateTimestamp","-updateTimestamp"]).default("standard"),
    minPrice: z.number().int().optional(),
    maxPrice: z.number().int().optional(),
    availability: z.enum(["0","1"]).optional(),
    imageFlag: z.enum(["0","1"]).optional(),
    shipOverseasFlag: z.enum(["0","1"]).optional(),
    hasReviewFlag: z.enum(["0","1"]).optional(),
  }).refine(d => d.keyword || d.shopCode || d.itemCode || d.genreId, { message: "One of keyword/shopCode/itemCode/genreId is required" })
  ```
- **Response mapping:** `Items[].Item → { itemName, itemPrice, itemUrl, itemCode, shopName, shopCode, reviewAverage, reviewCount, imageUrl: mediumImageUrls[0].imageUrl, affiliateUrl, availability, taxFlag, postageFlag, pointRate }`. Plus top-level `count`, `page`, `hits`.
- **Affiliate:** Yes — pass through from env.
- **Migration gotcha:** Endpoint moved from `/services/api/IchibaItem/Search/20220601` to `/ichibams/api/IchibaItem/Search/20260401`. Path prefix changed (`ichibams` is new product line code). Response field `itemName` truncation rules changed in 2026-04-01 — verify against fixtures.

#### `ichiba_genre_search`
- **EN:** Browse the Rakuten Ichiba category tree by genre ID; returns ancestors, siblings, children.
- **JA:** 楽天市場のジャンル階層を取得します（親・兄弟・子ジャンル）。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/ichibagt/api/IchibaGenre/Search/20260401`
- **Required:** `genreId` (string, "0" for root).
- **Optional:** `formatVersion` (1|2), `elements`.
- **Response:** `{ genre, ancestors, siblings, children, attributes }`.
- **Affiliate:** Yes (optional, doesn't affect output meaningfully).
- **Migration gotcha:** Path changed from `/IchibaGenre/Search/20140222` to `/ichibagt/api/IchibaGenre/Search/20260401`. Response now includes `attributes` field.

#### `ichiba_tag_search`
- **EN:** Look up Rakuten Ichiba tags by tag ID (up to 10 comma-separated).
- **JA:** タグIDから楽天市場のタグ情報を取得します（最大10個）。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/ichibagt/api/IchibaTag/Search/20140222`
- **Required:** `tagId` (string or comma-separated string, max 10 values).
- **Optional:** `formatVersion`, `elements`.
- **Response:** `tagGroups[].tags[] → { tagId, tagName }`.
- **Affiliate:** Yes (optional).
- **Migration gotcha:** Version stayed at 20140222 but host moved to openapi.

#### `ichiba_attribute_search`
- **EN:** Get Rakuten Ichiba attribute definitions for a genre (e.g., color, size).
- **JA:** ジャンル内の属性情報（色・サイズなど）を取得します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/ichibagt/api/IchibaAttribute/Search/20260401`
- **Required:** `genreId` (string).
- **Optional:** `attributeId`, `formatVersion`, `elements`.
- **Response:** `items[] → { attributeId, nameJa }`.
- **Affiliate:** Yes (optional).
- **Migration gotcha:** New API in 2026-04-01 — wasn't in old codebase. Pure addition.

#### `ichiba_item_ranking`
- **EN:** Get top-selling items on Rakuten Ichiba, overall or filtered by genre/age/sex/period.
- **JA:** 楽天市場の売れ筋ランキングを取得します（ジャンル・年齢・性別・期間で絞り込み可）。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601`
- **Required:** none beyond auth.
- **Optional Zod:**
  ```ts
  z.object({
    genreId: z.string().optional(),
    age: z.enum(["10","20","30","40","50"]).optional(),
    sex: z.enum(["0","1"]).optional(), // 0=male 1=female
    carrier: z.enum(["0","1"]).default("0"), // 0=PC, 1=mobile
    period: z.enum(["realtime","daily","weekly"]).optional(),
    page: z.number().int().min(1).max(100).default(1),
  })
  ```
- **Response:** `Items[].Item → { rank, itemName, itemPrice, itemUrl, shopName, imageUrl, reviewAverage, reviewCount }`.
- **Affiliate:** Yes.
- **Migration gotcha:** Version 20220601 is still current — but host path moved from `/services/api/IchibaItem/Ranking/20220601` to `/ichibaranking/api/IchibaItem/Ranking/20220601`.

#### `ichiba_product_search` (Item Price Navi)
- **EN:** Search Rakuten's product catalog (Item Price Navi) — aggregates same product across shops with price comparison.
- **JA:** 楽天プロダクト（商品価格ナビ）で同一商品の最安値を横断検索します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/ichibaproduct/api/Product/Search/20250801`
- **Required (one of):** `keyword`, `genreId`, `productId`, `productCode`.
- **Optional Zod:**
  ```ts
  z.object({
    keyword: z.string().optional(),
    genreId: z.string().optional(),
    productId: z.string().optional(),
    productCode: z.string().optional(),
    hits: z.number().int().min(1).max(30).default(10),
    page: z.number().int().min(1).max(100).default(1),
    sort: z.enum(["standard","-satisfied"]).default("standard"),
    minPrice: z.number().int().optional(),
    maxPrice: z.number().int().optional(),
    orFlag: z.enum(["0","1"]).default("0"),
    genreInformationFlag: z.enum(["0","1"]).optional(),
  })
  ```
- **Response:** `Products[].Product → { productName, productNo, makerName, productPriceMin, productPriceMax, averagePrice, productCaption, productUrl, mediumImageUrl, reviewAverage, reviewCount, genreId }`.
- **Affiliate:** Yes.
- **Migration gotcha:** New endpoint not in old code. Use 20250801, not 20170426.

#### `ichiba_item_review` — **AT RISK, see Section 9**
- **EN:** Read recent reviews for a Rakuten Ichiba item.
- **JA:** 楽天市場の商品のレビューを取得します。
- **Endpoint candidate (UNVERIFIED in current docs):** `GET https://openapi.rakuten.co.jp/services/api/IchibaItem/Review/20220601`
- **Required:** `itemCode` (string, shop:itemId).
- **Optional:** `hits`, `page`, `sort` (`+reviewDate`, `-reviewDate`, `+reviewPoint`, `-reviewPoint`).
- **Response:** `reviews[].review → { reviewPoint, reviewTitle, reviewComment, reviewDate, nickName }`.
- **Affiliate:** No.
- **Migration gotcha (critical):** This endpoint **is no longer in the public Rakuten Web Service documentation index** (`/documentation/ichiba-item-review` returns 404). Two options for v1.0:
  - **(A) Drop the tool** and remove `get_product_reviews` from existing surface — clean v1.0 by dropping a deprecated API. Document in CHANGELOG as breaking change.
  - **(B) Keep as best-effort** — call the legacy URL, label tool description with `(deprecated)`, return graceful error if Rakuten returns 404/410.
  - **Recommendation: option (A)**. Don't ship v1.0 with an undocumented endpoint that may return 410 at any time.

### 2.2 Books family (9 tools)

All Books endpoints kept at version `20170404` per docs; host moved to `openapi.rakuten.co.jp/services/api/Books*/Search/20170404`. Migration gotcha: Books retained `/services/api/` path prefix unlike Ichiba family.

#### `books_total_search`
- **EN:** Cross-category search across Rakuten Books (books, CDs, DVDs, software, games, magazines).
- **JA:** 楽天ブックスの全カテゴリ横断検索（書籍・CD・DVD・ソフト・ゲーム・雑誌）。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/services/api/BooksTotal/Search/20170404`
- **Required (one of):** `keyword`, `booksGenreId`, `isbnjan`.
- **Optional:** `hits` (1-30, default 30 → set MCP default 10), `page` (1-100), `sort` (`standard`,`sales`,`+releaseDate`,`-releaseDate`,`+itemPrice`,`-itemPrice`,`reviewCount`,`reviewAverage`).
- **Response:** `Items[].Item → { title, author, publisherName, itemPrice, isbn, jan, itemUrl, largeImageUrl, salesDate, reviewAverage, reviewCount, itemCaption }`.
- **Affiliate:** Yes.
- **Gotcha:** `isbnjan` is a single field accepting either ISBN or JAN. The old code's `search_books` used `BooksBook/Search` and accepted `title`/`author`/`isbn` separately — keep that ergonomic split in the wrapper but route to `BooksTotal` when only `keyword` is given.

#### `books_book_search`
- **EN:** Search Rakuten Books for printed books by title, author, ISBN, publisher.
- **JA:** 楽天ブックスで紙書籍をタイトル・著者・ISBN・出版社で検索します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404`
- **Required (one of):** `title`, `author`, `publisherName`, `isbn`, `booksGenreId`, `keyword`.
- **Optional:** `hits`, `page`, `sort`, `outOfStockFlag` (0|1), `chirayomiFlag` (0|1 — preview).
- **Response:** Same field shape as Total but printed-book–specific extras (`size`, `seriesName`).
- **Affiliate:** Yes.
- **Gotcha:** None.

#### `books_cd_search`
- **EN:** Search Rakuten Books for CDs by title, artist, label, JAN.
- **JA:** 楽天ブックスで音楽CDをタイトル・アーティスト・レーベル・JANで検索します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/services/api/BooksCD/Search/20170404`
- **Required (one of):** `title`, `artistName`, `label`, `jan`, `booksGenreId`, `keyword`.
- **Optional:** `hits`, `page`, `sort`.
- **Response:** `{ title, artistName, label, jan, itemPrice, itemUrl, largeImageUrl, salesDate, reviewAverage, reviewCount }`.
- **Affiliate:** Yes.

#### `books_dvd_search`
- **EN:** Search Rakuten Books for DVDs and Blu-ray by title, label, JAN.
- **JA:** 楽天ブックスでDVD・ブルーレイをタイトル・レーベル・JANで検索します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/services/api/BooksDVD/Search/20170404`
- **Required (one of):** `title`, `artistName`, `label`, `jan`, `booksGenreId`, `keyword`.
- **Optional:** `hits`, `page`, `sort`.
- **Response:** Same as CD plus `bluRayFlag`.
- **Affiliate:** Yes.

#### `books_foreign_search`
- **EN:** Search Rakuten Books for foreign-language (non-Japanese) books.
- **JA:** 楽天ブックスで洋書を検索します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/services/api/BooksForeignBook/Search/20170404`
- **Required (one of):** `title`, `author`, `publisherName`, `isbn`, `booksGenreId`, `keyword`.
- **Optional:** `hits`, `page`, `sort`.
- **Response:** Standard books shape.
- **Affiliate:** Yes.

#### `books_magazine_search`
- **EN:** Search Rakuten Books for magazines by title, publisher, JAN, issue.
- **JA:** 楽天ブックスで雑誌をタイトル・出版社・JAN・号で検索します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/services/api/BooksMagazine/Search/20170404`
- **Required (one of):** `title`, `publisherName`, `jan`, `booksGenreId`, `keyword`.
- **Optional:** `hits`, `page`, `sort`.
- **Response:** `{ title, publisherName, magazineCode, itemPrice, itemUrl, largeImageUrl, salesDate, reviewAverage, reviewCount }`.
- **Affiliate:** Yes.

#### `books_game_search`
- **EN:** Search Rakuten Books for video games by title, hardware, JAN.
- **JA:** 楽天ブックスでゲームソフトをタイトル・対応機種・JANで検索します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/services/api/BooksGame/Search/20170404`
- **Required (one of):** `title`, `hardware` (e.g., "Nintendo Switch"), `jan`, `booksGenreId`, `keyword`.
- **Optional:** `hits`, `page`, `sort`.
- **Response:** `{ title, hardware, jan, itemPrice, itemUrl, largeImageUrl, salesDate, reviewAverage, reviewCount }`.
- **Affiliate:** Yes.

#### `books_software_search`
- **EN:** Search Rakuten Books for computer software by title, OS, JAN.
- **JA:** 楽天ブックスでPCソフトをタイトル・OS・JANで検索します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/services/api/BooksSoftware/Search/20170404`
- **Required (one of):** `title`, `os`, `jan`, `booksGenreId`, `keyword`.
- **Optional:** `hits`, `page`, `sort`.
- **Response:** `{ title, os, jan, itemPrice, itemUrl, largeImageUrl, salesDate, reviewAverage, reviewCount }`.
- **Affiliate:** Yes.

#### `books_genre_search`
- **EN:** Browse the Rakuten Books genre tree.
- **JA:** 楽天ブックスのジャンル階層を取得します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/services/api/BooksGenre/Search/20121128`
- **Required:** `booksGenreId` (string, "000" for root).
- **Optional:** `formatVersion`.
- **Response:** `{ current: { booksGenreId, booksGenreName, booksGenreLevel }, children: [{ child: { booksGenreId, booksGenreName, ... } }] }`.
- **Affiliate:** Yes (optional).
- **Gotcha:** Version 20121128, not 20170404. Don't typo.

### 2.3 Travel family (7 tools)

All on `openapi.rakuten.co.jp/engine/api/Travel/...`. No host migration impact here — Travel was always on `openapi.rakuten.co.jp` per the legacy code's `RAKUTEN_TRAVEL_API_BASE`.

#### `travel_simple_hotel_search`
- **EN:** Search Rakuten Travel hotels by area code or coordinates.
- **JA:** 楽天トラベルでエリアコード・緯度経度からホテルを検索します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/engine/api/Travel/SimpleHotelSearch/20170426`
- **Required (one of):** `largeClassCode`+`middleClassCode`(+optional `smallClassCode`,`detailClassCode`), `hotelNo` (comma-separated, max 15), or `latitude`+`longitude` (with `datumType`).
- **Optional Zod:**
  ```ts
  z.object({
    largeClassCode: z.string().optional(),
    middleClassCode: z.string().optional(),
    smallClassCode: z.string().optional(),
    detailClassCode: z.string().optional(),
    hotelNo: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    datumType: z.enum(["1","2"]).default("1"), // 1=WGS84 deg, 2=Tokyo deg
    searchRadius: z.number().min(0.1).max(3).optional(),
    hits: z.number().int().min(1).max(30).default(10),
    page: z.number().int().min(1).max(100).default(1),
    sort: z.enum(["standard","+roomCharge","-roomCharge"]).default("standard"),
    squeezeCondition: z.enum(["kinen","internet","daiyoku","onsen"]).optional(),
  })
  ```
- **Response:** `hotels[].hotel[].hotelBasicInfo → { hotelName, hotelKanaName, hotelMinCharge, latitude, longitude, address1, address2, telephoneNo, hotelImageUrl, hotelInformationUrl, reviewAverage, reviewCount, userReview }`.
- **Affiliate:** Yes.
- **Gotcha:** Lat/lng require `datumType`. Default to `1` (WGS84 decimal) — same convention as old code.

#### `travel_vacant_hotel_search`
- **EN:** Search Rakuten Travel for hotels with rooms available on specific dates.
- **JA:** 指定日に空室のあるホテルを楽天トラベルで検索します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426`
- **Required:** `checkinDate` (YYYY-MM-DD), `checkoutDate` (YYYY-MM-DD), AND one of (`hotelNo` | lat+lng+datumType | area codes).
- **Optional:** `adultNum` (1-10, default 2), `roomNum` (default 1), `maxCharge`, `minCharge`, `searchPattern` (0=facility, 1=plan), `squeezeCondition`, `hits`, `page`, `sort`.
- **Response:** `hotels[].hotel[]` with `hotelBasicInfo` and `roomInfo[].roomBasicInfo` + `dailyCharge.total`.
- **Affiliate:** Yes.
- **Gotcha:** Validation: exactly one of (hotelNo | coords | area-codes) must be provided. Throw RakutenValidationError otherwise.

#### `travel_hotel_detail_search`
- **EN:** Get detailed information about a specific Rakuten Travel hotel.
- **JA:** 楽天トラベルの特定ホテルの詳細情報を取得します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/engine/api/Travel/HotelDetailSearch/20170426`
- **Required:** `hotelNo` (string, single hotel number).
- **Optional:** `formatVersion`.
- **Response:** Full hotel record: `hotelBasicInfo`, `hotelRatingInfo`, `hotelDetailInfo`, `hotelFacilitiesInfo`, `hotelPolicyInfo`.
- **Affiliate:** Yes.
- **Gotcha:** Returns 404 if hotel doesn't exist — map to RakutenNotFoundError with bilingual message.

#### `travel_area_class`
- **EN:** Get the Rakuten Travel area-classification hierarchy (Japan → prefecture → city → area).
- **JA:** 楽天トラベルのエリア分類（日本→都道府県→市町村→エリア）を取得します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/engine/api/Travel/GetAreaClass/20140210`
- **Required:** none beyond auth.
- **Optional:** `formatVersion`, `elements`.
- **Response:** `areaClasses.largeClasses[] → { largeClassCode, largeClassName, middleClasses[] → { middleClassCode, middleClassName, smallClasses[] → ... } }`.
- **Affiliate:** No (this is taxonomy).
- **Gotcha:** Very large response (~MB). Strongly recommend caching for the MCP session — expose as `rakuten://travel-areas` resource and have the tool only fetch on demand.

#### `travel_keyword_hotel_search`
- **EN:** Search Rakuten Travel hotels by free-text keyword.
- **JA:** 楽天トラベルのホテルをキーワードで検索します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/engine/api/Travel/KeywordHotelSearch/20170426`
- **Required:** `keyword` (string, ≤128 bytes UTF-8).
- **Optional:** `largeClassCode`, `middleClassCode`, `hits`, `page`, `sort`, `squeezeCondition`.
- **Response:** Same shape as Simple Hotel Search.
- **Affiliate:** Yes.
- **Gotcha:** This is what the current `search_travel` tool maps to — keep that name as alias for back-compat? **Decision: rename to `travel_keyword_hotel_search` in v1.0; document as breaking change.**

#### `travel_hotel_chain_list`
- **EN:** List Rakuten Travel hotel chains (Marriott, APA, Hilton, etc.).
- **JA:** 楽天トラベル掲載のホテルチェーン一覧を取得します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/engine/api/Travel/GetHotelChainList/20131024`
- **Required:** none.
- **Optional:** `formatVersion`, `elements`.
- **Response:** `hotelChains[].hotelChain → { hotelChainCode, hotelChainName, hotelChainNameKana, comments }`.
- **Affiliate:** Yes (optional).
- **Gotcha:** Version 20131024 — oldest in the family. Stable, no plans to deprecate per docs.

#### `travel_hotel_ranking`
- **EN:** Get top-ranked hotels on Rakuten Travel by genre.
- **JA:** 楽天トラベルの人気ホテルランキングを取得します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/engine/api/Travel/HotelRanking/20170426`
- **Required:** none.
- **Optional:** `genre` (`all`|`onsen`|`premium`, default `all`), `carrier` (0|1, default 0).
- **Response:** `Items[].Item → { rank, hotelName, hotelInformationUrl, hotelMinCharge, reviewAverage, hotelImageUrl }`.
- **Affiliate:** Yes.
- **Gotcha:** No `page`/`hits` — fixed top-N.

### 2.4 Recipe family (2 tools)

Affiliate supported. No reviews/search endpoint — Recipe API only exposes categories + ranking.

#### `recipe_category_list`
- **EN:** Get Rakuten Recipe category hierarchy (large/middle/small categories).
- **JA:** 楽天レシピのカテゴリ階層（大・中・小カテゴリ）を取得します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/recipems/api/Recipe/CategoryList/20170426`
- **Required:** none.
- **Optional:** `categoryType` (`large`|`medium`|`small`), `formatVersion`, `elements`.
- **Response:** `result.large[] / result.medium[] / result.small[] → { categoryId, categoryName, categoryUrl, parentCategoryId? }`.
- **Affiliate:** Yes (optional).
- **Gotcha:** Large response — expose as `rakuten://recipe-categories` resource too.

#### `recipe_category_ranking`
- **EN:** Get the top recipes for a Rakuten Recipe category.
- **JA:** 楽天レシピのカテゴリ別人気ランキングを取得します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/recipems/api/Recipe/CategoryRanking/20170426`
- **Required:** none (omit `categoryId` for overall, supply `categoryId` for category-scoped).
- **Optional:** `categoryId` (format: `10` large, `10-276` medium, `10-276-824` small), `formatVersion`, `elements`.
- **Response:** `result[] → { recipeId, recipeTitle, recipeUrl, foodImageUrl, mediumImageUrl, smallImageUrl, pickup, shop, nickname, recipeDescription, recipeMaterial[], recipeIndication, recipeCost, recipePublishday, rank }`.
- **Affiliate:** Yes.
- **Gotcha:** `categoryId` format is hyphenated — validate with regex `^\d+(-\d+){0,2}$`.

### 2.5 Kobo family (2 tools)

#### `kobo_ebook_search`
- **EN:** Search Rakuten Kobo for eBooks by title, author, keyword, ISBN, or genre.
- **JA:** 楽天Koboで電子書籍をタイトル・著者・キーワード・ISBN・ジャンルで検索します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/services/api/Kobo/EbookSearch/20170426`
- **Required (one of):** `keyword`, `title`, `author`, `publisherName`, `itemNumber`, `koboGenreId`.
- **Optional:** `hits` (1-30), `page` (1-100), `sort` (`standard`|`+releaseDate`|`-releaseDate`|`+itemPrice`|`-itemPrice`|`reviewCount`|`reviewAverage`).
- **Response:** `Items[].Item → { title, author, publisherName, itemPrice, salesDate, itemUrl, largeImageUrl, reviewAverage, reviewCount, itemCaption, seriesName }`.
- **Affiliate:** Yes.
- **Gotcha:** `koboGenreId` defaults server-side to 101 (eBooks). Don't conflate with `booksGenreId`.

#### `kobo_genre_search`
- **EN:** Browse the Rakuten Kobo genre tree.
- **JA:** 楽天Koboのジャンル階層を取得します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/services/api/Kobo/GenreSearch/20170426`
- **Required:** none (omit `koboGenreId` for root).
- **Optional:** `koboGenreId`, `formatVersion`.
- **Response:** `{ current, children[] }` similar to Ichiba Genre Search shape.
- **Affiliate:** Yes (optional).

### 2.6 GORA family (3 tools)

Caveat: only Course Search has verified version (20170623). Course Detail and Plan Search versions could not be confirmed via the public docs page — see Section 9 risk register. Recommend hitting the API explorer (`https://webservice.rakuten.co.jp/explorer/api`) Week 1 to confirm versions before implementation.

#### `gora_golf_course_search`
- **EN:** Search Rakuten GORA golf courses by keyword, area, or coordinates.
- **JA:** 楽天GORAでゴルフ場をキーワード・エリア・緯度経度で検索します。
- **Endpoint:** `GET https://openapi.rakuten.co.jp/engine/api/Gora/GoraGolfCourseSearch/20170623`
- **Required (one of):** `keyword`, `areaCode`, `latitude`+`longitude`.
- **Optional Zod:**
  ```ts
  z.object({
    keyword: z.string().optional(),
    areaCode: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    searchRadius: z.number().optional(),
    hits: z.number().int().min(1).max(30).default(10),
    page: z.number().int().min(1).max(100).default(1),
    sort: z.enum(["standard","+reviewAverage","-reviewAverage","+reviewCount","-reviewCount"]).default("standard"),
  })
  ```
- **Response:** `Items[].Item → { golfCourseId, golfCourseName, golfCourseCaption, golfCourseImageUrl, golfCourseUrl, reviewAverage, reviewCount, areaName, prefecture }`.
- **Affiliate:** Yes.

#### `gora_golf_course_detail`
- **EN:** Get detailed info about a specific Rakuten GORA golf course.
- **JA:** 楽天GORAの特定ゴルフ場の詳細情報を取得します。
- **Endpoint (version unverified):** `GET https://openapi.rakuten.co.jp/engine/api/Gora/GoraGolfCourseDetail/[VERSION]`
- **Required:** `golfCourseId` (string).
- **Optional:** `formatVersion`.
- **Response:** Course detail (TBC against live API).
- **Affiliate:** Yes.
- **Gotcha:** Confirm version Week 1 — hit explorer with a known course ID.

#### `gora_golf_plan_search`
- **EN:** Search Rakuten GORA reservable plans by date and price.
- **JA:** 楽天GORAの予約可能プランを日付・料金で検索します。
- **Endpoint (version unverified):** `GET https://openapi.rakuten.co.jp/engine/api/Gora/GoraPlanSearch/[VERSION]`
- **Required:** at least one of `golfCourseId`, `keyword`, `areaCode`, `latitude`+`longitude`; AND `playDate` (YYYY-MM-DD).
- **Optional:** `playerNum` (1-4, default 1), `maxCharge`, `minCharge`, `cartFlag`, `caddieFlag`, `hits`, `page`, `sort`.
- **Response:** Plan records with `planName`, `planCharge`, `caddieFlag`, `cartFlag`, etc.
- **Affiliate:** Yes.
- **Gotcha:** Confirm version + exact field names Week 1.

### Tools dropped vs. existing surface
- `search_books` (existing) → split into `books_total_search` + `books_book_search` (orthogonal tools).
- `search_travel` → renamed `travel_keyword_hotel_search`.
- `search_travel_vacancy` → renamed `travel_vacant_hotel_search`.
- `get_product_reviews` → **dropped** (see Section 9).
- `get_genre_ranking` → renamed `ichiba_item_ranking`.
- `search_genres` → renamed `ichiba_genre_search`.
- `search_products` → renamed `ichiba_item_search`.

All renames documented in CHANGELOG as breaking (v0.x → v1.0).

### Final tool count: **27** (28 minus dropped item_review)

---

## 3. Implementation order — week-by-week

### Week 1 (2026-06-04 → 2026-06-10): Foundation + Ichiba

**Ship at end of week:** All 7 Ichiba tools working end-to-end on `openapi.rakuten.co.jp` with vitest+msw passing, modular structure in place, stdio transport, basic typed errors.

Concrete checklist:

- [ ] Day 1 (Wed): `npm install -D vitest msw @vitest/coverage-v8 tsx tsup typescript @types/node @modelcontextprotocol/sdk@latest zod`. Update `package.json` to v1.0.0-alpha.0. Add scripts: `test`, `test:watch`, `coverage`, `typecheck`, `lint`, `build`, `dev:stdio`, `dev:http`.
- [ ] Day 1: Create `src/config.ts` with strict env schema (Zod). `src/errors.ts` with all typed errors (full enum, Section 5). `src/i18n.ts` with stub bilingual table. `src/auth.ts` with header+query duo. `src/client.ts` with retry/backoff/Retry-After parsing.
- [ ] Day 1: Create `src/tools/types.ts` (`ToolDefinition` interface). `src/tools/index.ts` empty registry. `src/server.ts` building McpServer and iterating registry. `src/transports/stdio.ts`. `src/index.ts` entry.
- [ ] Day 1: Verify `npx tsx src/index.ts` boots, connects to stdio, exposes 0 tools, no crash.
- [ ] Day 2 (Thu): Implement `ichiba_item_search` end-to-end with bilingual description, full Zod schema, response mapper. Write `test/fixtures/ichiba/item_search_success.json` (record one real response from explorer), `test/fixtures/ichiba/item_search_no_results.json`, `test/handlers/ichiba.handlers.ts`. Write `test/ichiba.test.ts` covering: success, no-results, missing-required-param (Zod throws), keyword + minPrice combo, 401 auth error, 429 rate limit (retried then succeeds), 500 (retried then fails).
- [ ] Day 3 (Fri): Implement `ichiba_genre_search`, `ichiba_tag_search`, `ichiba_attribute_search`. Same fixture+handler+test pattern for each.
- [ ] Day 4 (Sat): Implement `ichiba_item_ranking`, `ichiba_product_search`. Decision time on `ichiba_item_review`: hit the legacy URL with real creds, log response. If 200 → ship as "deprecated, may break". If 4xx/5xx → drop. Document decision in CHANGELOG and AGENTS.md.
- [ ] Day 5 (Sun): Wire `src/transports/http.ts` (StreamableHTTPServerTransport). CLI flag `--http [port]`. Smoke test from curl. Confirm stdio still works in Claude Desktop.
- [ ] Day 6 (Mon): Set up `.github/workflows/ci.yml`. Push branch `v1.0-foundation`, open PR, confirm CI green. Tag `v1.0.0-alpha.0`, publish to npm with `--tag alpha`.

**Why Ichiba first:** It's the highest-traffic family, the existing tools rely on it, and it has the most recent (2026-04-01) API changes — flush out migration pain on the cluster you understand best.

### Week 2 (2026-06-11 → 2026-06-17): Books + Travel + transports hardening

**Ship at end of week:** 9 Books tools + 7 Travel tools live, HTTP transport tested, full error mapping spec implemented, test coverage > 80%.

- [ ] Day 1 (Wed): Implement all 9 Books tools (`books_total_search`, `books_book_search`, `books_cd_search`, `books_dvd_search`, `books_foreign_search`, `books_magazine_search`, `books_game_search`, `books_software_search`, `books_genre_search`). They share field schemas — extract `booksCommonSchema` helper. Record 9 success fixtures + 1 generic 404 fixture.
- [ ] Day 2 (Thu): Implement 4 Travel tools (`travel_simple_hotel_search`, `travel_keyword_hotel_search`, `travel_hotel_detail_search`, `travel_hotel_ranking`).
- [ ] Day 3 (Fri): Implement remaining 3 Travel tools (`travel_vacant_hotel_search`, `travel_area_class`, `travel_hotel_chain_list`). The vacant_hotel_search is the most complex — write 6 test cases (hotelNo path, coords path, area-codes path, missing-location validation error, maxCharge filter, no-vacancy result).
- [ ] Day 4 (Sat): Stress-test HTTP transport. Add `Origin` header validation (security per MCP spec for HTTP transport). Document `--http` flag in README.
- [ ] Day 5 (Sun): Verify rate-limit handling: simulate 5 rapid calls hitting 429, confirm backoff respects Retry-After header (parsed as both seconds and HTTP-date), confirm RakutenRateLimitError eventually thrown after N retries (default 3).
- [ ] Day 6 (Mon): Tag `v1.0.0-beta.0`, npm publish `--tag beta`. Test install from beta on a fresh laptop / Claude Desktop config.

**Why Books+Travel second:** Books endpoints are dense but parameter-similar (cheap to bulk-build). Travel is the second-most-used family (after Ichiba) and has the most surface area for bugs (date validation, coordinates, area codes).

### Week 3 (2026-06-18 → 2026-06-24): Recipe + Kobo + GORA + ship

**Ship at end of week:** All 27 tools live, docs done, registry submissions filed, v1.0.0 tagged and shipped Sun 2026-06-24.

- [ ] Day 1 (Wed): Implement Recipe (2), Kobo (2). Tight scope — 4 tools, ~3 hours.
- [ ] Day 2 (Thu): Implement GORA (3). FIRST hit the API explorer with each endpoint to confirm version numbers. If Course Detail/Plan Search versions are not discoverable, downgrade tools to "best effort" with a clear AGENTS.md note, or omit them from v1.0 and ship in v1.1.
- [ ] Day 3 (Fri): Write AGENTS.md (Section 6 brief). Update README.md (Section 8). Author CHANGELOG.md entries for v1.0.0. Write `smithery.yaml` (Section 7).
- [ ] Day 4 (Sat): Polish prompts (8 existing + 2 new for Recipe and Golf). Polish resources (add `rakuten://books-genres`, `rakuten://travel-areas`, `rakuten://kobo-genres`, `rakuten://recipe-categories`).
- [ ] Day 5 (Sun, ship day):
  - 09:00 — Final test run, typecheck, `npm run build`. Lock in commit.
  - 10:00 — Tag `v1.0.0`, push tag, GitHub Actions auto-publishes to npm + mcp-publisher.
  - 11:00 — File submissions to Glama (auto-rebuilds via `glama.json`), Smithery (push `smithery.yaml`), mcp.so, Cline marketplace (open issue with repo URL + 400×400 logo PNG), PulseMCP, LobeHub.
  - 13:00 — Open `awesome-mcp-servers` PR (Section 7).
  - 16:00 — Announce on X (@bymarselb), short thread: what shipped, install instructions, link to repo.
  - End-of-day — Verify v1.0.0 installable via `npx rakuten-mcp@latest`, runs cleanly in fresh Claude Desktop config.

**Why Recipe/Kobo/GORA last:** Smaller surface, well-isolated families, low coupling to anything else. If GORA proves unverifiable, drop to 24 tools and ship anyway — the bottom of the dependency tree should be the absorbing risk.

---

## 4. Test strategy

### vitest config (`vitest.config.ts`)

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/transports/**"],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
    testTimeout: 10000,
  },
});
```

### msw setup (`test/setup.ts`)

```ts
import { setupServer } from "msw/node";
import { beforeAll, afterAll, afterEach } from "vitest";
import { ichibaHandlers } from "./handlers/ichiba.handlers";
import { booksHandlers } from "./handlers/books.handlers";
import { travelHandlers } from "./handlers/travel.handlers";
import { recipeHandlers } from "./handlers/recipe.handlers";
import { koboHandlers } from "./handlers/kobo.handlers";
import { goraHandlers } from "./handlers/gora.handlers";

export const server = setupServer(
  ...ichibaHandlers, ...booksHandlers, ...travelHandlers,
  ...recipeHandlers, ...koboHandlers, ...goraHandlers,
);

beforeAll(() => {
  process.env.RAKUTEN_APP_ID = "test-app-id";
  process.env.RAKUTEN_ACCESS_KEY = "test-access-key";
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: "error"` is non-negotiable — any test that accidentally tries to reach the real API will fail loudly.

### Handler pattern (`test/handlers/ichiba.handlers.ts`)

```ts
import { http, HttpResponse } from "msw";
import itemSearchSuccess from "../fixtures/ichiba/item_search_success.json";
import itemSearchEmpty from "../fixtures/ichiba/item_search_empty.json";

export const ichibaHandlers = [
  http.get("https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401", ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get("keyword") === "nonsense_zzz") {
      return HttpResponse.json(itemSearchEmpty);
    }
    if (url.searchParams.get("applicationId") !== "test-app-id") {
      return HttpResponse.json({ error: "wrong_parameter" }, { status: 401 });
    }
    return HttpResponse.json(itemSearchSuccess);
  }),
  // ... per-endpoint handlers
];
```

### Per-file test coverage

- `client.test.ts`: retry on 429 with Retry-After (numeric + date), retry on 5xx, max-retries exhausted, network error wrapped, JSON parse failure, applicationId+accessKey injection, affiliateId injection from env.
- `errors.test.ts`: each status code maps to correct typed error, bilingual messages contain both EN and JA, error name field is stable.
- `config.test.ts`: missing app_id → ConfigError, missing access_key → ConfigError, optional affiliate_id absent OK, HTTP port default 3000.
- `ichiba.test.ts`: 7 tools × ~4 cases each = ~28 tests. Success path, validation error, no-results, auth error.
- `books.test.ts`: 9 tools × ~3 cases = ~27 tests.
- `travel.test.ts`: 7 tools × ~3 cases + extra for vacant_hotel_search (~25 tests).
- `recipe.test.ts`: 2 tools × ~3 cases = 6 tests.
- `kobo.test.ts`: 2 tools × ~3 cases = 6 tests.
- `gora.test.ts`: 3 tools × ~3 cases = 9 tests.
- `server.test.ts`: server registers exactly 27 tools, 10 prompts, 4 resources. Each tool has bilingual description (regex check). All Zod schemas parse a sample input. Tool names are unique.

**Total target: ~120 tests, coverage ≥ 80% lines.**

### CI workflow (`.github/workflows/ci.yml`)

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm" }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v4
        if: success()
        with: { token: ${{ secrets.CODECOV_TOKEN }} }
```

### Release workflow (`.github/workflows/release.yml`)

```yaml
name: Release
on:
  push: { tags: ["v*"] }
jobs:
  release:
    runs-on: ubuntu-latest
    permissions: { contents: write, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", registry-url: "https://registry.npmjs.org" }
      - run: npm ci
      - run: npm run build
      - run: npm publish --provenance --access public
        env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }
      - name: Publish to MCP Registry
        run: |
          curl -L -o mcp-publisher https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher-linux-amd64
          chmod +x mcp-publisher
          ./mcp-publisher login github --token ${{ secrets.GITHUB_TOKEN }}
          ./mcp-publisher publish --file=./server.json
```

**Zero live-API access in CI** — msw intercepts every fetch. `onUnhandledRequest: "error"` enforces it. Recording new fixtures is a manual local step (Section 6).

---

## 5. Error handling spec

### Error class hierarchy (`src/errors.ts`)

```ts
export class RakutenError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly messageJa: string;
  constructor(opts: { code: string; messageEn: string; messageJa: string; status?: number }) {
    super(opts.messageEn);
    this.name = "RakutenError";
    this.code = opts.code;
    this.status = opts.status;
    this.messageJa = opts.messageJa;
  }
}
export class ConfigError extends RakutenError {}
export class RakutenAuthError extends RakutenError {}        // 401
export class RakutenValidationError extends RakutenError {}  // 400, "wrong_parameter"
export class RakutenNotFoundError extends RakutenError {}    // 404, "notexist"
export class RakutenRateLimitError extends RakutenError {}   // 429
export class RakutenServerError extends RakutenError {}      // 5xx
export class RakutenTimeoutError extends RakutenError {}     // network timeout
export class RakutenNetworkError extends RakutenError {}     // fetch threw
```

### Status code mapping (in `client.ts`)

| HTTP | Rakuten `error` field | Class | Retry? | EN message | JA message |
|---|---|---|---|---|---|
| 400 | `wrong_parameter` | `RakutenValidationError` | No | "Invalid parameter sent to Rakuten API: `${detail}`" | "楽天APIへのパラメータが不正です: `${detail}`" |
| 401 | `wrong_parameter` (auth) | `RakutenAuthError` | No | "Rakuten API rejected your credentials. Check RAKUTEN_APP_ID and RAKUTEN_ACCESS_KEY at https://webservice.rakuten.co.jp/" | "楽天APIの認証に失敗しました。RAKUTEN_APP_IDとRAKUTEN_ACCESS_KEYを確認してください: https://webservice.rakuten.co.jp/" |
| 403 | `not_authorized` | `RakutenAuthError` | No | "This Rakuten app is not authorized for this endpoint. Re-register your app after the Feb-May 2026 migration." | "このアプリには本エンドポイントの利用権限がありません。2026年2〜5月の移行後にアプリの再登録が必要です。" |
| 404 | `notexist` | `RakutenNotFoundError` | No | "Resource not found on Rakuten: `${detail}`" | "楽天APIにリソースが見つかりません: `${detail}`" |
| 429 | — | `RakutenRateLimitError` | Yes (3x, respecting Retry-After) | "Rakuten API rate limit hit. Retried ${n} times. Try slowing down requests (≈1 QPS)." | "楽天APIのレート制限に達しました（${n}回リトライ後）。リクエスト頻度を下げてください（約1 QPS）。" |
| 500-599 | — | `RakutenServerError` | Yes (3x, exponential backoff 1s/2s/4s) | "Rakuten API server error (HTTP ${status}). Retried ${n} times." | "楽天APIサーバエラー (HTTP ${status})。${n}回リトライしました。" |
| timeout (10s) | — | `RakutenTimeoutError` | Yes (1x) | "Rakuten API request timed out after 10s." | "楽天APIへのリクエストが10秒でタイムアウトしました。" |

### Retry/backoff in `client.ts`

```ts
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

async function fetchWithRetry(url: string, attempt = 0): Promise<Response> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) throw new RakutenRateLimitError({ /* ... */ });
    const retryAfter = parseRetryAfter(res.headers.get("Retry-After")) ?? BASE_BACKOFF_MS * 2 ** attempt;
    await sleep(retryAfter);
    return fetchWithRetry(url, attempt + 1);
  }
  if (res.status >= 500 && res.status < 600) {
    if (attempt >= MAX_RETRIES) throw new RakutenServerError({ /* ... */ });
    await sleep(BASE_BACKOFF_MS * 2 ** attempt);
    return fetchWithRetry(url, attempt + 1);
  }
  return res;
}

function parseRetryAfter(h: string | null): number | null {
  if (!h) return null;
  const n = Number(h);
  if (!isNaN(n)) return n * 1000;
  const date = new Date(h);
  if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  return null;
}
```

### Config error messages (literal)

- Missing app_id: `RAKUTEN_APP_ID is not set. Get a free key at https://webservice.rakuten.co.jp/ and configure it via env. / RAKUTEN_APP_IDが設定されていません。https://webservice.rakuten.co.jp/ で無料のキーを取得して環境変数に設定してください。`
- Missing access_key: `RAKUTEN_ACCESS_KEY is not set. Get it from the same app dashboard where you got RAKUTEN_APP_ID. / RAKUTEN_ACCESS_KEYが設定されていません。RAKUTEN_APP_IDと同じアプリ管理画面で取得できます。`
- Invalid app_id format (Rakuten returns 401 even before the request lands): handled as `RakutenAuthError` with the bilingual reminder.

### Error surface in tool output

All `RakutenError` subclasses are caught in `server.ts` tool wrapper and returned as:
```ts
return { content: [{ type: "text", text: JSON.stringify({ error: { code, status, messageEn, messageJa } }, null, 2) }], isError: true };
```
This keeps the MCP `isError: true` flag set so calling agents know to surface, but the bilingual payload lets a Japanese-language agent surface the right text.

---

## 6. AGENTS.md content brief

Single file at repo root, ~250 lines.

### Sections

1. **Project overview** — One paragraph: rakuten-mcp is an MCP server exposing the public Rakuten Web Service API to LLMs. Stdio + Streamable HTTP transports. Read-only.
2. **Architecture** — Module tree (copy from Section 1). Data flow: `index.ts → server.ts → tools/* → client.ts → openapi.rakuten.co.jp`. Mention `i18n.ts` is the single source for bilingual strings.
3. **Setup** — `npm install`, env vars, `npm run dev:stdio` and `npm run dev:http`.
4. **How to add a new tool (canonical pattern)** — Step-by-step:
   1. Confirm the endpoint URL + version against https://webservice.rakuten.co.jp/documentation
   2. Pick the appropriate `src/tools/[family].ts` file
   3. Define the Zod schema (use shared `paginationSchema`, `sortSchema` where possible)
   4. Define the EN+JA description in `src/i18n.ts`
   5. Define the handler — always `await rakutenRequest(host, path, params)`, never construct fetch yourself
   6. Add response mapper — flatten Rakuten's nested `Items[].Item` shape to a flat object
   7. Export from family file, register in `src/tools/index.ts`
   8. Record a real success fixture: `RAKUTEN_APP_ID=… node scripts/record-fixture.mjs ichiba ItemSearch '?keyword=テスト'`
   9. Write tests: success, validation error, auth error, no-results
   10. Update README tool table
5. **Bilingual description requirement** — every tool MUST have `description.en` and `description.ja` in `i18n.ts`. Japanese MUST use natural product/service names (楽天市場, 楽天ブックス, 楽天トラベル). CI check verifies both fields exist for every registered tool.
6. **Test conventions** — vitest + msw. No live API calls in CI. To record a new fixture, use `scripts/record-fixture.mjs` (calls real API once with real creds, saves JSON to `test/fixtures/`). Fixtures are committed to git (sanitized: strip affiliate IDs and user-level data).
7. **Error conventions** — Always throw a typed `RakutenError` subclass. Never `throw new Error(...)`. Never swallow errors silently. Always include EN+JA messages.
8. **Transport conventions** — stdio is default. HTTP requires explicit `--http` flag, validates `Origin` header, binds to `127.0.0.1` by default (not `0.0.0.0`).
9. **Release process** —
   1. Bump version in `package.json` and `server.json`
   2. Update `CHANGELOG.md` (Keep a Changelog format)
   3. Open PR titled `chore(release): vX.Y.Z`
   4. After merge, tag `git tag vX.Y.Z && git push --tags`
   5. GitHub Actions auto-publishes to npm and MCP Registry
   6. Manually verify on Glama (rebuilds within ~30 min), Smithery, mcp.so
   7. Open `awesome-mcp-servers` PR if it's a major release
10. **Versioning** — Semver. v1.x guarantees: tool names, env var names, output shape. v2.0 reserved for breaking changes.
11. **Code style** — ESM-only, Node ≥18, no CJS, no default exports for tools, named exports only. `tsup` for build.
12. **Cadence** — Monthly minor release (1.1, 1.2, …) on the first Monday of each month; patch releases as needed.

---

## 7. Distribution checklist

### 1. npm
Already there. Bump from current `0.1.3` → `1.0.0` via GitHub Actions release workflow. Verify with `npm view rakuten-mcp version`. **Note:** the prompt mentions v0.2.0 on npm but the repo shows 0.1.3 — confirm published version with `npm view rakuten-mcp versions` Day 1.

### 2. Official MCP Registry
Already published at v0.1.3 per `server.json` (`io.github.mrslbt/rakuten-mcp`). Bump `version` to `1.0.0`, then:
```bash
mcp-publisher login github
mcp-publisher publish --file=./server.json
```
Or rely on GitHub Actions release workflow (sketched in Section 4).

### 3. Glama
Auto-indexes from `glama.json` (already present). After v1.0.0 publish, trigger rebuild by:
- Visiting https://glama.ai/mcp/servers/mrslbt/rakuten-mcp and clicking "Refresh" if available, or
- Updating any field in `glama.json` and pushing — Glama webhook picks it up

### 4. Smithery
**Smithery URL:** https://smithery.ai. Submission is by adding a `smithery.yaml` to the repo root and connecting via the Smithery dashboard (https://smithery.ai/server/new). Sketch of `smithery.yaml`:

```yaml
startCommand:
  type: stdio
  configSchema:
    type: object
    required: ["rakutenAppId", "rakutenAccessKey"]
    properties:
      rakutenAppId:
        type: string
        description: "Rakuten Application ID from https://webservice.rakuten.co.jp/"
      rakutenAccessKey:
        type: string
        description: "Rakuten Access Key from the same dashboard."
      rakutenAffiliateId:
        type: string
        description: "Optional. Affiliate ID for commission links."
  commandFunction: |
    (config) => ({
      command: "npx",
      args: ["-y", "rakuten-mcp"],
      env: {
        RAKUTEN_APP_ID: config.rakutenAppId,
        RAKUTEN_ACCESS_KEY: config.rakutenAccessKey,
        RAKUTEN_AFFILIATE_ID: config.rakutenAffiliateId || ""
      }
    })
```
Then go to https://smithery.ai/server/new and connect the GitHub repo.

### 5. mcp.so
Submission via the GitHub repo at https://github.com/chatmcp/mcp-server-submit (or the in-site form at https://mcp.so — currently returns 403 to scrapers, manual submission). Open issue or PR with: name, npm package, GitHub URL, description, category (`commerce`, `japan`, `search`).

### 6. Cline marketplace
Repo: **https://github.com/cline/mcp-marketplace**. Open a **new issue** with:
- GitHub repo URL: `https://github.com/mrslbt/rakuten-mcp`
- 400×400 PNG logo (create one — Rakuten red `#bf0000` background, white "楽" character)
- Confirm you tested install via README/llms-install.md (write `llms-install.md` Week 3 — 5-step install for Cline)

### 7. PulseMCP
PulseMCP auto-indexes from npm and the Official MCP Registry. After v1.0.0 lands on both, expect appearance within ~24h at https://www.pulsemcp.com/servers/mrslbt-rakuten. If not, submit manually at https://www.pulsemcp.com/submit.

### 8. LobeHub
Submit via https://lobehub.com/mcp/submit (form-based). Fields: server name, npm package, GitHub URL, EN+JA description, screenshot, category.

### 9. mcpmux
mcpmux auto-aggregates from the Official MCP Registry. No manual submission needed — confirm appearance at https://mcpmux.com/servers/io.github.mrslbt/rakuten-mcp after v1.0 publish.

### 10. awesome-mcp-servers
**Repo:** https://github.com/punkpeye/awesome-mcp-servers. Open PR adding rakuten-mcp under **Search & Data Extraction** (alphabetical) AND under **Travel & Transportation** (alphabetical) with cross-reference. Format (matches existing entries):
```markdown
- [mrslbt/rakuten-mcp](https://github.com/mrslbt/rakuten-mcp) 🇯🇵 - Rakuten Ichiba, Books, Travel, Recipe, Kobo, GORA — bilingual EN/JA, 27 tools.
```
Country flag emoji 🇯🇵 follows the convention. Keep description ≤ 100 chars.

### Submission day order (Sun 2026-06-24)
1. npm + Official MCP Registry (automated)
2. Glama rebuild trigger
3. Cline issue (manual, takes ~24-48h to review)
4. Smithery dashboard connection
5. mcp.so issue/form
6. LobeHub form
7. awesome-mcp-servers PR
8. (PulseMCP, mcpmux self-index — no action)

---

## 8. Documentation plan

### README.md new structure

```markdown
# rakuten-mcp
[badge: npm version] [badge: MCP Registry] [badge: Glama score] [badge: CI status] [badge: license MIT]

[One-sentence pitch in EN, then JA]

## Coverage
| Family | Tools | Endpoints |
|---|---|---|
| Rakuten Ichiba 楽天市場 | 7 | item, genre, tag, attribute, ranking, product, (review*) |
| Rakuten Books 楽天ブックス | 9 | total, book, cd, dvd, foreign, magazine, game, software, genre |
| Rakuten Travel 楽天トラベル | 7 | simple, vacant, detail, area, keyword, chain, ranking |
| Rakuten Recipe 楽天レシピ | 2 | category list, ranking |
| Rakuten Kobo 楽天Kobo | 2 | ebook, genre |
| Rakuten GORA 楽天GORA | 3 | course search, detail, plan |
| **Total** | **27 tools** | |

## Install
- npm/npx (Claude Desktop, Cursor, Cline, Continue)
- Smithery
- Glama

## Configuration
[env var table — RAKUTEN_APP_ID, RAKUTEN_ACCESS_KEY, RAKUTEN_AFFILIATE_ID (optional), RAKUTEN_MCP_PORT (HTTP transport)]

## Transports
- stdio (default)
- Streamable HTTP (`--http [port]`, default 3000, Origin validation)

## Quick start
[Claude Desktop JSON snippet]
[Claude Code CLI command]
[Cursor JSON snippet]
[Cline JSON snippet]

## Tools (27)
[Detailed table: name | EN description | JA description | endpoint]

## Prompts (10)
[Table]

## Resources (4)
[Table]

## Example queries (EN + JA pairs)
[~10 pairs covering each family]

## Affiliate links
[How RAKUTEN_AFFILIATE_ID is used; Rakuten ToS link]

## Rate limits
[~1 QPS, 429 handled with Retry-After]

## Migration note
[The Feb-May 2026 migration; if you used v0.x, your env vars still work but tool names changed — see CHANGELOG]

## Safety
[Read-only, no mutations, prompt-injection caveat]

## Contributing
[Link to AGENTS.md]

## Disclaimer
[Unofficial, not affiliated with Rakuten Group, Inc.]

## License
MIT
```

### CHANGELOG.md (Keep a Changelog format)

```markdown
# Changelog
All notable changes to rakuten-mcp will be documented here. Follows [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-06-24

### Added
- 20 new tools across Books (8 new), Travel (5 new), Recipe (2), Kobo (2), GORA (3)
- Bilingual EN/JA descriptions on every tool, prompt, and resource
- Streamable HTTP transport (`--http [port]`)
- Typed Rakuten error classes with bilingual messages
- 429 Retry-After backoff
- vitest + msw test suite (120+ tests, 80%+ coverage)
- AGENTS.md, CHANGELOG.md
- Smithery, Cline, LobeHub distribution

### Changed (BREAKING)
- All tool names renamed to `<family>_<action>` convention:
  - `search_products` → `ichiba_item_search`
  - `get_genre_ranking` → `ichiba_item_ranking`
  - `search_genres` → `ichiba_genre_search`
  - `search_books` → `books_total_search` / `books_book_search` (split)
  - `search_travel` → `travel_keyword_hotel_search`
  - `search_travel_vacancy` → `travel_vacant_hotel_search`
- All endpoints migrated from `app.rakuten.co.jp` to `openapi.rakuten.co.jp` (Rakuten domain shutdown 2026-05-14)
- Ichiba Item Search bumped to API version 2026-04-01

### Removed
- `get_product_reviews` tool — underlying `/IchibaItem/Review/20220601` endpoint is no longer in the public Rakuten Web Service documentation index post-migration

### Fixed
- Single-file architecture refactored into 12 modules
- Missing rate-limit handling
- No-op error from malformed JSON
```

### Bilingual description format/rules
- Both EN and JA in `i18n.ts`, never inline
- JA uses official product names (楽天市場 not "楽天マーケット")
- JA ends with です・ます form (polite) — never plain form
- EN is third-person imperative ("Search...", "Get..."), never first-person
- Same parameter info in both — no detail in EN that's missing in JA
- CI check: regex `description.en` and `description.ja` both present and non-empty for every tool

---

## 9. Risk register and mitigations

| Risk | Likelihood | Impact | Mitigation | Trigger to act |
|---|---|---|---|---|
| **Rakuten rate limit ~1 QPS unverified** — docs don't publish a concrete number; community says ~1 req/sec/app | High | Medium | Implement Retry-After honoring with 3 retries. Document in README that batch operations need throttling. | Hit 429 during fixture recording |
| **Domain migration aftermath** — May 14 was the cutoff, but Rakuten may have left redirects | High | Low (if we use new URLs) | Use ONLY `openapi.rakuten.co.jp`. Add CI check: grep for `app.rakuten.co.jp` in src/ and fail if found. | Source code references old host |
| **`IchibaItem/Review` endpoint not in current docs** | Confirmed | Medium | Drop the tool from v1.0. Document removal in CHANGELOG. If users complain, restore in v1.1 with "best effort" disclaimer. | Already triggered |
| **GORA Course Detail and Plan Search versions unknown** | Confirmed | Low | Day 1 Week 3: use the API explorer at https://webservice.rakuten.co.jp/explorer/api with a known course ID to confirm version strings. If not findable, ship v1.0 with only Course Search and add Detail+Plan in v1.1. | Cannot confirm by end of Week 3 Day 1 |
| **Rakuten ToS commercial use** | Medium | High | Add explicit "unofficial, not affiliated" disclaimer. Note that affiliate use requires separate Rakuten Affiliate (楽天アフィリエイト) registration. Treat all search results as suggestions, not endorsements. | Rakuten contacts us |
| **API deprecation post-1.0** — Rakuten can drop endpoints without notice | Medium | Medium | Subscribe to https://www.tumblr.com/rakuten-webservice (official news blog). Add monthly cron to manually check the docs index against the registered tool list. | Quarterly review |
| **`accessKey` header vs query param** — docs say "header or query parameter" | Low | Low | Send via query param (current behavior). Switch to header in v1.1 if Rakuten signals preference. | Rakuten releases header-only requirement |
| **MCP Registry submission collision** | Low | Low | `io.github.mrslbt/rakuten-mcp` already claimed by current account. Same GitHub identity, no conflict. | N/A |
| **npm package name squatting** | Low | Low | Already owns `rakuten-mcp` — keep ownership active. | N/A |
| **Fixture recording requires live creds** | Confirmed | Low | Document in AGENTS.md. Provide `scripts/record-fixture.mjs` that uses real creds locally only. Never check in real creds. | Setup time only |
| **Affiliate URL personal data leakage** | Low | Medium | Recorded fixtures must sanitize `affiliateUrl` and `affiliateId` fields. Add to fixture-recording script. | Before any fixture commit |
| **HTTP transport DNS rebinding** | Low | High | Bind to `127.0.0.1` only by default. Validate `Origin` header. Document risk in README. | Default `0.0.0.0` would trigger |
| **Single maintainer bus factor** | High | High | Document everything in AGENTS.md so a Claude Code session can pick up the project cold. License MIT so anyone can fork. | Marsel unavailable >1 week |

---

## 10. v1.0.0 acceptance criteria

Ship when every box is checked:

- [ ] **Coverage:** 27 tools registered (Ichiba 6 if review dropped, Books 9, Travel 7, Recipe 2, Kobo 2, GORA 3)
- [ ] **Hosts:** Every endpoint targets `openapi.rakuten.co.jp`; CI grep for `app.rakuten.co.jp` returns nothing
- [ ] **Bilingual:** Every tool/prompt/resource has non-empty `description.en` + `description.ja` in `i18n.ts`; CI check enforces this
- [ ] **Tests:** ≥ 120 tests passing; `vitest --coverage` reports ≥ 80% line coverage; `onUnhandledRequest: "error"` set in msw
- [ ] **Typing:** `tsc --noEmit` clean; no `any` outside of Rakuten response intermediate types
- [ ] **Errors:** All 7 typed error classes implemented; 429 Retry-After parsed correctly (numeric + HTTP-date); CI tests cover each status mapping
- [ ] **Transports:** stdio confirmed in Claude Desktop fresh install; `--http 3000` confirmed via curl with Origin validation
- [ ] **Build:** `tsup` produces single `dist/index.js` with correct shebang; `node dist/index.js` boots without crash even without env vars (warns then waits for stdio)
- [ ] **README:** New structure complete; coverage table accurate; install snippets for Claude Desktop, Claude Code CLI, Cursor, Cline; bilingual examples present
- [ ] **AGENTS.md:** Architecture + add-a-tool + release-process sections complete
- [ ] **CHANGELOG.md:** v1.0.0 entry written, BREAKING marked, every renamed tool listed
- [ ] **server.json:** Version `1.0.0`; `mcpName` unchanged; passes `mcp-publisher publish --dry-run`
- [ ] **smithery.yaml:** Present, validates against Smithery schema
- [ ] **Logo:** 400×400 PNG committed under `assets/logo.png` (for Cline submission)
- [ ] **CI:** `.github/workflows/ci.yml` green on main; `release.yml` triggers on tag
- [ ] **Distribution:** npm published; MCP Registry confirms v1.0.0 visible at `https://registry.modelcontextprotocol.io/v0/servers/io.github.mrslbt/rakuten-mcp`; Glama score visible; Cline marketplace issue opened; awesome-mcp-servers PR opened; Smithery server visible; mcp.so submission filed
- [ ] **Manual smoke test:** Fresh Claude Desktop config + `npx rakuten-mcp@1.0.0` + real RAKUTEN_APP_ID returns successful results for: search "イヤホン", get Ichiba ranking, search hotels in Kyoto, search Murakami books — all under 10s per call
- [ ] **Announce:** X thread from @bymarselb posted; LinkedIn post draft ready

---

## First 90 minutes — literal commands

Run from `/Users/marselbait/Desktop/code_related/MCP/rakuten-mcp/` in a fresh Claude Code session.

```bash
# 0-5 min: branch off main and confirm baseline
git checkout -b v1.0-foundation
git status
npm view rakuten-mcp version    # confirm what's currently on npm (likely 0.1.3 or 0.2.0)
node -v                          # confirm >=18

# 5-15 min: install new dev dependencies and bump package.json
npm install -D vitest msw @vitest/coverage-v8 tsx tsup typescript @types/node
npm install @modelcontextprotocol/sdk@latest zod@latest
```

Edit `package.json`:
- `version`: `"1.0.0-alpha.0"`
- `scripts`: add
  ```json
  "test": "vitest run",
  "test:watch": "vitest",
  "coverage": "vitest run --coverage",
  "typecheck": "tsc --noEmit",
  "lint": "tsc --noEmit",
  "dev:stdio": "tsx src/index.ts",
  "dev:http": "tsx src/index.ts --http 3000",
  "build": "tsup src/index.ts --format esm --target node20 --clean --shims",
  "prepublishOnly": "npm run build"
  ```

```bash
# 15-25 min: scaffold new directory structure
mkdir -p src/transports src/tools src/prompts src/resources
mkdir -p test/fixtures/ichiba test/fixtures/books test/fixtures/travel test/fixtures/recipe test/fixtures/kobo test/fixtures/gora
mkdir -p test/handlers
mkdir -p .github/workflows
mkdir -p scripts
mkdir -p assets

# 25-30 min: move old src out of the way
git mv src/index.ts src/_legacy_index.ts.bak
```

Now create these files in order (use Write or Edit):

1. **`src/config.ts`** (15 min) — Zod env schema with `RAKUTEN_APP_ID`, `RAKUTEN_ACCESS_KEY`, optional `RAKUTEN_AFFILIATE_ID`, optional `RAKUTEN_MCP_PORT` (default 3000). Export `getConfig()` that throws `ConfigError` on missing.

2. **`src/errors.ts`** (10 min) — All 8 error classes per Section 5. Each takes `{code, messageEn, messageJa, status?}`.

3. **`src/i18n.ts`** (5 min) — Empty bilingual table object, will fill per-tool as we go. Type:
   ```ts
   export type Bilingual = { en: string; ja: string };
   export const t: Record<string, Bilingual> = {};
   ```

4. **`src/auth.ts`** (5 min) — Reads config, returns `{ applicationId, accessKey, affiliateId? }`.

5. **`src/client.ts`** (20 min) — `rakutenRequest(host, path, params)` per Section 5 with retry/backoff/Retry-After.

```bash
# After ~75 min, smoke test
mkdir -p test
```

6. **`src/tools/types.ts`** (5 min):
   ```ts
   import { z } from "zod";
   export interface ToolDefinition<Schema extends z.ZodTypeAny> {
     name: string;
     description: { en: string; ja: string };
     schema: Schema;
     handler: (input: z.infer<Schema>) => Promise<unknown>;
   }
   ```

7. **`src/tools/index.ts`** (1 min): `export const tools = [];`

8. **`src/server.ts`** (10 min) — Build McpServer, iterate `tools`, register each via `server.tool()` with `description.en` (English primary). For each tool, wrap handler in try/catch that maps `RakutenError` → `{ content: [...], isError: true }`.

9. **`src/transports/stdio.ts`** + **`src/index.ts`** (5 min) — entry point.

```bash
# 80-90 min: confirm it boots
npx tsx src/index.ts
# Should print "Rakuten MCP server running on stdio" and wait. Ctrl-C.

# Commit foundation
git add -A
git commit -m "scaffold v1.0 modular structure"
git push -u origin v1.0-foundation
```

You now have an empty but well-typed foundation. Day 2 begins with `src/tools/ichiba.ts` and the first tool, `ichiba_item_search`, using the spec from Section 2.1.

---

## Findings worth flagging

- **The current `RAKUTEN_API_BASE = "https://app.rakuten.co.jp/services/api"` in `src/index.ts:7` is on the deprecated host that was shut down 2026-05-14.** The published 0.1.3 npm package may be broken in production. This is the single most urgent thing to fix — even a v0.2.1 hotfix moving the constant to `openapi.rakuten.co.jp` would buy time before the v1.0 ship.
- **`/IchibaItem/Review/20220601` is no longer in the public Rakuten docs index.** It returns 404 when you try to view its doc page. The endpoint may still respond on the API host but is officially undocumented — risky to ship in a v1.0.
- **GORA Course Detail and Plan Search version numbers could not be verified from the public docs page.** Recommend hitting the API explorer at https://webservice.rakuten.co.jp/explorer/api Week 3 Day 1 before implementing.
- **`server.json` is at v0.1.3 (file:** `/Users/marselbait/Desktop/code_related/MCP/rakuten-mcp/server.json`**), but the user message states "v0.2.0 on npm".** Run `npm view rakuten-mcp version` Day 1 to confirm what's actually live before bumping.
- **Existing repo files to preserve:** `LICENSE` (MIT), `Dockerfile`, `glama.json`, `.gitignore`, `.env.example`. Keep all.
- **Path verified:** `/Users/marselbait/Desktop/code_related/MCP/rakuten-mcp/src/index.ts` is the single 628 LOC file that becomes the legacy reference during the rewrite.

Sources for verification:
- [Rakuten Web Service API index](https://webservice.rakuten.co.jp/documentation)
- [Ichiba Item Search 2026-04-01](https://webservice.rakuten.co.jp/documentation/ichiba-item-search)
- [Ichiba Genre Search 2026-04-01](https://webservice.rakuten.co.jp/documentation/ichiba-genre-search)
- [Ichiba Attribute Search 2026-04-01](https://webservice.rakuten.co.jp/documentation/ichiba-attribute-search)
- [Ichiba Tag Search 2014-02-22](https://webservice.rakuten.co.jp/documentation/ichiba-tag-search)
- [Ichiba Item Ranking 2022-06-01](https://webservice.rakuten.co.jp/documentation/ichiba-item-ranking)
- [Ichiba Product Search 2025-08-01](https://webservice.rakuten.co.jp/documentation/ichiba-product-search)
- [Books Total Search 2017-04-04](https://webservice.rakuten.co.jp/documentation/books-total-search)
- [Travel Simple Hotel Search 2017-04-26](https://webservice.rakuten.co.jp/documentation/simple-hotel-search)
- [Travel Vacant Hotel Search 2017-04-26](https://webservice.rakuten.co.jp/documentation/vacant-hotel-search)
- [Travel Hotel Detail Search 2017-04-26](https://webservice.rakuten.co.jp/documentation/hotel-detail-search)
- [Travel Get Area Class 2014-02-10](https://webservice.rakuten.co.jp/documentation/get-area-class)
- [Travel Get Hotel Chain List 2013-10-24](https://webservice.rakuten.co.jp/documentation/get-hotel-chain-list)
- [Travel Hotel Ranking 2017-04-26](https://webservice.rakuten.co.jp/documentation/hotel-ranking)
- [Recipe Category List 2017-04-26](https://webservice.rakuten.co.jp/documentation/recipe-category-list)
- [Recipe Category Ranking 2017-04-26](https://webservice.rakuten.co.jp/documentation/recipe-category-ranking)
- [Kobo eBook Search 2017-04-26](https://webservice.rakuten.co.jp/documentation/kobo-ebook-search)
- [GORA Golf Course Search 2017-06-23](https://webservice.rakuten.co.jp/documentation/gora-golf-course-search)
- [Official MCP Registry quickstart](https://modelcontextprotocol.io/registry/quickstart)
- [Cline MCP Marketplace](https://github.com/cline/mcp-marketplace)
- [punkpeye/awesome-mcp-servers contributing](https://github.com/punkpeye/awesome-mcp-servers/blob/main/CONTRIBUTING.md)
- [Smithery docs](https://smithery.ai/docs/config#smitheryyaml)
---

# CORRECTIONS (added 2026-06-04 after verification probes)

The agent's plan was largely correct, but three claims were unverified or wrong. Replacing them:

## Correction 1: "migrate everything to openapi.rakuten.co.jp" → per-endpoint host config

**Verified via curl probes against both hosts:**
- Old host `app.rakuten.co.jp` is alive and serving valid 400 errors today. NOT shut down.
- New host `openapi.rakuten.co.jp` has Books migrated (`/services/api/BooksTotal/`) and Travel on `/engine/api/`, but Ichiba and Recipe return 404 at `/services/api/...` paths.
- No official Rakuten migration announcement found on docs or main page.

**Plan change:** Keep per-endpoint host config (which the current code already does correctly). Add a `RAKUTEN_API_HOST_OVERRIDE` env var as an escape hatch in case Rakuten silently moves an endpoint mid-life.

## Correction 2: error response format differs between hosts

**Verified:**
- Old host returns: `{"error_description":"specify valid applicationId","error":"wrong_parameter"}`
- New host returns: `{"errors":{"errorCode":400,"errorMessage":"accessKey must be present..."}}`

**Plan change:** `src/client.ts` must parse BOTH error formats. `src/errors.ts` maps both shapes to the same typed errors.

## Correction 3: drop acceptance criterion #2

**Original:** "CI grep for `app.rakuten.co.jp` returns nothing"

**Plan change:** DROP this criterion. The old host is the canonical home for Ichiba and Recipe today. Banning the string would force an incorrect migration.

## Smoke test gate (NEW, before Week 1 ends)

Before tagging `v1.0.0-alpha.0`:
- [ ] Run rakuten-mcp against the real API with valid `RAKUTEN_APP_ID` + `RAKUTEN_ACCESS_KEY`
- [ ] Confirm every implemented tool returns parseable data on both hosts
- [ ] Log the host actually used per tool — record in CHANGELOG so future debugging is trivial
