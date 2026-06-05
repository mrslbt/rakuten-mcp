/**
 * Guided hotel-search workflow prompt.
 *
 * Chains the Travel family: resolve an area → list vacant hotels for the dates →
 * inspect the top pick. Gives the model a concrete plan instead of guessing
 * which of the travel_* tools to call in what order.
 */

import type { PromptDefinition } from "../tools/types.js";

export const planRakutenTrip: PromptDefinition = {
  name: "plan_rakuten_trip",
  title: {
    en: "Plan a trip with Rakuten Travel",
    ja: "楽天トラベルで旅行を計画",
  },
  description: {
    en: "Guided hotel search — resolve an area, find vacant hotels for your dates, then inspect the best pick. Chains travel_get_area_class → travel_vacant_hotel_search → travel_hotel_detail_search.",
    ja: "エリア解決→空室検索→詳細確認の順でホテルを探すガイド。travel_get_area_class → travel_vacant_hotel_search → travel_hotel_detail_search を連携します。",
  },
  arguments: [
    {
      name: "destination",
      description: {
        en: "City/area or hotel keyword, e.g. 'Hakone' or 'Kyoto station'.",
        ja: "都市・エリアまたはホテルのキーワード。例:「箱根」「京都駅」。",
      },
      required: true,
    },
    {
      name: "checkin",
      description: { en: "Check-in date, YYYY-MM-DD.", ja: "チェックイン日 YYYY-MM-DD。" },
      required: false,
    },
    {
      name: "checkout",
      description: { en: "Check-out date, YYYY-MM-DD.", ja: "チェックアウト日 YYYY-MM-DD。" },
      required: false,
    },
    {
      name: "guests",
      description: { en: "Number of adult guests (default 2).", ja: "大人の人数(デフォルト2)。" },
      required: false,
    },
  ],
  build: (args) => {
    const dest = args.destination?.trim() || "(destination not given — ask the user)";
    const checkin = args.checkin?.trim() || "(ask the user for dates)";
    const checkout = args.checkout?.trim() || "(ask the user for dates)";
    const guests = args.guests?.trim() || "2";
    return {
      en: `Help me find a hotel using Rakuten Travel.

Destination: ${dest}
Check-in: ${checkin}
Check-out: ${checkout}
Adult guests: ${guests}

Plan:
1. If the destination is an area (not one specific hotel), call travel_get_area_class to resolve its largeClassCode / middleClassCode / smallClassCode. If it's a named hotel, use travel_keyword_hotel_search instead.
2. Call travel_vacant_hotel_search with the resolved area codes and the check-in/check-out dates to list hotels that actually have availability.
3. Pick the best 1–3 options and call travel_hotel_detail_search on each for rooms, plans, prices, and access.

Then recommend the single best option with its price, location, and one honest tradeoff.`,
      ja: `楽天トラベルでホテル探しを手伝ってください。

目的地: ${dest}
チェックイン: ${checkin}
チェックアウト: ${checkout}
大人: ${guests}

手順:
1. 目的地がエリアの場合は travel_get_area_class でエリアコードを解決。特定ホテル名なら travel_keyword_hotel_search を使用。
2. travel_vacant_hotel_search にエリアコードと日付を渡し、空室のあるホテルを取得。
3. 上位1〜3件を travel_hotel_detail_search で部屋・プラン・料金・アクセスを確認。

最後に、料金・立地・正直なトレードオフを添えて一番のおすすめを提示してください。`,
    };
  },
};
