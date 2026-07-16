/*
 * VENDORED from the mcp-apps-ui kit — components/product-list/product-list.html
 * Do not edit here; edit in the kit and re-vendor. Copy-paste-and-own is the
 * model, so this file is intentionally a checked-in copy, not a dependency.
 */
export const PRODUCT_LIST_URI = "ui://rakuten/product-list";

export const PRODUCT_LIST_TEMPLATE = `<!--
  mcp-apps-ui · product-list

  Commerce results as a document. Two modes, chosen by data or by count:
    list      the trade price list. Numbered rows, dotted leaders to the price,
              seller and rating beneath each name. Any number of items.
    showcase  the keyed picture index. Lettered photo mosaic, text index keyed
              back to it. 2 to 4 items; the big A slot is the best match.

  Genre: the mail-order catalog / trade price list. Universal across markets by
  design: the same structure renders Rakuten (JPY) and Amazon (USD) without a
  seam. Currency formatting is locale-correct via Intl.NumberFormat.

  HYDRATION (priority order):
    1. Host-pushed:  postMessage({type:"mau:data", data}) or window.mauRender(data)
    2. Baked-in:     window.__MAU_DATA__ (server injects it ahead of this markup)
    3. Loading:      window.__MAU_AWAIT__ (static ui:// resource, pre-push)
    4. Sample:       standalone preview fallback

  DATA CONTRACT:
    {
      query?: string,          // becomes the title ("coffee dripper")
      source?: string,         // "Rakuten", "Amazon"
      total_count?: number,    // 892 -> "5 of 892"
      currency?: string,       // ISO 4217, default "JPY"
      mode?: "list" | "showcase" | "auto",   // default "auto": showcase when 2-4 items
      footnote?: string,       // "Prices incl. tax"
      items: [{
        name: string,
        url?: string,
        image?: string,        // https image; host CSP permitting. Falls back to a plate.
        price: number,         // major units (1380 JPY, 39.99 USD)
        was_price?: number,    // > price -> sale accent + strikethrough
        seller?: string,
        rating?: { avg: number, count: number },
        variations?: string,   // "2 sizes, 4 colours"
        note?: string          // availability etc -> dagger footnote
      }],
      theme?: "light" | "dark"
    }
  No external network calls except item images the host allows. No fonts, no scripts.
-->
<div class="mau mau-productlist" id="mau-root" role="figure" aria-label="Product results">
  <style>
    .mau-productlist {
      --mau-font: system-ui, -apple-system, "Segoe UI", Roboto,
        "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", Meiryo, sans-serif;
      --mau-paper: #ffffff; --mau-ink: #1a1a1a; --mau-ink-2: #555555; --mau-ink-3: #8a8a8a;
      --mau-hairline: #dcdcda; --mau-accent: #c73e1d; --mau-plate: #eceae5;
    }
    @media (prefers-color-scheme: dark) {
      .mau-productlist:not([data-theme="light"]) {
        --mau-paper: #171717; --mau-ink: #ebebe9; --mau-ink-2: #b0b0ae; --mau-ink-3: #7e7e7c;
        --mau-hairline: #3a3a38; --mau-accent: #ff7a5c; --mau-plate: #26241f;
      }
    }
    .mau-productlist[data-theme="dark"] {
      --mau-paper: #171717; --mau-ink: #ebebe9; --mau-ink-2: #b0b0ae; --mau-ink-3: #7e7e7c;
      --mau-hairline: #3a3a38; --mau-accent: #ff7a5c; --mau-plate: #26241f;
    }
    .mau-productlist *, .mau-productlist *::before, .mau-productlist *::after {
      box-sizing: border-box; margin: 0; padding: 0;
    }
    .mau-productlist {
      font-family: var(--mau-font); color: var(--mau-ink); background: var(--mau-paper);
      max-width: 460px; width: 100%; font-variant-numeric: tabular-nums;
      -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
    }

    /* thumbnails: fixed plate, image covers, plate shows through on error */
    .mau-thumb { background: var(--mau-plate); position: relative; flex: 0 0 auto; overflow: hidden; }
    .mau-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .mau-thumb::after { content: ""; position: absolute; inset: 0; border: 1px solid rgba(0,0,0,0.06); pointer-events: none; }

    .mau-sale { color: var(--mau-accent); }
    .mau-was { font-weight: 400; color: var(--mau-ink-3); text-decoration: line-through; font-size: 12px; }
    .mau-dag { color: var(--mau-ink-2); font-weight: 400; flex: 0 0 auto; }
    a.mau-link { color: inherit; text-decoration: none; }
    a.mau-link:hover { text-decoration: underline; }

    /* ---- list mode: the price list -------------------------------------- */
    .mau-ledger { padding: 20px 22px; border-top: 1px solid var(--mau-ink); border-bottom: 3px double var(--mau-ink); }
    .mau-lhead { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .mau-ltitle { font-size: 21px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.15;
      min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mau-lmeta { font-size: 12px; color: var(--mau-ink-2); white-space: nowrap; }
    .mau-lrule { border-bottom: 1px solid var(--mau-ink); border-top: 3px double var(--mau-ink); height: 5px; margin: 10px 0 6px; }
    .mau-lrow { display: flex; gap: 12px; padding: 9px 0; align-items: flex-start; }
    .mau-lno { font-size: 11px; color: var(--mau-ink-3); width: 20px; flex: 0 0 auto; padding-top: 3px; }
    .mau-lrow .mau-thumb { width: 56px; height: 56px; }
    .mau-lbody { flex: 1; min-width: 0; padding-top: 1px; }
    .mau-lline { display: flex; align-items: baseline; gap: 8px; }
    .mau-lname { font-size: 14.5px; font-weight: 650; line-height: 1.35; flex: 0 1 auto;
      min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mau-leader { flex: 1 1 12px; min-width: 12px; border-bottom: 1px dotted var(--mau-ink-3);
      align-self: flex-end; margin-bottom: 4px; }
    .mau-lprice { font-size: 15.5px; font-weight: 750; white-space: nowrap; flex: 0 0 auto; }
    .mau-cur { font-size: 0.74em; font-weight: 600; margin-right: 1px; }
    .mau-lsub { font-size: 11.5px; color: var(--mau-ink-3); margin-top: 3px; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; }
    .mau-lsub b { color: var(--mau-ink-2); font-weight: 600; }
    .mau-lfoot { display: flex; justify-content: space-between; gap: 12px; font-size: 11px;
      color: var(--mau-ink-3); margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--mau-hairline); }
    .mau-lfoot .notes { min-width: 0; }
    .mau-lfoot .mark { white-space: nowrap; }
    .mau-lfoot a { color: inherit; text-decoration: none; }
    .mau-lfoot a:hover { color: var(--mau-ink); text-decoration: underline; }

    /* ---- showcase mode: the picture index ------------------------------- */
    .mau-keyed { border: 1px solid var(--mau-ink); padding: 18px 20px; }
    .mau-khead { display: flex; justify-content: space-between; align-items: baseline;
      padding-bottom: 10px; border-bottom: 2px solid var(--mau-ink); margin-bottom: 14px; gap: 12px; }
    .mau-ktitle { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mau-kmeta { font-size: 12px; color: var(--mau-ink-2); white-space: nowrap; }
    .mau-mosaic { display: grid; grid-template-columns: 3fr 2fr; grid-template-rows: 1fr 1fr;
      gap: 6px; height: 250px; }
    .mau-mosaic .mau-thumb:first-child { grid-column: 1; grid-row: 1 / 3; }
    .mau-mosaic.n2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
    .mau-mosaic.n2 .mau-thumb:first-child { grid-row: auto; }
    .mau-mosaic.n4 { grid-template-rows: repeat(3, 1fr); }
    .mau-mosaic.n4 .mau-thumb:first-child { grid-row: 1 / 4; }
    .mau-keychip { position: absolute; top: 6px; left: 6px; z-index: 1;
      width: 20px; height: 20px; background: var(--mau-paper); border: 1px solid var(--mau-ink);
      display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; }
    .mau-kindex { margin-top: 14px; }
    .mau-krow { display: flex; align-items: baseline; gap: 10px; padding: 8px 0; border-top: 1px solid var(--mau-hairline); }
    .mau-krow:first-child { border-top: none; }
    .mau-kkey { font-weight: 800; font-size: 13px; width: 16px; flex: 0 0 auto; }
    .mau-kmain { flex: 1; min-width: 0; }
    .mau-kname { font-size: 14px; font-weight: 600; line-height: 1.3;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .mau-ksub { font-size: 11.5px; color: var(--mau-ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mau-ksub b { color: var(--mau-ink-2); font-weight: 600; }
    .mau-kprice { font-size: 16px; font-weight: 800; white-space: nowrap; }
    .mau-kfoot { font-size: 11px; color: var(--mau-ink-3); margin-top: 10px; padding-top: 8px;
      border-top: 1px solid var(--mau-hairline); display: flex; justify-content: space-between; gap: 12px; }
    .mau-kfoot a { color: inherit; text-decoration: none; }
    .mau-kfoot a:hover { color: var(--mau-ink); text-decoration: underline; }

    @media (max-width: 340px) {
      .mau-mosaic { height: 200px; }
      .mau-lrow .mau-thumb { width: 48px; height: 48px; }
    }
  </style>
  <div id="mau-body"></div>
</div>

<script>
(function () {
  "use strict";

  var NNBSP = String.fromCharCode(0x202f);
  var DOT = String.fromCharCode(0xb7);
  var STAR = String.fromCharCode(0x2605);
  var DAGGERS = [String.fromCharCode(0x2020), String.fromCharCode(0x2021), "*"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function n(v) { return typeof v === "number" && isFinite(v) ? v : 0; }

  /* Locale-correct price. Splits symbol from figure so the symbol can set small.
     JPY renders with no decimals, USD with two; Intl decides, not us. */
  function price(amount, currency) {
    try {
      var parts = new Intl.NumberFormat("en", {
        style: "currency", currency: currency || "JPY", currencyDisplay: "narrowSymbol"
      }).formatToParts(n(amount));
      var sym = "", num = "";
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === "currency") sym += parts[i].value;
        else if (parts[i].type !== "literal") num += parts[i].value;
      }
      return { sym: sym, num: num };
    } catch (e) {
      return { sym: "", num: String(amount) };
    }
  }
  function priceHtml(item, currency, cls) {
    var p = price(item.price, currency);
    var onSale = item.was_price != null && n(item.was_price) > n(item.price);
    var main = '<span class="' + cls + (onSale ? " mau-sale" : "") + '">' +
      '<span class="mau-cur">' + esc(p.sym) + "</span>" + esc(p.num) + "</span>";
    if (!onSale) return main;
    var w = price(item.was_price, currency);
    return main + ' <span class="mau-was">' + esc(w.sym) + esc(w.num) + "</span>";
  }
  function subHtml(item) {
    var bits = [];
    if (item.seller) bits.push(esc(item.seller));
    if (item.rating && item.rating.avg != null) {
      bits.push("<b>" + esc(item.rating.avg) + "</b> " + STAR +
        (item.rating.count != null ? " " + n(item.rating.count).toLocaleString("en-US") : ""));
    }
    if (item.variations) bits.push(esc(item.variations));
    return bits.join(" " + DOT + " ");
  }
  function thumbHtml(item, chip) {
    var img = item.image
      ? '<img src="' + esc(item.image) + '" alt="' + esc(item.name) + '" onerror="this.remove()">'
      : "";
    return '<div class="mau-thumb">' + (chip || "") + img + "</div>";
  }
  function linkOpen(item) { return item.url ? '<a class="mau-link" href="' + esc(item.url) + '" target="_blank" rel="noopener">' : ""; }
  function linkClose(item) { return item.url ? "</a>" : ""; }

  var SAMPLE = {
    query: "coffee dripper",
    source: "Rakuten",
    total_count: 892,
    currency: "JPY",
    mode: "list",
    footnote: "Prices incl. tax",
    items: [
      { name: "Hario V60 Ceramic Dripper 02, White", price: 1380, seller: "Hario official shop",
        rating: { avg: 4.8, count: 6412 }, variations: "2 sizes " + DOT + " 4 colours" },
      { name: "Kalita Wave 185 Stainless Dripper", price: 3850, seller: "Kalita store",
        rating: { avg: 4.7, count: 2105 } },
      { name: "Origami Dripper M, Turquoise", price: 2750, seller: "K-ai ceramics",
        rating: { avg: 4.6, count: 894 } },
      { name: "Melitta 1×2 Aroma Filter Cone", price: 598, was_price: 880, seller: "Bic Camera",
        rating: { avg: 4.4, count: 1530 } },
      { name: "Cafec Flower Dripper Deep 27, Cup 1", price: 1980, seller: "Cafec direct",
        rating: { avg: 4.5, count: 377 }, note: "Ships in 1–2 weeks" }
    ]
  };

  function render(data) {
    if (!data || !Array.isArray(data.items) || data.items.length === 0) data = SAMPLE;
    var root = document.getElementById("mau-root");
    if (data.theme === "dark" || data.theme === "light") root.setAttribute("data-theme", data.theme);

    var items = data.items;
    var currency = data.currency || "JPY";
    var mode = data.mode === "list" || data.mode === "showcase" ? data.mode
      : (items.length >= 2 && items.length <= 4 ? "showcase" : "list");

    var title = data.query ? cap(data.query) : "Results";
    var metaBits = [];
    if (data.source) metaBits.push(esc(data.source));
    metaBits.push(data.total_count != null
      ? items.length + " of " + n(data.total_count).toLocaleString("en-US")
      : items.length + " item" + (items.length === 1 ? "" : "s"));
    var meta = metaBits.join(" " + DOT + " ");

    /* dagger footnotes from per-item notes, deduplicated */
    var noteMap = [], noteFor = {};
    items.forEach(function (it, i) {
      if (!it.note) return;
      var found = noteMap.indexOf(it.note);
      if (found === -1) { found = noteMap.length; noteMap.push(it.note); }
      noteFor[i] = DAGGERS[Math.min(found, DAGGERS.length - 1)];
    });
    var notes = noteMap.map(function (t, i) {
      return DAGGERS[Math.min(i, DAGGERS.length - 1)] + NNBSP + esc(t) + ".";
    });
    if (data.footnote) notes.push(esc(data.footnote) + ".");

    document.getElementById("mau-body").innerHTML =
      mode === "showcase" ? showcase(items, currency, title, meta, notes, noteFor)
                          : list(items, currency, title, meta, notes, noteFor);
  }

  function list(items, currency, title, meta, notes, noteFor) {
    var rows = items.map(function (it, i) {
      var no = i + 1 < 10 ? "0" + (i + 1) : String(i + 1);
      var dag = noteFor[i] ? '<span class="mau-dag">' + NNBSP + noteFor[i] + "</span>" : "";
      return '<div class="mau-lrow">' +
        '<span class="mau-lno">' + no + "</span>" +
        thumbHtml(it) +
        '<div class="mau-lbody">' +
          '<div class="mau-lline">' +
            '<span class="mau-lname">' + linkOpen(it) + esc(it.name) + linkClose(it) + "</span>" +
            dag +
            '<span class="mau-leader"></span>' +
            priceHtml(it, currency, "mau-lprice") +
          "</div>" +
          (subHtml(it) ? '<div class="mau-lsub">' + subHtml(it) + "</div>" : "") +
        "</div></div>";
    }).join("");

    return '<div class="mau-ledger">' +
      '<div class="mau-lhead"><span class="mau-ltitle">' + esc(title) + '</span>' +
      '<span class="mau-lmeta">' + meta + "</span></div>" +
      '<div class="mau-lrule"></div>' + rows +
      '<div class="mau-lfoot"><span class="notes">' + notes.join(" ") + "</span>" +
      '<span class="mark"><a href="https://github.com/mrslbt/mcp-apps-ui" target="_blank" rel="noopener">mcp-apps-ui</a></span></div>' +
      "</div>";
  }

  function showcase(items, currency, title, meta, notes, noteFor) {
    var shown = items.slice(0, 4);
    var keys = ["A", "B", "C", "D"];
    var mosaic = shown.map(function (it, i) {
      return thumbHtml(it, '<span class="mau-keychip">' + keys[i] + "</span>");
    }).join("");
    var index = shown.map(function (it, i) {
      var dag = noteFor[i] ? '<span class="mau-dag">' + NNBSP + noteFor[i] + "</span>" : "";
      return '<div class="mau-krow">' +
        '<span class="mau-kkey">' + keys[i] + "</span>" +
        '<div class="mau-kmain">' +
          '<div class="mau-kname">' + linkOpen(it) + esc(it.name) + linkClose(it) + dag + "</div>" +
          (subHtml(it) ? '<div class="mau-ksub">' + subHtml(it) + "</div>" : "") +
        "</div>" +
        priceHtml(it, currency, "mau-kprice") +
        "</div>";
    }).join("");

    return '<div class="mau-keyed">' +
      '<div class="mau-khead"><span class="mau-ktitle">' + esc(title) + '</span>' +
      '<span class="mau-kmeta">' + meta + "</span></div>" +
      '<div class="mau-mosaic' + (shown.length === 2 ? " n2" : shown.length === 4 ? " n4" : "") + '">' + mosaic + "</div>" +
      '<div class="mau-kindex">' + index + "</div>" +
      '<div class="mau-kfoot"><span>' + notes.join(" ") + "</span>" +
      '<span><a href="https://github.com/mrslbt/mcp-apps-ui" target="_blank" rel="noopener">mcp-apps-ui</a></span></div>' +
      "</div>";
  }

  function cap(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }

  function renderLoading() {
    document.getElementById("mau-body").innerHTML =
      '<div class="mau-ledger"><div class="mau-lhead">' +
      '<span class="mau-ltitle">Searching</span><span class="mau-lmeta">waiting for results</span>' +
      '</div><div class="mau-lrule"></div></div>';
  }
  function start() {
    var boot = window.__MAU_DATA__ || null;
    if (!boot && window.__MAU_AWAIT__) { renderLoading(); return; }
    render(boot);
  }

  window.mauRender = render;
  window.addEventListener("message", function (ev) {
    var d = ev && ev.data;
    if (d && d.type === "mau:data" && d.data) render(d.data);
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
</script>
`;
