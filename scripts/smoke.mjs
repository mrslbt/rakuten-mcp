#!/usr/bin/env node

/**
 * End-to-end smoke test against the live Rakuten API.
 *
 * Spawns `node dist/index.js` as a child process, drives the MCP
 * protocol via stdio, calls each of the 5 Ichiba tools with real
 * credentials, and reports whether each one returns parseable data.
 *
 * Run:
 *   RAKUTEN_APP_ID=... RAKUTEN_ACCESS_KEY=... RAKUTEN_AFFILIATE_ID=... \
 *     node scripts/smoke.mjs
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(HERE, "..", "dist", "index.js");

if (!process.env.RAKUTEN_APP_ID || !process.env.RAKUTEN_ACCESS_KEY) {
  console.error("ERROR: RAKUTEN_APP_ID and RAKUTEN_ACCESS_KEY must be set.");
  process.exit(2);
}

const child = spawn("node", [BIN], {
  stdio: ["pipe", "pipe", "inherit"],
  env: process.env,
});

let buffer = "";
const responses = new Map(); // id → response

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let i;
  while ((i = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined) responses.set(msg.id, msg);
    } catch {
      // not JSON, ignore
    }
  }
});

function send(msg) {
  child.stdin.write(JSON.stringify(msg) + "\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function awaitResponse(id, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (responses.has(id)) return responses.get(id);
    await sleep(50);
  }
  throw new Error(`Timed out waiting for response to id ${id}`);
}

const TOOLS = [
  {
    name: "ichiba_item_search",
    args: { keyword: "ワイヤレスイヤホン", hits: 3 },
    check: (data) => {
      const r = data;
      if (typeof r.count !== "number") return "missing count";
      if (!Array.isArray(r.items)) return "items is not array";
      if (r.items.length === 0) return "items empty (no results)";
      const first = r.items[0];
      const required = ["itemName", "itemPrice", "itemUrl", "shopName", "reviewCount"];
      for (const f of required) {
        if (first[f] === undefined) return `first item missing ${f}`;
      }
      return null;
    },
    summary: (data) => `count=${data.count}, items=${data.items.length}, first=${JSON.stringify(data.items[0].itemName).slice(0, 70)}...`,
  },
  {
    name: "ichiba_genre_search",
    args: { genre_id: "0" },
    check: (data) => {
      if (!data.current) return "missing current";
      if (!Array.isArray(data.children)) return "children is not array";
      if (!Array.isArray(data.ancestors)) return "ancestors is not array";
      if (!Array.isArray(data.siblings)) return "siblings is not array";
      if (data.children.length === 0) return "no children at top level";
      const first = data.children[0];
      if (!first.genreId || !first.genreName) return "first child missing genreId/genreName";
      return null;
    },
    summary: (data) => `current=${data.current.genreName || "(top)"}, children=${data.children.length}, first=${data.children[0]?.genreName}`,
  },
  {
    name: "ichiba_tag_search",
    // tagId 1000317 = "SS" size, documented in Rakuten's official example.
    args: { tag_id: 1000317 },
    check: (data) => {
      if (!Array.isArray(data.tagGroups)) return "tagGroups is not array";
      if (data.tagGroups.length === 0) return "no tag groups";
      const g = data.tagGroups[0];
      if (!g.tagGroupName) return "first tagGroup missing tagGroupName";
      if (!Array.isArray(g.tags) || g.tags.length === 0) return "no tags inside first group";
      const t = g.tags[0];
      if (!t.tagId || !t.tagName) return "first tag missing tagId/tagName";
      return null;
    },
    summary: (data) =>
      `tagGroups=${data.tagGroups.length}, first=${data.tagGroups[0]?.tagGroupName} → ${data.tagGroups[0]?.tags?.[0]?.tagName} (id ${data.tagGroups[0]?.tags?.[0]?.tagId})`,
  },
  {
    name: "ichiba_item_ranking",
    args: { genre_id: "0", page: 1 },
    check: (data) => {
      if (!Array.isArray(data.items)) return "items is not array";
      if (data.items.length === 0) return "ranking empty";
      const first = data.items[0];
      if (first.rank === undefined) return "first item missing rank";
      if (first.rank !== 1) return `first item rank is ${first.rank}, expected 1`;
      if (!first.itemName) return "first item missing itemName";
      return null;
    },
    summary: (data) =>
      `title=${data.title}, items=${data.items.length}, #1: ${data.items[0].itemName.slice(0, 50)}...`,
  },
  {
    name: "ichiba_product_search",
    args: { keyword: "ノイズキャンセリング ヘッドホン", hits: 3 },
    check: (data) => {
      if (typeof data.count !== "number") return "missing count";
      if (!Array.isArray(data.products)) return "products is not array";
      if (data.products.length === 0) return "no products (zero results)";
      const first = data.products[0];
      // productNo is null on the 20250801 endpoint; productId is the
      // stable opaque key now. minPrice/maxPrice may be undefined if no
      // listings exist yet — only assert presence of the always-set fields.
      const required = ["productId", "productName", "averagePrice", "itemCount"];
      for (const f of required) {
        if (first[f] === undefined) return `first product missing ${f}`;
      }
      return null;
    },
    summary: (data) =>
      `count=${data.count}, products=${data.products.length}, first=${data.products[0].productName.slice(0, 50)} (¥${data.products[0].minPrice ?? "?"}-¥${data.products[0].maxPrice ?? "?"}, ${data.products[0].itemCount} sellers)`,
  },

  // ── Books ────────────────────────────────────────────────────────────────
  {
    name: "books_total_search",
    args: { keyword: "村上春樹", hits: 2 },
    check: (d) => (d.items?.length ? null : "no items"),
    summary: (d) => `count=${d.count}, first=${d.items[0].title.slice(0, 50)}`,
  },
  {
    name: "books_book_search",
    args: { title: "吾輩は猫である", hits: 2 },
    check: (d) => {
      if (!d.items?.length) return "no items";
      if (!d.items[0].title) return "first item missing title";
      return null;
    },
    summary: (d) => `count=${d.count}, first=${d.items[0].title.slice(0, 50)} by ${d.items[0].author ?? "?"}`,
  },
  {
    name: "books_cd_search",
    args: { artistName: "YOASOBI", hits: 2 },
    check: (d) => (d.items?.length ? null : "no items"),
    summary: (d) => `count=${d.count}, first=${d.items[0].title.slice(0, 40)} / ${d.items[0].artistName ?? "?"}`,
  },
  {
    name: "books_dvd_search",
    args: { title: "君の名は", hits: 2 },
    check: (d) => (d.items?.length ? null : "no items"),
    summary: (d) => `count=${d.count}, first=${d.items[0].title.slice(0, 50)}`,
  },
  {
    name: "books_foreign_book_search",
    args: { title: "Norwegian Wood", hits: 2 },
    check: (d) => (d.items?.length ? null : "no items"),
    summary: (d) => `count=${d.count}, first=${d.items[0].title.slice(0, 50)}`,
  },
  {
    name: "books_magazine_search",
    args: { title: "TOEIC", hits: 2 },
    check: (d) => (d.items?.length ? null : "no items"),
    summary: (d) => `count=${d.count}, first=${d.items[0].title.slice(0, 50)}`,
  },
  {
    name: "books_game_search",
    args: { title: "ゼルダ", hits: 2 },
    check: (d) => (d.items?.length ? null : "no items"),
    summary: (d) => `count=${d.count}, first=${d.items[0].title.slice(0, 50)}`,
  },
  {
    name: "books_software_search",
    args: { title: "Office", hits: 2 },
    check: (d) => (d.items?.length ? null : "no items"),
    summary: (d) => `count=${d.count}, first=${d.items[0].title.slice(0, 50)}`,
  },
  {
    name: "books_genre_search",
    args: { booksGenreId: "000" },
    check: (d) => {
      if (!d.current) return "missing current";
      if (!Array.isArray(d.children) || !d.children.length) return "no children";
      if (!d.children[0].booksGenreId) return "first child missing booksGenreId";
      return null;
    },
    summary: (d) => `current=${d.current.booksGenreName || "(top)"}, children=${d.children.length}`,
  },

  // ── Travel ───────────────────────────────────────────────────────────────
  {
    name: "travel_simple_hotel_search",
    args: { largeClassCode: "japan", middleClassCode: "tokyo", smallClassCode: "tokyo", detailClassCode: "A", hits: 2 },
    check: (d) => {
      if (!d.hotels?.length) return "no hotels";
      const h = d.hotels[0];
      if (!h.hotelNo || !h.hotelName) return "first hotel missing hotelNo/hotelName";
      return null;
    },
    summary: (d) => `recordCount=${d.recordCount}, hotels=${d.hotels.length}, first=${d.hotels[0].hotelName.slice(0, 40)}`,
  },
  {
    name: "travel_vacant_hotel_search",
    args: {
      checkinDate: "2026-07-01",
      checkoutDate: "2026-07-02",
      adultNum: 1,
      roomNum: 1,
      largeClassCode: "japan",
      middleClassCode: "tokyo",
      smallClassCode: "tokyo",
      detailClassCode: "A",
      hits: 2,
    },
    check: (d) => {
      if (!d.hotels?.length) return "no hotels";
      const hasPlans = d.hotels.some((h) => h.plans?.length > 0);
      if (!hasPlans) return "no hotel had plans (roomInfo flattening failed)";
      return null;
    },
    summary: (d) => {
      const withPlans = d.hotels.find((h) => h.plans?.length > 0);
      return `recordCount=${d.recordCount}, hotels=${d.hotels.length}, first-with-plans=${withPlans?.hotelName?.slice(0, 30)} (${withPlans?.plans?.length} plans)`;
    },
  },
  {
    name: "travel_hotel_detail_search",
    args: { hotelNo: 1217 },
    check: (d) => {
      if (!d || !d.hotelNo) return "no hotel returned";
      if (!d.hotelName) return "missing hotelName";
      return null;
    },
    summary: (d) => `hotelNo=${d.hotelNo}, name=${d.hotelName.slice(0, 40)}, reviews=${d.reviewCount}`,
  },
  {
    name: "travel_get_area_class",
    args: {},
    check: (d) => {
      if (!Array.isArray(d.larges) || !d.larges.length) return "no larges";
      const japan = d.larges.find((l) => l.code === "japan");
      if (!japan) return "no 'japan' large class";
      if (!japan.middles?.length) return "japan has no middles";
      return null;
    },
    summary: (d) => `larges=${d.larges.length}, prefectures=${d.larges.find((l) => l.code === "japan")?.middles?.length}`,
  },
  {
    name: "travel_keyword_hotel_search",
    args: { keyword: "Shibuya", hits: 2 },
    check: (d) => (d.hotels?.length ? null : "no hotels"),
    summary: (d) => `recordCount=${d.recordCount}, first=${d.hotels[0].hotelName.slice(0, 40)}`,
  },
  {
    name: "travel_get_hotel_chain_list",
    args: {},
    check: (d) => {
      if (!Array.isArray(d.chains) || !d.chains.length) return "no chains";
      if (!d.chains[0].code || !d.chains[0].name) return "first chain missing code/name";
      return null;
    },
    summary: (d) => `chains=${d.chains.length}, first=${d.chains[0].name} (${d.chains[0].code})`,
  },
  {
    name: "travel_hotel_ranking",
    args: { genre: "all" },
    check: (d) => {
      if (!Array.isArray(d.hotels) || !d.hotels.length) return "no hotels";
      if (d.hotels[0].rank !== 1) return `first hotel rank is ${d.hotels[0].rank}, expected 1`;
      return null;
    },
    summary: (d) => `title=${d.title.slice(0, 40)}, hotels=${d.hotels.length}, #1: ${d.hotels[0].hotelName.slice(0, 30)}`,
  },

  // ── Recipe ───────────────────────────────────────────────────────────────
  {
    name: "recipe_category_list",
    args: { level: "large" }, // small payload for the smoke
    check: (d) => {
      if (!Array.isArray(d.large) || !d.large.length) return "no large categories";
      if (!d.large[0].categoryId || !d.large[0].categoryName) return "first large missing categoryId/Name";
      return null;
    },
    summary: (d) => `large=${d.large.length}, first=${d.large[0].categoryName}`,
  },
  {
    name: "recipe_category_ranking",
    args: { categoryId: "30" }, // 人気メニュー
    check: (d) => {
      if (!Array.isArray(d.recipes) || !d.recipes.length) return "no recipes";
      if (!d.recipes[0].recipeTitle) return "first recipe missing title";
      if (d.recipes[0].rank !== 1) return `first rank is ${d.recipes[0].rank}, expected 1`;
      return null;
    },
    summary: (d) => `recipes=${d.recipes.length}, #1: ${d.recipes[0].recipeTitle.slice(0, 40)}`,
  },

  // ── Kobo ─────────────────────────────────────────────────────────────────
  {
    name: "kobo_ebook_search",
    args: { keyword: "村上春樹", hits: 2 },
    check: (d) => {
      if (!d.items?.length) return "no items";
      if (!d.items[0].title) return "first item missing title";
      return null;
    },
    summary: (d) => `count=${d.count}, first=${d.items[0].title.slice(0, 40)} by ${d.items[0].author ?? "?"} (${d.items[0].language ?? "?"})`,
  },
  {
    name: "kobo_genre_search",
    args: { koboGenreId: "101" }, // eBooks top
    check: (d) => {
      if (!d.current) return "missing current";
      if (d.current.koboGenreId !== "101") return `current.koboGenreId=${d.current.koboGenreId}`;
      if (!Array.isArray(d.children) || !d.children.length) return "no children";
      return null;
    },
    summary: (d) => `current=${d.current.koboGenreName}, children=${d.children.length}`,
  },

  // ── GORA ─────────────────────────────────────────────────────────────────
  {
    name: "gora_golf_course_search",
    args: { areaCode: "13", hits: 2 },
    check: (d) => {
      if (!Array.isArray(d.courses) || !d.courses.length) return "no courses";
      if (!d.courses[0].golfCourseId || !d.courses[0].golfCourseName) return "first course missing id/name";
      return null;
    },
    summary: (d) => `count=${d.count}, first=${d.courses[0].golfCourseName} (id ${d.courses[0].golfCourseId})`,
  },
  {
    name: "gora_golf_course_detail",
    args: { golfCourseId: 10005 },
    check: (d) => {
      if (!d || !d.golfCourseId) return "no detail returned";
      if (!d.golfCourseName) return "missing golfCourseName";
      if (!Array.isArray(d.imageUrls)) return "imageUrls is not array";
      return null;
    },
    summary: (d) => `name=${d.golfCourseName.slice(0, 30)}, holes=${d.holeCount ?? "?"}, par=${d.parCount ?? "?"}, images=${d.imageUrls.length}`,
  },
  {
    name: "gora_plan_search",
    args: { areaCode: "13", playDate: "2026-07-01", hits: 2 },
    check: (d) => {
      if (!Array.isArray(d.courses) || !d.courses.length) return "no courses";
      const withPlans = d.courses.find((c) => Array.isArray(c.plans) && c.plans.length > 0);
      if (!withPlans) return "no course had plans (planInfo flattening failed)";
      return null;
    },
    summary: (d) => {
      const withPlans = d.courses.find((c) => c.plans?.length > 0);
      return `courses=${d.courses.length}, first-with-plans=${withPlans?.golfCourseName?.slice(0, 30)} (${withPlans?.plans?.length} plans)`;
    },
  },
];

async function main() {
  // Initialize
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "1.0" },
    },
  });
  const initResp = await awaitResponse(1);
  console.log(
    `Connected to ${initResp.result.serverInfo.name} v${initResp.result.serverInfo.version}`,
  );

  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  // Run each tool
  const results = [];
  let nextId = 2;
  for (const tool of TOOLS) {
    const id = nextId++;
    console.log(`\n── ${tool.name} ──`);
    console.log(`  args: ${JSON.stringify(tool.args)}`);

    const start = Date.now();
    send({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name: tool.name, arguments: tool.args },
    });

    try {
      const resp = await awaitResponse(id);
      const elapsed = Date.now() - start;

      if (resp.error) {
        console.log(`  ❌ JSON-RPC error: ${resp.error.message}`);
        results.push({ tool: tool.name, status: "rpc_error", detail: resp.error.message });
        continue;
      }

      if (resp.result.isError) {
        const txt = resp.result.content?.[0]?.text ?? "(no detail)";
        console.log(`  ❌ Tool returned isError=true: ${txt.slice(0, 200)}`);
        results.push({ tool: tool.name, status: "tool_error", detail: txt });
        continue;
      }

      const textBlock = resp.result.content?.[0]?.text;
      if (!textBlock) {
        console.log(`  ❌ Response has no text content`);
        results.push({ tool: tool.name, status: "no_content", detail: JSON.stringify(resp.result) });
        continue;
      }

      let data;
      try {
        data = JSON.parse(textBlock);
      } catch {
        console.log(`  ❌ Response body not JSON: ${textBlock.slice(0, 200)}`);
        results.push({ tool: tool.name, status: "not_json", detail: textBlock.slice(0, 300) });
        continue;
      }

      const issue = tool.check(data);
      if (issue) {
        console.log(`  ⚠️  Field-mapping issue: ${issue}`);
        console.log(`     Summary: ${tool.summary(data)}`);
        results.push({ tool: tool.name, status: "field_issue", detail: issue, elapsed });
      } else {
        console.log(`  ✅ OK (${elapsed}ms): ${tool.summary(data)}`);
        results.push({ tool: tool.name, status: "ok", elapsed });
      }
    } catch (err) {
      console.log(`  ❌ Exception: ${err.message}`);
      results.push({ tool: tool.name, status: "exception", detail: err.message });
    }

    // Small delay between calls to be polite to Rakuten's 1 QPS limit
    await sleep(1100);
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("Smoke test summary:");
  const ok = results.filter((r) => r.status === "ok");
  const issues = results.filter((r) => r.status !== "ok");
  console.log(`  ${ok.length}/${results.length} tools returned clean data`);
  if (issues.length > 0) {
    console.log(`  ${issues.length} need attention:`);
    for (const r of issues) {
      console.log(`    - ${r.tool}: ${r.status}${r.detail ? ` — ${r.detail.slice(0, 100)}` : ""}`);
    }
  }

  // Shut down
  child.kill();
  process.exit(ok.length === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke runner failed:", err);
  child.kill();
  process.exit(2);
});
