# rakuten-mcp

[![npm version](https://img.shields.io/npm/v/rakuten-mcp.svg)](https://www.npmjs.com/package/rakuten-mcp)
[![npm downloads](https://img.shields.io/npm/dm/rakuten-mcp.svg)](https://www.npmjs.com/package/rakuten-mcp)
[![rakuten-mcp MCP server](https://glama.ai/mcp/servers/mrslbt/rakuten-mcp/badges/score.svg)](https://glama.ai/mcp/servers/mrslbt/rakuten-mcp)
[![MCP Badge](https://lobehub.com/badge/mcp/mrslbt-rakuten-mcp)](https://lobehub.com/mcp/mrslbt-rakuten-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Model Context Protocol server for the [Rakuten Web Service API](https://webservice.rakuten.co.jp/). Covers Rakuten Ichiba (marketplace), Rakuten Books, and Rakuten Travel.

## Install

```bash
npm install -g rakuten-mcp
```

Or run on demand with `npx rakuten-mcp`.

## Configuration

1. Sign in at [Rakuten Web Service](https://webservice.rakuten.co.jp/) and click **+ New App**.
2. Pick **Web Application** as the type, set Allowed Websites to `github.com` (and any other domain you'll send the `Origin` header from), and tick the API scopes you need (Ichiba, Books, Travel).
3. Copy the **Application ID** (UUID) and **Access Key** from the app dashboard.

| Variable | Required | Description |
|---|---|---|
| `RAKUTEN_APP_ID` | yes | Application ID (UUID format) |
| `RAKUTEN_ACCESS_KEY` | yes | Access Key (`pk_...`) |
| `RAKUTEN_ORIGIN` | no | Origin/Referer header sent with every request. Defaults to `https://github.com`. Must match one of the Allowed Websites you configured on the app. |

> **Note:** Rakuten migrated their API platform in 2026. Old-format numeric Application IDs no longer work. If you have a pre-2026 numeric app ID, you must register a new app to get the UUID + Access Key pair this server requires.

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

### Cursor

Add to `~/.cursor/mcp.json` with the same shape as Claude Desktop.

## Tools

| Tool | Description |
|---|---|
| `search_products` | Full-text product search with price filters, sorting, and pagination. |
| `get_genre_ranking` | Bestseller rankings, overall or by category. |
| `search_genres` | Browse the product category hierarchy. |
| `search_books` | Search Rakuten Books by title, author, or ISBN. |
| `search_travel` | Search hotels on Rakuten Travel by keyword. |
| `search_travel_vacancy` | Search available rooms with date, price, and location filters. |

## Prompts

| Prompt | Description |
|---|---|
| `search_products` | Search for products with optional price filters. |
| `compare_products` | Compare products sorted by reviews or price. |
| `category_bestsellers` | Bestseller ranking for a category. |
| `find_hotel` | Find hotels available on specific dates. |
| `budget_hotel` | Find hotels within a budget. |
| `find_book` | Search for a book by title, author, or ISBN. |
| `books_by_author` | Find all books by an author. |

## Resources

| Resource | URI | Description |
|---|---|---|
| Supported Genres | `rakuten://genres` | Top-level Rakuten Ichiba product categories. |

## Example queries

```
Find wireless earphones under ¥10,000 with good reviews.
楽天で1万円以下のワイヤレスイヤホンを探して。

What are the top sellers on Rakuten right now?
楽天の今の売れ筋ランキングを見せて。

Search for hotels in Kyoto on Rakuten Travel.
楽天トラベルで京都のホテルを探して。

Find available rooms near Tokyo Station for April 15-17 under ¥15,000.
東京駅近くで4月15〜17日、1万5千円以下の空室を探して。

Find books by Haruki Murakami on Rakuten Books.
村上春樹の本を楽天ブックスで探して。
```

## Safety

All tools in this server are read-only searches against the Rakuten Web Service API. No tool creates, modifies, or deletes any resource. Rakuten enforces a roughly 1 QPS rate limit per app ID; in practice this matches conversational MCP usage but rapid-fire batch calls will get HTTP 429 responses. Products and rankings returned by the API may be promotional; treat results as suggestions, not endorsements, and verify prices and availability on the Rakuten site before acting on them.

## Need a custom MCP?

I build production MCP servers and AI-native tooling for teams. If you'd like one tailored to your stack, reach out: [marselbait.me](https://marselbait.me) · marselbait@gmail.com.

## Disclaimer

This is an unofficial, community-built MCP server. Not affiliated with, endorsed by, or sponsored by Rakuten Group, Inc. Rakuten, Rakuten Ichiba, Rakuten Books, and Rakuten Travel are trademarks of Rakuten Group, Inc. Use at your own risk. The author accepts no liability for issues arising from misuse, prompt injection, or bugs.

## License

[MIT](LICENSE)
