#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Rakuten migrated their API platform in early 2026.
// All endpoints now live under openapi.rakuten.co.jp under different
// namespaces. The new system requires Origin + Referer headers matching
// the "Allowed websites" configured on the app, and a UUID applicationId
// plus an accessKey query parameter (or accessKey header).
const ENDPOINTS = {
  ichibaItemSearch: "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401",
  ichibaItemRanking: "https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601",
  ichibaGenreSearch: "https://openapi.rakuten.co.jp/ichibagt/api/IchibaGenre/Search/20170711",
  booksTotalSearch: "https://openapi.rakuten.co.jp/services/api/BooksTotal/Search/20170404",
  booksBookSearch: "https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404",
  travelKeywordHotelSearch: "https://openapi.rakuten.co.jp/engine/api/Travel/KeywordHotelSearch/20170426",
  travelVacantHotelSearch: "https://openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426",
} as const;

function getAppId(): string {
  const appId = process.env.RAKUTEN_APP_ID;
  if (!appId) {
    throw new Error(
      "RAKUTEN_APP_ID not set. Get one free at https://webservice.rakuten.co.jp/"
    );
  }
  return appId;
}

function getAccessKey(): string {
  const key = process.env.RAKUTEN_ACCESS_KEY;
  if (!key) {
    throw new Error(
      "RAKUTEN_ACCESS_KEY not set. Get one free at https://webservice.rakuten.co.jp/"
    );
  }
  return key;
}

// The Origin/Referer must match a domain registered on the Rakuten app.
// Defaults to the project's GitHub repo. Override with RAKUTEN_ORIGIN when
// running an app whose Allowed Websites list does not include github.com.
function getOrigin(): string {
  return process.env.RAKUTEN_ORIGIN ?? "https://github.com";
}

async function rakutenRequest(
  endpointUrl: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  const appId = getAppId();
  const accessKey = getAccessKey();
  const origin = getOrigin();
  const searchParams = new URLSearchParams({
    applicationId: appId,
    accessKey,
    format: "json",
    ...params,
  });
  const url = `${endpointUrl}?${searchParams}`;
  const res = await fetch(url, {
    headers: {
      Origin: origin,
      Referer: origin,
    },
  });

  if (!res.ok) {
    const status = res.status;
    const body = await res.text();
    throw new Error(`Rakuten API error (HTTP ${status}) on ${endpointUrl}: ${body.slice(0, 200)}`);
  }

  const text = await res.text();
  if (!text) return { success: true };
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Rakuten API returned malformed JSON on ${endpointUrl}`);
  }
}

const server = new McpServer({
  name: "rakuten-mcp",
  version: "0.1.3",
});

// --- Tools ---

server.tool(
  "search_products",
  "Search for products on Rakuten Ichiba (Japan's largest e-commerce marketplace)",
  {
    keyword: z.string().describe("Search keyword (Japanese or English)"),
    hits: z
      .number()
      .min(1)
      .max(30)
      .default(10)
      .describe("Number of results (1-30)"),
    page: z.number().min(1).default(1).describe("Page number"),
    sort: z
      .enum([
        "standard",
        "+affiliateRate",
        "-affiliateRate",
        "+reviewCount",
        "-reviewCount",
        "+reviewAverage",
        "-reviewAverage",
        "+itemPrice",
        "-itemPrice",
        "+updateTimestamp",
        "-updateTimestamp",
      ])
      .default("standard")
      .describe("Sort order (prefix + for ascending, - for descending)"),
    minPrice: z.number().optional().describe("Minimum price in yen"),
    maxPrice: z.number().optional().describe("Maximum price in yen"),
  },
  async ({ keyword, hits, page, sort, minPrice, maxPrice }) => {
    const params: Record<string, string> = {
      keyword,
      hits: String(hits),
      page: String(page),
      sort,
    };
    if (minPrice !== undefined) params.minPrice = String(minPrice);
    if (maxPrice !== undefined) params.maxPrice = String(maxPrice);

    const data = (await rakutenRequest(
      ENDPOINTS.ichibaItemSearch,
      params
    )) as { count?: number; Items?: Array<{ Item: Record<string, unknown> }> };

    const items =
      data.Items?.map((i) => ({
        name: i.Item.itemName,
        price: i.Item.itemPrice,
        url: i.Item.itemUrl,
        shop: i.Item.shopName,
        reviewAverage: i.Item.reviewAverage,
        reviewCount: i.Item.reviewCount,
        imageUrl: (i.Item.mediumImageUrls as Array<{ imageUrl: string }>)?.[0]
          ?.imageUrl,
      })) ?? [];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { totalCount: data.count, items },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "get_genre_ranking",
  "Get the Rakuten Ichiba ranking (bestsellers), overall or by genre",
  {
    genreId: z
      .string()
      .default("0")
      .describe("Genre ID (0 for overall ranking)"),
  },
  async ({ genreId }) => {
    const data = (await rakutenRequest(ENDPOINTS.ichibaItemRanking, {
      genreId,
    })) as { Items?: Array<{ Item: Record<string, unknown> }> };

    const items =
      data.Items?.map((i) => ({
        rank: i.Item.rank,
        name: i.Item.itemName,
        price: i.Item.itemPrice,
        url: i.Item.itemUrl,
        shop: i.Item.shopName,
      })) ?? [];

    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
    };
  }
);

server.tool(
  "search_genres",
  "Browse Rakuten Ichiba product categories/genres",
  {
    genreId: z
      .string()
      .default("0")
      .describe("Parent genre ID (0 for top-level)"),
  },
  async ({ genreId }) => {
    const data = (await rakutenRequest(ENDPOINTS.ichibaGenreSearch, {
      genreId,
    })) as {
      current?: Record<string, unknown>;
      children?: Array<{ child: Record<string, unknown> }>;
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              current: data.current,
              children: data.children?.map((c) => c.child),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "search_books",
  "Search for books on Rakuten Books by title, author, or ISBN. For general keyword searches across all book categories, use keyword (routes to BooksTotal).",
  {
    title: z.string().optional().describe("Book title"),
    author: z.string().optional().describe("Author name"),
    isbn: z.string().optional().describe("ISBN code"),
    keyword: z.string().optional().describe("General keyword (uses cross-category search)"),
    hits: z.number().min(1).max(30).default(10).describe("Number of results"),
  },
  async ({ title, author, isbn, keyword, hits }) => {
    if (!title && !author && !isbn && !keyword) {
      return {
        content: [
          {
            type: "text",
            text: "Error: At least one search field is required (title, author, isbn, or keyword).",
          },
        ],
      };
    }

    const params: Record<string, string> = { hits: String(hits) };

    // keyword-only searches use BooksTotal (cross-category); specific fields use BooksBook
    const useTotal = !title && !author && !isbn && !!keyword;

    if (useTotal) {
      params.keyword = keyword!;
    } else {
      if (title) params.title = title;
      if (author) params.author = author;
      if (isbn) params.isbn = isbn;
    }

    const endpoint = useTotal
      ? ENDPOINTS.booksTotalSearch
      : ENDPOINTS.booksBookSearch;

    const data = (await rakutenRequest(endpoint, params)) as {
      Items?: Array<{ Item: Record<string, unknown> }>;
    };

    const items =
      data.Items?.map((i) => ({
        title: i.Item.title,
        author: i.Item.author,
        publisher: i.Item.publisherName,
        price: i.Item.itemPrice,
        isbn: i.Item.isbn,
        url: i.Item.itemUrl,
        imageUrl: i.Item.largeImageUrl,
        salesDate: i.Item.salesDate,
        reviewAverage: i.Item.reviewAverage,
      })) ?? [];

    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
    };
  }
);

server.tool(
  "search_travel",
  "Search for hotels on Rakuten Travel by keyword. For availability/date/price search, use search_travel_vacancy instead.",
  {
    keyword: z.string().describe("Search keyword (e.g., hotel name, area)"),
    hits: z.number().min(1).max(30).default(10).describe("Number of results"),
    page: z.number().min(1).default(1).describe("Page number"),
  },
  async ({ keyword, hits, page }) => {
    const data = (await rakutenRequest(
      ENDPOINTS.travelKeywordHotelSearch,
      { keyword, hits: String(hits), page: String(page) }
    )) as { hotels?: Array<{ hotel: Array<{ hotelBasicInfo: Record<string, unknown> }> }> };

    const hotels =
      data.hotels?.map((h) => {
        const info = h.hotel[0]?.hotelBasicInfo ?? {};
        return {
          name: info.hotelName,
          address: `${info.address1 ?? ""}${info.address2 ?? ""}`,
          price: info.hotelMinCharge,
          rating: info.reviewAverage,
          url: info.hotelInformationUrl,
          imageUrl: info.hotelImageUrl,
        };
      }) ?? [];

    return {
      content: [{ type: "text", text: JSON.stringify(hotels, null, 2) }],
    };
  }
);

server.tool(
  "search_travel_vacancy",
  "Search for available hotel rooms on Rakuten Travel by location, date, and price. Requires coordinates (lat/lng) or a hotel number for location.",
  {
    checkinDate: z.string().describe("Check-in date (YYYY-MM-DD)"),
    checkoutDate: z.string().describe("Check-out date (YYYY-MM-DD)"),
    latitude: z.number().optional().describe("Latitude (WGS84 decimal degrees, e.g., 35.6812)"),
    longitude: z.number().optional().describe("Longitude (WGS84 decimal degrees, e.g., 139.7671)"),
    searchRadius: z
      .number()
      .min(0.1)
      .max(3)
      .optional()
      .describe("Search radius in km (0.1-3, requires lat/lng)"),
    hotelNo: z.number().optional().describe("Specific Rakuten hotel number (alternative to coordinates)"),
    maxCharge: z.number().optional().describe("Maximum price per night in yen"),
    adultNum: z.number().min(1).max(10).default(1).describe("Number of adults (1-10)"),
    hits: z.number().min(1).max(30).default(10).describe("Number of results"),
  },
  async ({ checkinDate, checkoutDate, latitude, longitude, searchRadius, hotelNo, maxCharge, adultNum, hits }) => {
    const hasCoords = latitude !== undefined && longitude !== undefined;
    if (!hasCoords && hotelNo === undefined) {
      return {
        content: [
          {
            type: "text",
            text: "Error: A location is required. Provide either latitude+longitude or hotelNo.",
          },
        ],
      };
    }
    if (hasCoords && hotelNo !== undefined) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Provide either latitude+longitude or hotelNo, not both.",
          },
        ],
      };
    }

    const params: Record<string, string> = {
      checkinDate,
      checkoutDate,
      adultNum: String(adultNum),
      hits: String(hits),
    };
    if (hasCoords) {
      params.latitude = String(latitude);
      params.longitude = String(longitude);
      params.datumType = "1"; // WGS84 decimal degrees
    }
    if (hasCoords && searchRadius !== undefined) params.searchRadius = String(searchRadius);
    if (hotelNo !== undefined) params.hotelNo = String(hotelNo);
    if (maxCharge !== undefined) params.maxCharge = String(maxCharge);

    const data = (await rakutenRequest(
      ENDPOINTS.travelVacantHotelSearch,
      params
    )) as { hotels?: Array<{ hotel: Array<{ hotelBasicInfo?: Record<string, unknown>; roomInfo?: Array<{ roomBasicInfo?: Record<string, unknown>; dailyCharge?: Record<string, unknown> }> }> }> };

    const hotels =
      data.hotels?.map((h) => {
        const basic = h.hotel.find((entry) => entry.hotelBasicInfo)?.hotelBasicInfo ?? {};
        const room = h.hotel.find((entry) => entry.roomInfo)?.roomInfo?.[0];
        return {
          name: basic.hotelName,
          address: `${basic.address1 ?? ""}${basic.address2 ?? ""}`,
          price: room?.dailyCharge?.total ?? basic.hotelMinCharge,
          rating: basic.reviewAverage,
          url: basic.hotelInformationUrl,
          imageUrl: basic.hotelImageUrl,
          roomName: room?.roomBasicInfo?.roomName,
        };
      }) ?? [];

    return {
      content: [{ type: "text", text: JSON.stringify(hotels, null, 2) }],
    };
  }
);

// Note: get_product_reviews was removed when Rakuten retired the
// IchibaItem Review API in their 2026 platform migration. Reviews are
// still surfaced inline on each search_products result via reviewAverage
// and reviewCount, just no longer queryable individually.

// --- Prompts ---

server.prompt(
  "search_products",
  "Search for products on Rakuten Ichiba with optional price filters",
  {
    query: z.string().describe("What to search for"),
    maxPrice: z.string().optional().describe("Maximum price in yen"),
  },
  ({ query, maxPrice }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: maxPrice
            ? `Search Rakuten for "${query}" under ¥${maxPrice}`
            : `Search Rakuten for "${query}"`,
        },
      },
    ],
  })
);

server.prompt(
  "compare_products",
  "Compare products on Rakuten by searching and sorting by reviews or price",
  {
    query: z.string().describe("Product type to compare"),
    sortBy: z.enum(["reviews", "price_low", "price_high"]).describe("How to sort results"),
  },
  ({ query, sortBy }) => {
    const sortMap = { reviews: "-reviewCount", price_low: "+itemPrice", price_high: "-itemPrice" };
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Search Rakuten for "${query}" sorted by ${sortBy === "reviews" ? "most reviews" : sortBy === "price_low" ? "lowest price" : "highest price"} and compare the top results`,
          },
        },
      ],
    };
  }
);

server.prompt(
  "category_bestsellers",
  "Get the current bestseller ranking for a Rakuten product category",
  {
    category: z.string().describe("Product category (e.g., electronics, fashion, food)"),
  },
  ({ category }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Show me the current Rakuten bestseller ranking for ${category}`,
        },
      },
    ],
  })
);

server.prompt(
  "find_hotel",
  "Find available hotels on Rakuten Travel for specific dates",
  {
    location: z.string().describe("City or area name"),
    checkin: z.string().describe("Check-in date (YYYY-MM-DD)"),
    checkout: z.string().describe("Check-out date (YYYY-MM-DD)"),
  },
  ({ location, checkin, checkout }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Find available hotels in ${location} on Rakuten Travel from ${checkin} to ${checkout}`,
        },
      },
    ],
  })
);

server.prompt(
  "budget_hotel",
  "Find cheap hotels on Rakuten Travel within a budget",
  {
    location: z.string().describe("City or area name"),
    checkin: z.string().describe("Check-in date (YYYY-MM-DD)"),
    checkout: z.string().describe("Check-out date (YYYY-MM-DD)"),
    maxPrice: z.string().describe("Maximum price per night in yen"),
  },
  ({ location, checkin, checkout, maxPrice }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Find hotels in ${location} on Rakuten Travel from ${checkin} to ${checkout} under ¥${maxPrice} per night`,
        },
      },
    ],
  })
);

server.prompt(
  "find_book",
  "Search for a book on Rakuten Books",
  {
    query: z.string().describe("Book title, author, or ISBN"),
  },
  ({ query }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Search Rakuten Books for "${query}"`,
        },
      },
    ],
  })
);

server.prompt(
  "books_by_author",
  "Find all books by a specific author on Rakuten Books",
  {
    author: z.string().describe("Author name"),
  },
  ({ author }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Find all books by ${author} on Rakuten Books`,
        },
      },
    ],
  })
);

// --- Resources ---

server.resource(
  "supported-genres",
  "rakuten://genres",
  { description: "Top-level Rakuten Ichiba product categories", mimeType: "application/json" },
  async () => ({
    contents: [
      {
        uri: "rakuten://genres",
        mimeType: "application/json",
        text: JSON.stringify({
          note: "Use search_genres tool with genreId '0' to get the full live category tree. Common top-level genres:",
          genres: [
            { id: "100371", name: "パソコン・周辺機器 (Computers)" },
            { id: "100026", name: "本・雑誌・コミック (Books)" },
            { id: "100227", name: "食品 (Food)" },
            { id: "558885", name: "家電 (Electronics)" },
            { id: "100433", name: "ファッション (Fashion)" },
            { id: "101070", name: "インテリア・寝具 (Home & Living)" },
            { id: "100533", name: "スポーツ・アウトドア (Sports)" },
          ],
        }, null, 2),
      },
    ],
  })
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Rakuten MCP server running on stdio");
  if (!process.env.RAKUTEN_APP_ID || !process.env.RAKUTEN_ACCESS_KEY) {
    console.error("Warning: RAKUTEN_APP_ID and/or RAKUTEN_ACCESS_KEY not set. Tools will fail until configured. Get your keys at https://webservice.rakuten.co.jp/");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
