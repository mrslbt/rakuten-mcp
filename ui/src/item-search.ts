/**
 * MCP Apps view for ichiba_item_search — renders Rakuten search results as a
 * product-card grid inside the host conversation.
 *
 * Data flow:
 *   ontoolinput  -> show skeleton grid with the keyword in the header
 *   ontoolresult -> render cards from structuredContent (IchibaItemSearchResult)
 *   card click   -> app.openLink(itemUrl) (host opens the product page)
 *
 * Theming: host CSS variables with Japanese-web-standard fallbacks.
 */

import {
  App,
  PostMessageTransport,
  applyDocumentTheme,
  applyHostStyleVariables,
  applyHostFonts,
} from "@modelcontextprotocol/ext-apps";
import "./styles.css";

interface IchibaItem {
  itemName: string;
  itemPrice: number;
  itemUrl: string;
  shopName: string;
  reviewAverage: number | string;
  reviewCount: number;
  imageUrl?: string;
  taxFlag: number;
  postageFlag: number;
  pointRate: number;
}

interface SearchResult {
  count: number;
  page: number;
  hits: number;
  pageCount: number;
  items: IchibaItem[];
}

// UI chrome strings — product data stays in the seller's language; only the
// labels we own are localized. Locale arrives via host context (BCP 47).
const STRINGS = {
  ja: {
    searching: (k: string) => (k ? `「${k}」を検索中…` : "検索中…"),
    results: (count: string, from: number, to: number) => `${count}件中 ${from}–${to}件`,
    page: (p: number, n: number) => `p.${p}/${n}`,
    noResults: (k: string) => `「${k}」の検索結果はありません`,
    noData: "データがありません。テキスト結果は会話内で確認できます。",
    taxIncl: "税込",
    taxExcl: "税別",
    freeShip: "送料込",
    points: (r: number) => `P${r}倍`,
    noReviews: "レビューなし",
    footer: "楽天市場 · 価格表記は商品ごとの注記に従います",
  },
  en: {
    searching: (k: string) => (k ? `Searching for “${k}”…` : "Searching Rakuten…"),
    results: (count: string, from: number, to: number) => `${from}–${to} of ${count} results`,
    page: (p: number, n: number) => `page ${p}/${n}`,
    noResults: (k: string) => `No results for “${k}”`,
    noData: "No data returned. The text result is still available in the conversation.",
    taxIncl: "tax incl.",
    taxExcl: "tax excl.",
    freeShip: "Free shipping",
    points: (r: number) => `${r}× points`,
    noReviews: "No reviews",
    footer: "Rakuten Ichiba · price notes vary per item",
  },
} as const;

let lang: keyof typeof STRINGS = "ja";
const t = () => STRINGS[lang];

const root = document.getElementById("root")!;
let keyword = "";
let lastData: SearchResult | null = null;

const app = new App({ name: "Rakuten Item Search", version: "1.0.0" });

app.ontoolinput = (params) => {
  const args = (params.arguments ?? {}) as { keyword?: string; hits?: number };
  keyword = args.keyword ?? "";
  renderSkeleton(args.hits ?? 10);
};

app.ontoolresult = (result) => {
  const data = extractResult(result);
  if (!data) {
    renderEmpty(t().noData);
    return;
  }
  if (!data.items?.length) {
    renderEmpty(t().noResults(keyword));
    return;
  }
  lastData = data;
  renderGrid(data);
};

app.onhostcontextchanged = (ctx) => {
  if (ctx.locale) {
    const next = ctx.locale.toLowerCase().startsWith("ja") ? "ja" : "en";
    if (next !== lang) {
      lang = next;
      if (lastData) renderGrid(lastData);
    }
  }
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.safeAreaInsets) {
    const { top, right, bottom, left } = ctx.safeAreaInsets;
    document.body.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
  }
};

function extractResult(result: unknown): SearchResult | null {
  const r = result as {
    structuredContent?: unknown;
    content?: Array<{ type: string; text?: string }>;
  };
  if (r?.structuredContent && typeof r.structuredContent === "object") {
    return r.structuredContent as SearchResult;
  }
  const text = r?.content?.find((c) => c.type === "text")?.text;
  if (text) {
    try {
      return JSON.parse(text) as SearchResult;
    } catch {
      return null;
    }
  }
  return null;
}

// ── rendering ────────────────────────────────────────────────────────────────

function renderSkeleton(hits: number): void {
  const n = Math.min(Math.max(hits, 4), 12);
  root.innerHTML = `
    <div class="wrap">
      <header class="head">
        <span class="head-title">${esc(t().searching(keyword))}</span>
      </header>
      <div class="grid">
        ${Array.from({ length: n }, () => `<div class="card skeleton"><div class="thumb"></div><div class="body"><div class="line w80"></div><div class="line w50"></div><div class="line w60"></div></div></div>`).join("")}
      </div>
    </div>`;
}

function renderEmpty(message: string): void {
  root.innerHTML = `
    <div class="wrap">
      <div class="empty">
        <div class="empty-mark">楽</div>
        <p>${esc(message)}</p>
      </div>
    </div>`;
}

function renderGrid(data: SearchResult): void {
  const shownFrom = (data.page - 1) * data.hits + 1;
  const shownTo = shownFrom + data.items.length - 1;
  root.innerHTML = `
    <div class="wrap">
      <header class="head">
        <span class="head-title">「${esc(keyword)}」</span>
        <span class="head-meta">${t().results(data.count.toLocaleString("ja-JP"), shownFrom, shownTo)}${data.pageCount > 1 ? ` · ${t().page(data.page, data.pageCount)}` : ""}</span>
      </header>
      <div class="grid">
        ${data.items.map(card).join("")}
      </div>
      <footer class="foot">${esc(t().footer)}</footer>
    </div>`;

  // Broken/expired image URLs fall back to the placeholder mark.
  root.querySelectorAll<HTMLImageElement>(".thumb img").forEach((img) => {
    img.addEventListener("error", () => {
      const ph = document.createElement("div");
      ph.className = "noimg";
      ph.textContent = "楽";
      img.replaceWith(ph);
    });
  });

  root.querySelectorAll<HTMLElement>("[data-url]").forEach((el) => {
    el.addEventListener("click", () => {
      const url = el.dataset.url;
      if (url) void app.openLink({ url });
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const url = el.dataset.url;
        if (url) void app.openLink({ url });
      }
    });
  });
}

function card(item: IchibaItem): string {
  const rating = Number(item.reviewAverage) || 0;
  const badges: string[] = [];
  if (item.postageFlag === 0) badges.push(`<span class="badge badge-ship">${esc(t().freeShip)}</span>`);
  if (item.pointRate > 1) badges.push(`<span class="badge badge-point">${esc(t().points(item.pointRate))}</span>`);

  return `
    <article class="card" data-url="${esc(item.itemUrl)}" tabindex="0" role="link" aria-label="${esc(item.itemName)}">
      <div class="thumb">
        ${item.imageUrl ? `<img src="${esc(item.imageUrl)}" alt="" loading="lazy" />` : `<div class="noimg">楽</div>`}
        ${badges.length ? `<div class="badges">${badges.join("")}</div>` : ""}
      </div>
      <div class="body">
        <h3 class="name" lang="ja">${esc(item.itemName)}</h3>
        <div class="price"><span class="yen">¥</span>${item.itemPrice.toLocaleString("ja-JP")}<span class="tax">${esc(item.taxFlag === 1 ? t().taxExcl : t().taxIncl)}</span></div>
        ${
          item.reviewCount > 0
            ? `<div class="review"><span class="stars" style="--r:${(rating / 5) * 100}%">★★★★★</span><span class="rcount">${rating.toFixed(1)} (${item.reviewCount.toLocaleString("ja-JP")})</span></div>`
            : `<div class="review review-none">${esc(t().noReviews)}</div>`
        }
        <div class="shop" lang="ja">${esc(item.shopName)}</div>
      </div>
    </article>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Register handlers BEFORE connect (ext-apps requirement).
await app.connect(new PostMessageTransport());
