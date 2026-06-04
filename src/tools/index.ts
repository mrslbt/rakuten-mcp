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
import {
  booksBookSearchTool,
  booksCDSearchTool,
  booksDVDSearchTool,
  booksForeignBookSearchTool,
  booksGameSearchTool,
  booksGenreSearchTool,
  booksMagazineSearchTool,
  booksSoftwareSearchTool,
  booksTotalSearchTool,
} from "./books.js";
import {
  travelGetAreaClassTool,
  travelGetHotelChainListTool,
  travelHotelDetailSearchTool,
  travelHotelRankingTool,
  travelKeywordHotelSearchTool,
  travelSimpleHotelSearchTool,
  travelVacantHotelSearchTool,
} from "./travel.js";
import {
  recipeCategoryListTool,
  recipeCategoryRankingTool,
} from "./recipe.js";
import {
  koboEbookSearchTool,
  koboGenreSearchTool,
} from "./kobo.js";
import {
  goraGolfCourseDetailTool,
  goraGolfCourseSearchTool,
  goraPlanSearchTool,
} from "./gora.js";

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
  // Books tools (9 of 9 — Week 2)
  booksTotalSearchTool,
  booksBookSearchTool,
  booksCDSearchTool,
  booksDVDSearchTool,
  booksForeignBookSearchTool,
  booksMagazineSearchTool,
  booksGameSearchTool,
  booksSoftwareSearchTool,
  booksGenreSearchTool,
  // Travel tools (7 of 7 — Week 2)
  travelSimpleHotelSearchTool,
  travelVacantHotelSearchTool,
  travelHotelDetailSearchTool,
  travelGetAreaClassTool,
  travelKeywordHotelSearchTool,
  travelGetHotelChainListTool,
  travelHotelRankingTool,
  // Recipe tools (2 of 2 — Week 3)
  recipeCategoryListTool,
  recipeCategoryRankingTool,
  // Kobo tools (2 of 2 — Week 3)
  koboEbookSearchTool,
  koboGenreSearchTool,
  // GORA tools (3 of 3 — Week 3)
  goraGolfCourseSearchTool,
  goraGolfCourseDetailTool,
  goraPlanSearchTool,
];

export type { ToolDefinition } from "./types.js";
