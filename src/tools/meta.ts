/**
 * Shared MCP metadata helpers: read-only annotations + automatic parameter titles.
 *
 * Every Rakuten tool is a read-only call against an external HTTP API, so they
 * all share one annotation preset. Parameter display titles are derived from
 * each Zod field's key, so Smithery (and client UIs that render a label per
 * field) get a title without hand-writing one on all ~150 parameters.
 */

import type { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/** A read-only call against the external Rakuten Web Service (open world). */
export const READONLY: ToolAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: true,
};

const ACRONYMS = new Set(["id", "url", "api", "isbn", "jan", "ng", "uuid", "sdk", "ng"]);

/** camelCase / snake_case parameter key → human Title Case (with acronym fixes). */
export function titleFromKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      ACRONYMS.has(w.toLowerCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

/** Return a copy of a Zod object shape with a display `title` on every field. */
export function withParamTitles(shape: z.ZodRawShape): z.ZodRawShape {
  return Object.fromEntries(
    Object.entries(shape).map(([key, field]) => [
      key,
      (field as z.ZodTypeAny).meta({ title: titleFromKey(key) }),
    ]),
  ) as z.ZodRawShape;
}
