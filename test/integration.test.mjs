#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
const INFO = "\x1b[36m·\x1b[0m";
const SKIP = "\x1b[33m∘\x1b[0m";

let failures = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log(`${PASS} ${label}`);
  } else {
    failures++;
    console.log(`${FAIL} ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const hasKeys = !!(process.env.RAKUTEN_APP_ID && process.env.RAKUTEN_ACCESS_KEY);
const liveCalls = hasKeys && !process.env.SKIP_LIVE;

if (!hasKeys) {
  console.log(
    `${SKIP} RAKUTEN_APP_ID / RAKUTEN_ACCESS_KEY not set — running protocol-only checks (no live API calls).`
  );
}

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: {
    ...process.env,
    RAKUTEN_APP_ID: process.env.RAKUTEN_APP_ID ?? "00000000-0000-0000-0000-000000000000",
    RAKUTEN_ACCESS_KEY: process.env.RAKUTEN_ACCESS_KEY ?? "pk_dummy",
  },
});

const client = new Client(
  { name: "rakuten-integration-test", version: "1.0.0" },
  { capabilities: {} }
);

try {
  await client.connect(transport);
  console.log(`${PASS} Server connected`);

  // ── Tool surface ────────────────────────────────
  const toolsResp = await client.listTools();
  const toolNames = toolsResp.tools.map((t) => t.name).sort();
  console.log(`${INFO} tools: ${toolNames.join(", ")}`);

  const expected = [
    "search_products",
    "get_genre_ranking",
    "search_genres",
    "search_books",
    "search_travel",
    "search_travel_vacancy",
  ];
  for (const t of expected) {
    check(`tool registered: ${t}`, toolNames.includes(t));
  }
  check(
    "deprecated get_product_reviews removed",
    !toolNames.includes("get_product_reviews"),
    toolNames.includes("get_product_reviews") ? "still present" : undefined
  );

  // ── Prompt surface ──────────────────────────────
  const promptsResp = await client.listPrompts();
  const promptNames = promptsResp.prompts.map((p) => p.name).sort();
  for (const name of [
    "search_products",
    "compare_products",
    "category_bestsellers",
    "find_hotel",
    "budget_hotel",
    "find_book",
    "books_by_author",
  ]) {
    check(`prompt registered: ${name}`, promptNames.includes(name));
  }
  check(
    "deprecated product_reviews prompt removed",
    !promptNames.includes("product_reviews")
  );

  // ── Resource surface ────────────────────────────
  const resourcesResp = await client.listResources();
  const resourceUris = resourcesResp.resources.map((r) => r.uri);
  check(
    "resource registered: rakuten://genres",
    resourceUris.includes("rakuten://genres")
  );

  const genres = await client.readResource({ uri: "rakuten://genres" });
  const genresBody = JSON.parse(genres.contents[0].text);
  check(
    "rakuten://genres lists top-level categories",
    Array.isArray(genresBody.genres) && genresBody.genres.length > 0
  );

  // ── Live API calls ──────────────────────────────
  // Rakuten enforces ~1 QPS so we space calls out.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const RATE_DELAY_MS = 1500;

  if (liveCalls) {
    console.log(`${INFO} Running live API calls against Rakuten (1 QPS-paced)`);

    // 1. Ichiba item search
    const products = await client.callTool({
      name: "search_products",
      arguments: { keyword: "cat", hits: 1 },
    });
    if (products.isError) {
      console.log(`${INFO} search_products error: ${products.content[0]?.text}`);
    }
    check("search_products returned data", !products.isError);
    if (!products.isError) {
      const body = JSON.parse(products.content[0].text);
      check("search_products has items", Array.isArray(body.items) && body.items.length > 0);
      check("search_products totalCount > 0", body.totalCount > 0);
    }

    await sleep(RATE_DELAY_MS);

    // 2. Genre ranking
    const ranking = await client.callTool({
      name: "get_genre_ranking",
      arguments: { genreId: "0" },
    });
    if (ranking.isError) {
      console.log(`${INFO} get_genre_ranking error: ${ranking.content[0]?.text}`);
    }
    check("get_genre_ranking returned data", !ranking.isError);

    await sleep(RATE_DELAY_MS);

    // 3. Genre search
    const gsearch = await client.callTool({
      name: "search_genres",
      arguments: { genreId: "0" },
    });
    check("search_genres returned data", !gsearch.isError);

    await sleep(RATE_DELAY_MS);

    // 4. Books search
    const books = await client.callTool({
      name: "search_books",
      arguments: { keyword: "javascript", hits: 1 },
    });
    if (books.isError) {
      console.log(`${INFO} search_books error: ${books.content[0]?.text}`);
    }
    check("search_books returned data", !books.isError);

    await sleep(RATE_DELAY_MS);

    // 5. Travel hotel keyword search
    const hotels = await client.callTool({
      name: "search_travel",
      arguments: { keyword: "tokyo", hits: 1 },
    });
    if (hotels.isError) {
      console.log(`${INFO} search_travel error: ${hotels.content[0]?.text}`);
    }
    check("search_travel returned data", !hotels.isError);
    if (!hotels.isError) {
      const body = JSON.parse(hotels.content[0].text);
      check("search_travel has hotels", Array.isArray(body) && body.length > 0);
    }

    await sleep(RATE_DELAY_MS);

    // 6. Travel vacancy search (Tokyo coords, near-future dates)
    const today = new Date();
    const checkin = new Date(today.getTime() + 30 * 86400_000).toISOString().slice(0, 10);
    const checkout = new Date(today.getTime() + 31 * 86400_000).toISOString().slice(0, 10);
    const vacancy = await client.callTool({
      name: "search_travel_vacancy",
      arguments: {
        checkinDate: checkin,
        checkoutDate: checkout,
        latitude: 35.6812,
        longitude: 139.7671,
        searchRadius: 1,
        hits: 1,
      },
    });
    if (vacancy.isError) {
      console.log(`${INFO} search_travel_vacancy error: ${vacancy.content[0]?.text}`);
    }
    check("search_travel_vacancy returned data", !vacancy.isError);
  } else {
    console.log(`${SKIP} Live API calls skipped (no keys or SKIP_LIVE=1).`);
  }

  console.log(`${INFO} Closing client`);
  await client.close();
} catch (err) {
  console.log(`${FAIL} Unhandled error: ${err.message}`);
  failures++;
}

if (failures > 0) {
  console.log(`\n${FAIL} ${failures} check(s) failed`);
  process.exit(1);
}
console.log(`\n${PASS} All checks passed`);
process.exit(0);
