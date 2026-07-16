/*
 * mcp-apps-ui — server helper (dependency-free)
 *
 * One small module that turns a component (a self-contained HTML string) plus
 * your tool's data into the pieces an MCP server needs to render an App —
 * emitting BOTH live wirings so a component shows up across the ecosystem:
 *
 *   • mcp-ui hosts (Claude, and everything using @mcp-ui/client):
 *       an inline EmbeddedResource in the tool result's `content`, with the
 *       data baked into the HTML (no handshake, renders immediately).
 *
 *   • official MCP Apps / ext-apps hosts (SEP-1865):
 *       a `_meta.ui.resourceUri` link on the tool + a registered `ui://`
 *       resource the host preloads. The static resource shows a loading state
 *       until the host pushes the tool result over the ui/ channel.
 *
 * Zero dependencies, no framework, no build step — copy it into any TS/JS MCP
 * server. (Porting to Python/Go/Ruby is a ~40-line exercise; the shapes below
 * are the whole contract.)
 */

/** An MCP EmbeddedResource content block (valid inside a tools/call result). */
export interface EmbeddedUiResource {
  type: "resource";
  resource: {
    uri: string;
    mimeType: "text/html";
    text: string;
    /** mcp-ui reads preferred iframe sizing hints from here when present. */
    _meta?: Record<string, unknown>;
  };
}

/** Everything a server needs to wire one component into one tool. */
export interface RenderResult {
  /** The `ui://` identity of this component. */
  uri: string;
  /** Full HTML document with the data baked in — for the inline (mcp-ui) path. */
  html: string;
  /** Static HTML document (no data, shows loading) — for the preloaded ui:// resource. */
  staticHtml: string;
  /** Append this to your tool result's `content` array (mcp-ui path). */
  contentBlock: EmbeddedUiResource;
  /** Merge into the tool's registration `_meta` (official ext-apps linkage). */
  toolMeta: { ui: { resourceUri: string; preferredSize?: { width?: number; height?: number } } };
  /** Merge into the tool *result*'s `_meta` — some hosts read the template link here too. */
  resultMeta: Record<string, unknown>;
  /**
   * Merge into the static ui:// resource's registration `_meta` (csp,
   * permissions). Undefined when no csp was declared.
   */
  registrationMeta?: Record<string, unknown>;
}

export interface RenderOptions {
  /** ui:// identifier, e.g. "ui://tabedata/nutrition-label". */
  uri: string;
  /** The component's self-contained HTML (tokens + markup + script inlined). */
  template: string;
  /** The tool's data object; baked into the inline document as window.__MAU_DATA__. */
  data: unknown;
  /** Optional theme hint passed to the component ("light" | "dark"). */
  theme?: "light" | "dark";
  /** Optional preferred iframe size the host may honor. */
  preferredSize?: { width?: number; height?: number };
  /**
   * External origins the widget loads assets from (product images etc).
   * Hosts enforce a strict CSP on the iframe; declare image CDNs here or
   * strict hosts render empty plates. Maps to the resource's `_meta.ui.csp`.
   */
  csp?: { resourceDomains?: string[]; connectDomains?: string[] };
}

const DOC_HEAD =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<style>html,body{margin:0;padding:0;background:transparent}' +
  'body{display:flex;justify-content:center;padding:8px}</style></head><body>';
const DOC_TAIL = "</body></html>";

// The two Unicode line terminators that are valid in JSON strings but are a
// syntax error inside a JS <script>. Built via char codes so no literal line
// separator ever appears in this source file.
const U_LS = String.fromCharCode(0x2028);
const U_PS = String.fromCharCode(0x2029);

/**
 * JSON safe to inline inside a <script> tag: neutralizes `</script>` break-out
 * (via < and >) and the two Unicode line terminators (U+2028 / U+2029).
 */
function safeJson(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .split(U_LS)
    .join("\\u2028")
    .split(U_PS)
    .join("\\u2029");
}

function wrapDocument(inner: string, bootScript: string): string {
  return DOC_HEAD + bootScript + inner + DOC_TAIL;
}

/**
 * Build every wiring artifact for one component render.
 * The `template` you pass is emitted verbatim; this only prepends a boot
 * <script> (baked data for the inline doc, an await flag for the static doc).
 */
export function renderComponent(opts: RenderOptions): RenderResult {
  const { uri, template, data, theme, preferredSize, csp } = opts;

  const themeLine = theme ? `window.__MAU_THEME__=${safeJson(theme)};` : "";
  const bakedScript =
    `<script>window.__MAU_DATA__=${safeJson(data)};${themeLine}</script>`;
  const awaitScript = `<script>window.__MAU_AWAIT__=true;${themeLine}</script>`;

  const html = wrapDocument(template, bakedScript);
  const staticHtml = wrapDocument(template, awaitScript);

  const resourceMeta: Record<string, unknown> = {};
  if (preferredSize) {
    resourceMeta["mcpui.dev/ui-preferred-frame-size"] = [preferredSize.width, preferredSize.height];
  }
  if (csp) {
    resourceMeta["ui"] = { csp };
  }
  const hasResourceMeta = Object.keys(resourceMeta).length > 0;
  const registrationMeta = csp ? { ui: { csp } } : undefined;

  return {
    uri,
    html,
    staticHtml,
    contentBlock: {
      type: "resource",
      resource: {
        uri,
        mimeType: "text/html",
        text: html,
        ...(hasResourceMeta ? { _meta: resourceMeta } : {}),
      },
    },
    toolMeta: { ui: { resourceUri: uri, ...(preferredSize ? { preferredSize } : {}) } },
    resultMeta: { ui: { resourceUri: uri } },
    registrationMeta,
  };
}
