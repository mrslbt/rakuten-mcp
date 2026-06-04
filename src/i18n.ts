/**
 * Bilingual EN/JA labels used across tool/prompt/resource descriptions.
 *
 * Every user-facing string surfaced by the MCP MUST have non-empty `en` and `ja`.
 * Bilingual descriptions are a first-class product decision: Japanese-speaking
 * agents and English-speaking developers both deserve native-language tool docs.
 *
 * CI enforces non-empty values (test/i18n.test.ts).
 */

export interface Bilingual {
  readonly en: string;
  readonly ja: string;
}

/**
 * Convenience helper for inline use.
 *
 * ```ts
 * description: bilingual("Search products", "商品を検索")
 * ```
 */
export function bilingual(en: string, ja: string): Bilingual {
  return { en, ja };
}

/**
 * Default error messages, mirrored across the typed errors in src/errors.ts.
 */
export const errorMessages = {
  configMissing: bilingual(
    "RAKUTEN_APP_ID and RAKUTEN_ACCESS_KEY must be set. Get free credentials at https://webservice.rakuten.co.jp/",
    "RAKUTEN_APP_ID と RAKUTEN_ACCESS_KEY を設定してください。無料の認証情報: https://webservice.rakuten.co.jp/",
  ),
  authInvalid: bilingual(
    "Rakuten API rejected the credentials. Check that RAKUTEN_APP_ID and RAKUTEN_ACCESS_KEY are valid.",
    "Rakuten API が認証情報を拒否しました。RAKUTEN_APP_ID と RAKUTEN_ACCESS_KEY を確認してください。",
  ),
  rateLimited: bilingual(
    "Rakuten API rate limit exceeded. Retrying with backoff.",
    "Rakuten API のレート制限を超過しました。バックオフで再試行します。",
  ),
  serverError: bilingual(
    "Rakuten API returned a server error.",
    "Rakuten API がサーバーエラーを返しました。",
  ),
  notFound: bilingual(
    "Rakuten API returned 404. The endpoint may have been moved or deprecated.",
    "Rakuten API が 404 を返しました。エンドポイントが移動または廃止された可能性があります。",
  ),
  malformedResponse: bilingual(
    "Rakuten API returned a response that could not be parsed.",
    "Rakuten API が解析できないレスポンスを返しました。",
  ),
  unknown: bilingual(
    "Unexpected error from Rakuten API.",
    "Rakuten API からの予期しないエラーです。",
  ),
} as const;
