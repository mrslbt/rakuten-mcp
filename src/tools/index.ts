/**
 * Tool registry.
 *
 * Each API family exports its tools; this file aggregates them.
 * Family files are added during Week 1-3 of v1.0 build.
 */

import type { ToolDefinition } from "./types.js";
import {
  ichibaGenreSearchTool,
  ichibaItemRankingTool,
  ichibaItemSearchTool,
  ichibaProductSearchTool,
  ichibaTagSearchTool,
} from "./ichiba.js";

export const tools: ToolDefinition[] = [
  // Ichiba tools (5 of 5 — complete)
  // Note: AttributeSearch and Item Review do NOT exist on Rakuten's API as of
  // 2026-06-04 (verified via direct probes). Both return "Operation X doesn't
  // exist" — they appeared in third-party docs but are not real endpoints.
  ichibaItemSearchTool,
  ichibaGenreSearchTool,
  ichibaTagSearchTool,
  ichibaItemRankingTool,
  ichibaProductSearchTool,
  // Books tools — added Week 2
  // Travel tools — added Week 2
  // Recipe tools — added Week 3
  // Kobo tools — added Week 3
  // GORA tools — added Week 3
];

export type { ToolDefinition } from "./types.js";
