# rakuten-mcp

[![rakuten-mcp MCP server](https://glama.ai/mcp/servers/mrslbt/rakuten-mcp/badges/score.svg)](https://glama.ai/mcp/servers/mrslbt/rakuten-mcp)

Model Context Protocol server for the [Rakuten Web Service API](https://webservice.rakuten.co.jp/). Covers Rakuten Ichiba (marketplace), Rakuten Books, and Rakuten Travel.

## Install

```bash
npm install -g rakuten-mcp
```

Or run on demand with `npx rakuten-mcp`.

## Configuration

1. Register at [Rakuten Web Service](https://webservice.rakuten.co.jp/).
2. Create an application to get an Application ID and Access Key.

| Variable | Required | Description |
|---|---|---|
| `RAKUTEN_APP_ID` | yes | Application ID |
| `RAKUTEN_ACCESS_KEY` | yes | Access Key |

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
| `get_product_reviews` | Read product reviews with rating and date sorting. |

## Prompts

| Prompt | Description |
|---|---|
| `search_products` | Search for products with optional price filters. |
| `compare_products` | Compare products sorted by reviews or price. |
| `category_bestsellers` | Bestseller ranking for a category. |
| `product_reviews` | Summarize reviews for a product. |
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

## License

[MIT](LICENSE)
