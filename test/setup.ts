/**
 * Global vitest setup — starts a single msw server for the entire test run.
 *
 * `onUnhandledRequest: "error"` makes any test that accidentally calls a real
 * URL fail loudly. Every Rakuten request in tests must be served by a handler
 * registered via `server.use(...)` inside the test or in handlers/.
 */

import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw-server.js";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
