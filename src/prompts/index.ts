/**
 * Prompt registry.
 * Prompts are added alongside their corresponding tool families.
 */

import type { PromptDefinition } from "../tools/types.js";
import { planRakutenTrip } from "./travel.js";

export const prompts: PromptDefinition[] = [planRakutenTrip];
