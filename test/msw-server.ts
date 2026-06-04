/**
 * Shared msw server instance, used by every test file and by `test/setup.ts`.
 *
 * Default handlers (from `test/handlers/*.handlers.ts`) are NOT registered here.
 * Each test imports the handlers it needs and calls `server.use(...)`.
 * This makes scenarios explicit and prevents accidental cross-test interference.
 */

import { setupServer } from "msw/node";

export const server = setupServer();
