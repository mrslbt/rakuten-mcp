/**
 * Shared types for the MCP tool registry.
 *
 * Each tool ships bilingual EN/JA descriptions and a Zod input schema.
 * Tools are pure functions of (input, config) — no global mutable state.
 */

import type { z } from "zod";
import type { Config } from "../config.js";
import type { Bilingual } from "../i18n.js";

export type ToolInputSchema = z.ZodObject<z.ZodRawShape>;

export interface ToolDefinition<TInput extends ToolInputSchema = ToolInputSchema> {
  /** snake_case, prefixed by API family (e.g. ichiba_item_search). */
  name: string;
  /** Bilingual title for client UIs. */
  title: Bilingual;
  /** Bilingual description for the LLM. */
  description: Bilingual;
  /** Input schema validated with Zod before reaching the handler. */
  inputSchema: TInput;
  /** Handler receives validated input and the loaded config. Returns the response body. */
  handler: (input: z.infer<TInput>, config: Config) => Promise<unknown>;
  /**
   * Optional MCP Apps (SEP-1865) widget. Handlers stay pure; presentation is
   * applied at the server edge. When set, the server registers the `ui://`
   * resource, links it via `_meta.ui.resourceUri`, and appends the rendered
   * widget to the tool result for MCP Apps hosts. Non-Apps clients still get
   * the JSON text block.
   */
  ui?: ToolUiDefinition;
}

export interface ToolUiDefinition {
  /** The `ui://` identifier, e.g. "ui://rakuten/product-list". */
  uri: string;
  /** Bilingual widget name for resource listings. */
  title: Bilingual;
  /** Self-contained component HTML (vendored from the mcp-apps-ui kit). */
  template: string;
  /**
   * External origins the widget loads assets from (product image CDNs).
   * Declared on the ui:// resource as `_meta.ui.csp` so strict hosts allow
   * the loads instead of rendering empty plates.
   */
  csp?: { resourceDomains?: string[]; connectDomains?: string[] };
  /**
   * Map the handler's result body to the component's data contract.
   * Return null to skip the widget for this call (e.g. empty results).
   */
  map: (result: unknown, input: unknown) => unknown | null;
}

export interface PromptDefinition {
  name: string;
  title: Bilingual;
  description: Bilingual;
  arguments?: Array<{
    name: string;
    description: Bilingual;
    required: boolean;
  }>;
  /** Returns the prompt text for the LLM. */
  build: (args: Record<string, string | undefined>) => { en: string; ja?: string };
}

export interface ResourceDefinition {
  uri: string;
  name: string;
  title: Bilingual;
  description: Bilingual;
  mimeType: string;
  read: (config: Config) => string | Promise<string>;
}
