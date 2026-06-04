/**
 * Tool registry.
 *
 * Each API family exports its tools; this file aggregates them.
 * Family files are added during Week 1-3 of v1.0 build.
 */

import type { ToolDefinition } from "./types.js";
import { ichibaItemSearchTool } from "./ichiba.js";

export const tools: ToolDefinition[] = [
  // Ichiba tools (1 of 6-7)
  ichibaItemSearchTool,
  // Books tools — added Week 2
  // Travel tools — added Week 2
  // Recipe tools — added Week 3
  // Kobo tools — added Week 3
  // GORA tools — added Week 3
];

export type { ToolDefinition } from "./types.js";
