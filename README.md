# rakuten-mcp

[![npm version](https://img.shields.io/npm/v/rakuten-mcp.svg)](https://www.npmjs.com/package/rakuten-mcp)
[![npm downloads](https://img.shields.io/npm/dm/rakuten-mcp.svg)](https://www.npmjs.com/package/rakuten-mcp)
[![rakuten-mcp MCP server](https://glama.ai/mcp/servers/mrslbt/rakuten-mcp/badges/score.svg)](https://glama.ai/mcp/servers/mrslbt/rakuten-mcp)
[![MCP Badge](https://lobehub.com/badge/mcp/mrslbt-rakuten-mcp)](https://lobehub.com/mcp/mrslbt-rakuten-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Model Context Protocol server for the [Rakuten Web Service API](https://webservice.rakuten.co.jp/). 28 read-only tools across six Rakuten product families: Ichiba (marketplace), Books, Travel, Recipe, Kobo, and GORA (golf).

Every tool description ships in English and Japanese. Every endpoint was verified against the live Rakuten API on 2026-06-04 before release.

## Install

```bash
npm install -g rakuten-mcp
```

Or `npx rakuten-mcp` on demand.

## Configuration

1. Register at [Rakuten Web Service](https://webservice.rakuten.co.jp/).
2. Create an application. You get a UUID Application ID and a `pk_`-prefixed Access Key.
3. Optional: register an Affiliate ID to monetize product links. Item URLs in tool responses will carry it.

| Variable | Required | Description |
|---|---|---|
| `RAKUTEN_APP_ID` | yes | Application ID (UUID format on the new platform) |
| `RAKUTEN_ACCESS_KEY` | yes | Access Key (starts with `pk_`) |
| `RAKUTEN_AFFILIATE_ID` | no | Affiliate ID appended to every item URL |
| `RAKUTEN_MAX_RETRIES` | no | Retries on 429 / 5xx. Default 3. |

### Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rakuten": {
      "command": "npx",
      "args": ["-y", "rakuten-mcp"],
      "env": {
        "RAKUTEN_APP_ID": "your-app-id",
        "RAKUTEN_ACCESS_KEY": "your-access-key"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add rakuten -e RAKUTEN_APP_ID=... -e RAKUTEN_ACCESS_KEY=... -- npx -y rakuten-mcp
```

### Cursor / Cline / Continue

Same JSON shape as Claude Desktop, under each client's MCP config path.

## Tools

### Ichiba (5)

| Tool | What it does |
|---|---|
| `ichiba_item_search` | Keyword search on Rakuten Ichiba with price filters, sort, genre/shop restrictions. |
| `ichiba_genre_search` | Browse the genre tree. Returns current, ancestors, siblings, and children. |
| `ichiba_tag_search` | Look up a specific tag by ID. Returns the tag group and name. |
| `ichiba_item_ranking` | Bestseller ranking, overall or by genre / period / age / gender. |
| `ichiba_product_search` | Item Price Navi: same product across multiple sellers with min/max/avg price. |

### Books (9)

| Tool | What it does |
|---|---|
| `books_total_search` | Cross-category search across all of Rakuten Books. |
| `books_book_search` | Printed books by title, author, ISBN, publisher. |
| `books_cd_search` | Music CDs by title, artist, label, JAN. |
| `books_dvd_search` | DVDs / Blu-ray. |
| `books_foreign_book_search` | Non-Japanese books. Returns `japaneseTitle` when a translation exists. |
| `books_magazine_search` | Magazines by title, publisher, JAN. |
| `books_game_search` | Video games by title, hardware platform, JAN. |
| `books_software_search` | Computer software by title, OS, JAN. |
| `books_genre_search` | Browse the Books genre tree (`000` = top). |

### Travel (7)

| Tool | What it does |
|---|---|
| `travel_simple_hotel_search` | Hotels by area code or lat/lon. |
| `travel_vacant_hotel_search` | Hotels with rooms available on specific check-in / check-out dates. Returns plans with per-night and total pricing. |
| `travel_hotel_detail_search` | Full details for one hotel by `hotelNo`. |
| `travel_get_area_class` | The area-code hierarchy: 日本 → 47 prefectures → cities → districts. |
| `travel_keyword_hotel_search` | Free-text hotel search by name / landmark / area. |
| `travel_get_hotel_chain_list` | All 307 hotel chains registered on Rakuten Travel. |
| `travel_hotel_ranking` | Top hotels by ranking genre (all / onsen / ryokan / city / resort / business / pension / publichouse). |

### Recipe (2)

| Tool | What it does |
|---|---|
| `recipe_category_list` | The full Rakuten Recipe category tree (43 large → ~540 medium → ~1500 small). Pass `level` to fetch one tier. |
| `recipe_category_ranking` | Top recipes in a category with title, ingredient list, prep time, cost estimate, image, and author. |

### Kobo (2)

| Tool | What it does |
|---|---|
| `kobo_ebook_search` | Search Rakuten Kobo's eBook catalogue. Returns title, series, author, publisher, language code, price, and sale URL. |
| `kobo_genre_search` | Browse the Kobo genre tree. Top-level is `101` (電子書籍). |

### GORA (3)

| Tool | What it does |
|---|---|
| `gora_golf_course_search` | Golf courses by area code, keyword, or coordinates. |
| `gora_golf_course_detail` | Full course profile: designer, hole/par, course distance, green type, dress code, facilities, base prices. |
| `gora_plan_search` | Reservation plans on a specific play date. Returns per-plan prices, cart/caddie/lunch inclusions, player-count constraints. |

## Example queries

```
楽天で1万円以下のワイヤレスイヤホンを探して。レビュー4以上。
村上春樹の楽天Kobo電子書籍を新着順で。
東京駅近くのホテル、7月1〜2日、2名で1泊1万5千円以下の空室。
今週末東京近郊のゴルフ場で安いプランは？
楽天レシピで人気の鶏胸肉料理を5件、材料と所要時間込みで。
JANコード 4988601009447 のCDの取扱店舗。
```

## Architecture

Modular: one file per API family under `src/tools/`. Stdio and HTTP transports both supported. Typed error tree with 8 classes covering Config / Auth / RateLimit / Server / NotFound / BadRequest / MalformedResponse / Unknown. Retry-with-backoff on 429 and 5xx, parses `Retry-After` as both seconds and HTTP-date. See `AGENTS.md` for the architecture brief, conventions, and how to add a new tool.

## Safety

All 28 tools are read-only HTTP GETs against the Rakuten Web Service API. No tool creates, modifies, or deletes anything. Rakuten's [terms of service](https://webservice.rakuten.co.jp/documentation/) and rate limits apply. Returned items are promotional listings — verify prices and availability on Rakuten before acting on them.

## Disclaimer

Unofficial. Not affiliated with, endorsed by, or sponsored by Rakuten Group, Inc. Rakuten, Rakuten Ichiba, Rakuten Books, Rakuten Travel, Rakuten Recipe, Rakuten Kobo, and Rakuten GORA are trademarks of Rakuten Group, Inc. Use at your own risk.

## License

[MIT](LICENSE)
