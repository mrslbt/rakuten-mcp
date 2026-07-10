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
  /** Optional MCP Apps UI: links this tool to a ui:// resource rendered by App hosts. */
  ui?: { resourceUri: string };
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
