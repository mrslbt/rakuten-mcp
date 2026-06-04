/**
 * GORA (Rakuten GORA — golf course reservation) tools.
 *
 * Host: openapi.rakuten.co.jp (verified live 2026-06-04).
 * Path root: /engine/api/Gora/...
 *
 *   - Gora/GoraGolfCourseSearch/20170623  — list courses by area
 *   - Gora/GoraGolfCourseDetail/20170623  — full details for one course
 *   - Gora/GoraPlanSearch/20170623        — available plans on a play date
 *
 * Search responses use the standard {count, Items: [{Item: {...}}]} envelope.
 * Detail wraps a single course as {Item: {...}} (no Items array).
 * Plan responses include a nested planInfo: [{plan: {...}}] per course.
 */

import { z } from "zod";
import { HOST_OPENAPI } from "../config.js";
import { rakutenRequest } from "../client.js";
import { bilingual } from "../i18n.js";
import type { ToolDefinition } from "./types.js";

// ──────────────────────────────────────────────────────────────────────────────
// Shared types — golf course summaries shared between search and plan responses
// ──────────────────────────────────────────────────────────────────────────────

interface RawCourseSummary {
  golfCourseId?: number;
  golfCourseName?: string;
  golfCourseAbbr?: string;
  golfCourseNameKana?: string;
  golfCourseCaption?: string;
  address?: string;
  prefecture?: string;
  highway?: string;
  ic?: string;
  icDistance?: number;
  latitude?: number;
  longitude?: number;
  evaluation?: number | string;
  ratingNum?: number;
  golfCourseImageUrl?: string;
  golfCourseDetailUrl?: string;
  reserveCalUrl?: string;
  ratingUrl?: string;
}

export interface GolfCourseSummary {
  golfCourseId: number;
  golfCourseName: string;
  golfCourseAbbr?: string;
  golfCourseCaption?: string;
  address?: string;
  prefecture?: string;
  highway?: string;
  ic?: string;
  icDistance?: number;
  latitude?: number;
  longitude?: number;
  evaluation?: number | string;
  ratingNum?: number;
  imageUrl?: string;
  detailUrl?: string;
  reserveCalUrl?: string;
}

function mapCourseSummary(r: RawCourseSummary): GolfCourseSummary {
  return {
    golfCourseId: r.golfCourseId ?? 0,
    golfCourseName: r.golfCourseName ?? "",
    golfCourseAbbr: r.golfCourseAbbr,
    golfCourseCaption: r.golfCourseCaption,
    address: r.address,
    prefecture: r.prefecture,
    highway: r.highway,
    ic: r.ic,
    icDistance: r.icDistance,
    latitude: r.latitude,
    longitude: r.longitude,
    evaluation: r.evaluation,
    ratingNum: r.ratingNum,
    imageUrl: r.golfCourseImageUrl,
    detailUrl: r.golfCourseDetailUrl,
    reserveCalUrl: r.reserveCalUrl,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// gora_golf_course_search
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Rakuten GORA area codes (numeric 1–47 + a few aggregate codes).
 * Pass as the `areaCode` parameter. Not exhaustively enumerated in Zod since
 * Rakuten occasionally adds new entries; the API will reject unknowns.
 */
const golfCourseSearchInput = z.object({
  areaCode: z
    .string()
    .optional()
    .describe(
      "Area code (e.g. '13' = Tokyo, '14' = Kanagawa, '23' = Aichi). Either areaCode or keyword is required. エリアコード(例: '13' 東京、'14' 神奈川)。areaCode または keyword が必要。",
    ),
  keyword: z
    .string()
    .optional()
    .describe(
      "Free-text keyword (course name, location). 検索キーワード(コース名/エリア)。",
    ),
  latitude: z.number().optional().describe("Latitude. 緯度。"),
  longitude: z.number().optional().describe("Longitude. 経度。"),
  searchRange: z
    .number()
    .min(1)
    .max(80)
    .optional()
    .describe(
      "Search radius in km (1–80) when using lat/lon. 検索半径(km、1〜80)。",
    ),
  hits: z.number().int().min(1).max(30).default(10).describe("Results per page. 取得件数。"),
  page: z.number().int().min(1).max(100).default(1).describe("Page number. ページ番号。"),
}).refine(
  (v) =>
    Boolean(v.areaCode) ||
    Boolean(v.keyword) ||
    (v.latitude !== undefined && v.longitude !== undefined),
  { message: "Provide areaCode, keyword, or both latitude+longitude. areaCode / keyword / (latitude+longitude) のいずれか必要。" },
);

interface RawGolfCourseSearchResponse {
  count?: number;
  page?: number;
  first?: number;
  last?: number;
  hits?: number;
  pageCount?: number;
  Items?: Array<{ Item: RawCourseSummary }>;
}

export interface GolfCourseSearchResult {
  count: number;
  page: number;
  first: number;
  last: number;
  hits: number;
  pageCount: number;
  courses: GolfCourseSummary[];
}

export const goraGolfCourseSearchTool: ToolDefinition<typeof golfCourseSearchInput> = {
  name: "gora_golf_course_search",
  title: bilingual("Search Rakuten GORA Golf Courses", "楽天GORAでゴルフ場検索"),
  description: bilingual(
    "Search Rakuten GORA golf courses by area code, keyword, or coordinates. Returns each course with name, address, nearest highway IC, distance from IC, evaluation score, image URL, and a direct reservation calendar URL. Use gora_golf_course_detail for full information including plans, course layout, and facilities.",
    "楽天GORAのゴルフ場を、エリアコード/キーワード/座標で検索します。コース名、住所、最寄りIC、IC距離、評価、画像、予約カレンダーURLを返します。プラン詳細やコースレイアウト等の全情報は gora_golf_course_detail を使用してください。",
  ),
  inputSchema: golfCourseSearchInput,
  async handler(args, config) {
    const params: Record<string, string> = {
      hits: String(args.hits),
      page: String(args.page),
    };
    if (args.areaCode) params.areaCode = args.areaCode;
    if (args.keyword) params.keyword = args.keyword;
    if (args.latitude !== undefined) params.latitude = String(args.latitude);
    if (args.longitude !== undefined) params.longitude = String(args.longitude);
    if (args.searchRange !== undefined) params.searchRange = String(args.searchRange);

    const raw = await rakutenRequest<RawGolfCourseSearchResponse>(
      {
        host: HOST_OPENAPI,
        path: "/engine/api/Gora/GoraGolfCourseSearch/20170623",
        params,
      },
      config,
    );
    return {
      count: raw.count ?? 0,
      page: raw.page ?? args.page,
      first: raw.first ?? 0,
      last: raw.last ?? 0,
      hits: raw.hits ?? args.hits,
      pageCount: raw.pageCount ?? 0,
      courses: (raw.Items ?? []).map((w) => mapCourseSummary(w.Item)),
    } satisfies GolfCourseSearchResult;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// gora_golf_course_detail
// ──────────────────────────────────────────────────────────────────────────────

const golfCourseDetailInput = z.object({
  golfCourseId: z
    .number()
    .int()
    .positive()
    .describe("Golf course ID (from gora_golf_course_search). ゴルフ場ID(検索結果から取得)。"),
});

interface RawGolfCourseDetail extends RawCourseSummary {
  postalCode?: string;
  telephoneNo?: string;
  faxNo?: string;
  golfCourseImageUrl1?: string;
  golfCourseImageUrl2?: string;
  golfCourseImageUrl3?: string;
  golfCourseImageUrl4?: string;
  golfCourseImageUrl5?: string;
  openDay?: string;
  closeDay?: string;
  designer?: string;
  holeCount?: number;
  parCount?: number;
  courseDistance?: number;
  courseType?: string;
  fairway?: string;
  green?: string;
  greenCount?: number;
  dimension?: string;
  distance?: string;
  courseVerticalInterval?: string;
  costperformance?: number | string;
  evaluation?: number | string;
  dressCode?: string;
  practiceFacility?: string;
  lodgingFacility?: string;
  otherFacility?: string;
  facility?: string;
  meal?: string;
  shoes?: string;
  creditCard?: string;
  information?: string;
  longDrivingContest?: string;
  nearPin?: string;
  layoutUrl?: string;
  voiceUrl?: string;
  routeMapUrl?: string;
  baseWeekdayMinPrice?: number;
  baseHolidayMinPrice?: number;
  weekdayMinPrice?: number;
  holidayMinPrice?: number;
}

export interface GolfCourseDetail extends GolfCourseSummary {
  postalCode?: string;
  telephoneNo?: string;
  faxNo?: string;
  /** All 5 image slots merged into a single array, nulls dropped. */
  imageUrls: string[];
  openDay?: string;
  closeDay?: string;
  designer?: string;
  holeCount?: number;
  parCount?: number;
  courseDistance?: number;
  courseType?: string;
  fairway?: string;
  green?: string;
  greenCount?: number;
  practiceFacility?: string;
  lodgingFacility?: string;
  facility?: string;
  meal?: string;
  creditCard?: string;
  costPerformance?: number | string;
  dressCode?: string;
  layoutUrl?: string;
  routeMapUrl?: string;
  /** Lowest list prices (before discount). 平日/休日の基準最安値。 */
  baseWeekdayMinPrice?: number;
  baseHolidayMinPrice?: number;
  /** Lowest displayed prices. 平日/休日の表示最安値。 */
  weekdayMinPrice?: number;
  holidayMinPrice?: number;
}

interface RawGolfCourseDetailResponse {
  Item?: RawGolfCourseDetail;
}

export const goraGolfCourseDetailTool: ToolDefinition<typeof golfCourseDetailInput> = {
  name: "gora_golf_course_detail",
  title: bilingual("Get Rakuten GORA Golf Course Detail", "楽天GORAのゴルフ場詳細を取得"),
  description: bilingual(
    "Get full details for a Rakuten GORA golf course by ID — postal address, phone, designer, hole/par count, course distance, green type, dress code, practice/lodging/meal facilities, credit card acceptance, layout map URL, and weekday/holiday base prices. Use this after gora_golf_course_search to drill into a specific course.",
    "楽天GORAのゴルフ場詳細をIDで取得します。郵便番号、電話、設計者、ホール数、パー数、コース距離、グリーン種別、ドレスコード、練習場/宿泊/食事/クレジットカード可否、レイアウトURL、平日/休日の基準最安値を返します。",
  ),
  inputSchema: golfCourseDetailInput,
  async handler(args, config) {
    const raw = await rakutenRequest<RawGolfCourseDetailResponse>(
      {
        host: HOST_OPENAPI,
        path: "/engine/api/Gora/GoraGolfCourseDetail/20170623",
        params: { golfCourseId: String(args.golfCourseId) },
      },
      config,
    );
    const r = raw.Item ?? {};
    const summary = mapCourseSummary(r);
    const imageUrls = [
      r.golfCourseImageUrl1,
      r.golfCourseImageUrl2,
      r.golfCourseImageUrl3,
      r.golfCourseImageUrl4,
      r.golfCourseImageUrl5,
    ].filter((u): u is string => Boolean(u));
    return {
      ...summary,
      postalCode: r.postalCode,
      telephoneNo: r.telephoneNo,
      faxNo: r.faxNo,
      imageUrls,
      openDay: r.openDay,
      closeDay: r.closeDay,
      designer: r.designer,
      holeCount: r.holeCount,
      parCount: r.parCount,
      courseDistance: r.courseDistance,
      courseType: r.courseType,
      fairway: r.fairway,
      green: r.green,
      greenCount: r.greenCount,
      practiceFacility: r.practiceFacility,
      lodgingFacility: r.lodgingFacility,
      facility: r.facility,
      meal: r.meal,
      creditCard: r.creditCard,
      costPerformance: r.costperformance,
      dressCode: r.dressCode,
      layoutUrl: r.layoutUrl,
      routeMapUrl: r.routeMapUrl,
      baseWeekdayMinPrice: r.baseWeekdayMinPrice,
      baseHolidayMinPrice: r.baseHolidayMinPrice,
      weekdayMinPrice: r.weekdayMinPrice,
      holidayMinPrice: r.holidayMinPrice,
    } satisfies GolfCourseDetail;
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// gora_plan_search
// ──────────────────────────────────────────────────────────────────────────────

const planSearchInput = z.object({
  areaCode: z.string().optional().describe("Area code (e.g. '13' = Tokyo). エリアコード。"),
  playDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD")
    .describe("Play date (YYYY-MM-DD). プレー日(YYYY-MM-DD)。"),
  golfCourseId: z.number().int().positive().optional().describe("Restrict to a specific course. 特定のゴルフ場で絞り込み。"),
  playerNum: z.number().int().min(1).max(4).optional().describe("Number of players (1–4). プレイヤー数。"),
  budget: z.number().int().positive().optional().describe("Max budget per player (JPY). 1人あたりの予算上限(円)。"),
  hits: z.number().int().min(1).max(30).default(10).describe("Results per page. 取得件数。"),
  page: z.number().int().min(1).max(100).default(1).describe("Page number. ページ番号。"),
}).refine(
  (v) => Boolean(v.areaCode) || v.golfCourseId !== undefined,
  { message: "Provide either areaCode or golfCourseId. areaCode か golfCourseId が必要。" },
);

interface RawPlan {
  planId?: number | string;
  planName?: string;
  planType?: number;
  basePrice?: number;
  price?: number;
  cart?: string;
  caddie?: string;
  lunch?: string;
  drink?: string;
  round?: number | string;
  startTimeZone?: string;
  playerNumMin?: number;
  playerNumMax?: number;
  point?: number;
  pointFlag?: number;
  limitedTimeFlag?: number;
  stay?: string;
}

interface RawPlanItem extends RawCourseSummary {
  areaCode?: string;
  displayWeekdayMinPrice?: number;
  displayWeekdayMinBasePrice?: number;
  displayHolidayMinPrice?: number;
  displayHolidayMinBasePrice?: number;
  golfCourseRsvType?: number;
  cancelFee?: string;
  cancelFeeFlag?: number;
  highwayCode?: string;
  planInfo?: Array<{ plan: RawPlan }>;
}

interface RawPlanSearchResponse {
  count?: number;
  page?: number;
  first?: number;
  last?: number;
  hits?: number;
  pageCount?: number;
  Items?: Array<{ Item: RawPlanItem }>;
}

export interface GoraPlan {
  planId?: string;
  planName?: string;
  basePrice?: number;
  price?: number;
  cart?: string;
  caddie?: string;
  lunch?: string;
  drink?: string;
  round?: number | string;
  startTimeZone?: string;
  playerNumMin?: number;
  playerNumMax?: number;
  point?: number;
  isStay: boolean;
}

export interface GolfCourseWithPlans extends GolfCourseSummary {
  displayWeekdayMinPrice?: number;
  displayHolidayMinPrice?: number;
  cancelFee?: string;
  plans: GoraPlan[];
}

export interface GoraPlanSearchResult {
  count: number;
  page: number;
  first: number;
  last: number;
  hits: number;
  pageCount: number;
  courses: GolfCourseWithPlans[];
}

function mapPlan(raw: RawPlan): GoraPlan {
  return {
    planId: raw.planId !== undefined ? String(raw.planId) : undefined,
    planName: raw.planName,
    basePrice: raw.basePrice,
    price: raw.price,
    cart: raw.cart,
    caddie: raw.caddie,
    lunch: raw.lunch,
    drink: raw.drink,
    round: raw.round,
    startTimeZone: raw.startTimeZone,
    playerNumMin: raw.playerNumMin,
    playerNumMax: raw.playerNumMax,
    point: raw.point,
    isStay: Boolean(raw.stay && raw.stay !== ""),
  };
}

export const goraPlanSearchTool: ToolDefinition<typeof planSearchInput> = {
  name: "gora_plan_search",
  title: bilingual("Search Rakuten GORA Reservation Plans", "楽天GORAのプラン検索"),
  description: bilingual(
    "Search Rakuten GORA for available reservation plans on a specific play date. Returns each golf course together with its available plans (plan name, price per player, base price, cart/caddie/lunch/drink inclusions, start time zone, points). Filter by area code, specific golfCourseId, player count, or budget cap. Use this to compare options across courses before reserving.",
    "指定のプレー日における楽天GORAの予約可能プランを検索します。各ゴルフ場と利用可能プラン(プラン名、1人あたりの価格、基準価格、カート/キャディ/昼食/ドリンクの付帯、スタート時間帯、ポイント)を返します。エリアコード、ゴルフ場ID、プレイヤー数、予算で絞り込み可能。",
  ),
  inputSchema: planSearchInput,
  async handler(args, config) {
    const params: Record<string, string> = {
      playDate: args.playDate,
      hits: String(args.hits),
      page: String(args.page),
    };
    if (args.areaCode) params.areaCode = args.areaCode;
    if (args.golfCourseId !== undefined) params.golfCourseId = String(args.golfCourseId);
    if (args.playerNum !== undefined) params.playerNum = String(args.playerNum);
    if (args.budget !== undefined) params.budget = String(args.budget);

    const raw = await rakutenRequest<RawPlanSearchResponse>(
      {
        host: HOST_OPENAPI,
        path: "/engine/api/Gora/GoraPlanSearch/20170623",
        params,
      },
      config,
    );
    return {
      count: raw.count ?? 0,
      page: raw.page ?? args.page,
      first: raw.first ?? 0,
      last: raw.last ?? 0,
      hits: raw.hits ?? args.hits,
      pageCount: raw.pageCount ?? 0,
      courses: (raw.Items ?? []).map((w) => {
        const summary = mapCourseSummary(w.Item);
        return {
          ...summary,
          displayWeekdayMinPrice: w.Item.displayWeekdayMinPrice,
          displayHolidayMinPrice: w.Item.displayHolidayMinPrice,
          cancelFee: w.Item.cancelFee,
          plans: (w.Item.planInfo ?? []).map((p) => mapPlan(p.plan)),
        };
      }),
    } satisfies GoraPlanSearchResult;
  },
};
