#!/usr/bin/env node
/**
 * Client-conformance driver — exercises the full MCP protocol surface the
 * way a real client (Claude Desktop, Cursor, Cline) does when loading a
 * server.
 *
 * Validates:
 *   1. initialize handshake + capability advertisement
 *   2. tools/list — every tool has a valid JSON Schema (clients refuse load otherwise)
 *   3. prompts/list — empty registry returns cleanly, not a crash
 *   4. resources/list — same
 *   5. tools/call with INVALID input — Zod path returns isError:true (not crash)
 *   6. tools/call with VALID input — happy path returns JSON content
 *   7. tools/call WITHOUT auth env — config error path returns isError:true
 *
 * Exit 0 if all conformance checks pass; non-zero on first failure.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = join(HERE, "..", "dist", "index.js");

const FAILURES = [];
function pass(label, detail = "") {
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail) {
  console.log(`  ❌ ${label} — ${detail}`);
  FAILURES.push({ label, detail });
}

function startServer(env) {
  const child = spawn("node", [BIN], {
    stdio: ["pipe", "pipe", "pipe"],
    env,
  });
  const responses = new Map();
  const stderrLog = [];
  let buf = "";
  child.stdout.on("data", (chunk) => {
    buf += chunk.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined) responses.set(msg.id, msg);
      } catch {}
    }
  });
  child.stderr.on("data", (chunk) => stderrLog.push(chunk.toString()));
  return { child, responses, stderrLog };
}

function send(child, msg) {
  child.stdin.write(JSON.stringify(msg) + "\n");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function awaitResp(responses, id, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (responses.has(id)) return responses.get(id);
    await sleep(20);
  }
  throw new Error(`timeout waiting for id ${id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase A — server with full credentials (happy path + protocol surface)
// ─────────────────────────────────────────────────────────────────────────────

async function phaseA() {
  console.log("\n── Phase A: full-credentials boot ──");
  const env = {
    ...process.env,
    RAKUTEN_APP_ID: process.env.RAKUTEN_APP_ID ?? "test-app-id",
    RAKUTEN_ACCESS_KEY: process.env.RAKUTEN_ACCESS_KEY ?? "test-access-key",
  };
  const { child, responses, stderrLog } = startServer(env);

  try {
    // 1. initialize — what every client does first
    send(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: { roots: { listChanged: true }, sampling: {} },
        clientInfo: { name: "client-conformance", version: "1.0" },
      },
    });
    const init = await awaitResp(responses, 1);
    if (!init.result?.serverInfo?.name) {
      fail("initialize", "no serverInfo.name in response");
      return;
    }
    pass(
      "initialize",
      `${init.result.serverInfo.name} v${init.result.serverInfo.version}`,
    );

    // Verify advertised capabilities
    const caps = init.result.capabilities ?? {};
    if (!caps.tools) fail("capabilities.tools", "missing");
    else pass("capabilities advertise tools");
    // prompts/resources should NOT be advertised when registries are empty —
    // doing so causes "Method not found" errors from clients on /list calls.
    if (caps.prompts !== undefined) {
      fail("capabilities.prompts", "advertised but registry is empty");
    } else {
      pass("prompts capability correctly NOT advertised (empty registry)");
    }
    if (caps.resources !== undefined) {
      fail("capabilities.resources", "advertised but registry is empty");
    } else {
      pass("resources capability correctly NOT advertised (empty registry)");
    }

    // Verify server instructions present (Claude Desktop surfaces these)
    if (!init.result.instructions || init.result.instructions.length < 50) {
      fail("instructions", "missing or too short");
    } else {
      pass("instructions present", `${init.result.instructions.length} chars`);
    }

    send(child, { jsonrpc: "2.0", method: "notifications/initialized" });

    // 2. tools/list — clients call this immediately to populate UI
    send(child, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    const tlist = await awaitResp(responses, 2);
    const tools = tlist.result?.tools ?? [];
    if (tools.length !== 28) {
      fail("tools/list count", `expected 28, got ${tools.length}`);
    } else {
      pass("tools/list", `28 tools enumerated`);
    }

    // Every tool must have a valid JSON Schema or Claude Desktop refuses to load
    const schemaProblems = [];
    for (const t of tools) {
      if (!t.name) schemaProblems.push(`tool missing name`);
      if (!t.description) schemaProblems.push(`${t.name}: no description`);
      if (!t.inputSchema || typeof t.inputSchema !== "object") {
        schemaProblems.push(`${t.name}: inputSchema not an object`);
        continue;
      }
      if (t.inputSchema.type !== "object") {
        schemaProblems.push(`${t.name}: inputSchema.type !== "object"`);
      }
      // Schemas with no properties are valid but unusual; we don't flag them
    }
    if (schemaProblems.length) {
      fail("tools/list schemas", schemaProblems.join("; "));
    } else {
      pass("all 28 tools have valid JSON Schema");
    }

    // Verify bilingual: every description contains "[JA]" marker
    const missingJA = tools.filter((t) => !t.description.includes("[JA]"));
    if (missingJA.length) {
      fail(
        "bilingual descriptions",
        `${missingJA.length} tools missing [JA]: ${missingJA.map((t) => t.name).join(", ")}`,
      );
    } else {
      pass("every tool has bilingual [JA] description");
    }

    // 3. prompts/list — since we don't advertise the capability, real clients
    //    won't call this. But a misbehaving one might; verify we return
    //    "Method not found" cleanly (not a crash).
    send(child, { jsonrpc: "2.0", id: 3, method: "prompts/list" });
    const plist = await awaitResp(responses, 3);
    if (plist.error?.code === -32601) {
      pass("prompts/list returns -32601 (capability not advertised, correct)");
    } else if (Array.isArray(plist.result?.prompts)) {
      pass("prompts/list returns empty array", `${plist.result.prompts.length} prompts`);
    } else {
      fail("prompts/list", `unexpected response: ${JSON.stringify(plist).slice(0, 150)}`);
    }

    // 4. resources/list — same
    send(child, { jsonrpc: "2.0", id: 4, method: "resources/list" });
    const rlist = await awaitResp(responses, 4);
    if (rlist.error?.code === -32601) {
      pass("resources/list returns -32601 (capability not advertised, correct)");
    } else if (Array.isArray(rlist.result?.resources)) {
      pass("resources/list returns empty array", `${rlist.result.resources.length} resources`);
    } else {
      fail("resources/list", `unexpected response: ${JSON.stringify(rlist).slice(0, 150)}`);
    }

    // 5. tools/call with INVALID input — should return isError:true, not crash
    send(child, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "ichiba_item_search",
        arguments: { hits: "not-a-number" }, // missing keyword + bad hits type
      },
    });
    const badResp = await awaitResp(responses, 5);
    if (badResp.error) {
      fail("invalid-input handling", `JSON-RPC error: ${badResp.error.message}`);
    } else if (!badResp.result?.isError) {
      fail("invalid-input handling", "result.isError not set");
    } else {
      pass("invalid-input returns isError:true (Zod path)");
    }

    // 6. tools/call with VALID input + real credentials — happy path
    if (process.env.RAKUTEN_APP_ID && process.env.RAKUTEN_APP_ID !== "test-app-id") {
      send(child, {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "ichiba_item_search",
          arguments: { keyword: "テスト", hits: 1 },
        },
      });
      const goodResp = await awaitResp(responses, 6, 15000);
      if (goodResp.result?.isError) {
        fail(
          "valid-input happy path",
          `tool returned isError: ${goodResp.result.content?.[0]?.text?.slice(0, 100)}`,
        );
      } else if (!goodResp.result?.content?.[0]?.text) {
        fail("valid-input happy path", "no content returned");
      } else {
        let data;
        try {
          data = JSON.parse(goodResp.result.content[0].text);
        } catch {
          fail("valid-input happy path", "content is not JSON");
        }
        if (data && typeof data.count === "number") {
          pass("valid-input happy path", `count=${data.count}`);
        }
      }
    } else {
      console.log("  ⊘ skipping happy-path call (no live credentials in env)");
    }

    // 7. Unknown tool — must return JSON-RPC error or isError, not hang/crash
    send(child, {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "this_tool_does_not_exist", arguments: {} },
    });
    const unknown = await awaitResp(responses, 7);
    if (unknown.error || unknown.result?.isError) {
      pass("unknown tool returns error cleanly");
    } else {
      fail("unknown tool handling", "no error returned");
    }
  } catch (e) {
    fail("phase A driver", e.message);
  } finally {
    child.kill();
  }

  if (stderrLog.length) {
    // Server writes a single startup banner to stderr — that's expected.
    // Anything else might be a problem.
    const log = stderrLog.join("");
    const banner = "rakuten-mcp v1.0.0 running on stdio\n";
    if (log === banner) {
      pass("stderr is clean (banner only)");
    } else {
      const extra = log.replace(banner, "").trim();
      if (extra) {
        console.log(`  ⚠️  unexpected stderr output:\n      ${extra.slice(0, 300)}`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase B — server WITHOUT credentials (does it still boot, list tools, and
// return a graceful config error when called?)
// ─────────────────────────────────────────────────────────────────────────────

async function phaseB() {
  console.log("\n── Phase B: NO-credentials boot (graceful degradation) ──");
  const env = { ...process.env };
  delete env.RAKUTEN_APP_ID;
  delete env.RAKUTEN_ACCESS_KEY;
  delete env.RAKUTEN_AFFILIATE_ID;

  const { child, responses } = startServer(env);
  try {
    send(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "client-conformance-no-auth", version: "1.0" },
      },
    });
    const init = await awaitResp(responses, 1, 5000);
    if (init.result?.serverInfo?.name) {
      pass("server boots without credentials");
    } else {
      fail("server boots without credentials", "no serverInfo");
      return;
    }
    send(child, { jsonrpc: "2.0", method: "notifications/initialized" });

    send(child, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    const tlist = await awaitResp(responses, 2, 5000);
    if (tlist.result?.tools?.length === 28) {
      pass("tools/list works without credentials (28 tools enumerated)");
    } else {
      fail("tools/list without credentials", `got ${tlist.result?.tools?.length}`);
    }

    // Calling a tool should fail GRACEFULLY with isError, not crash
    send(child, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "ichiba_item_search", arguments: { keyword: "test" } },
    });
    const callResp = await awaitResp(responses, 3, 5000);
    if (
      callResp.result?.isError &&
      (callResp.result.content?.[0]?.text || "").includes("RAKUTEN_APP_ID")
    ) {
      pass("uncredentialed tool call returns graceful config error");
    } else {
      fail(
        "uncredentialed tool call",
        `expected isError mentioning RAKUTEN_APP_ID; got: ${JSON.stringify(callResp.result).slice(0, 200)}`,
      );
    }
  } catch (e) {
    fail("phase B driver", e.message);
  } finally {
    child.kill();
  }
}

// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("MCP client-conformance test for rakuten-mcp");
  console.log("Mimics what Claude Desktop / Cursor / Cline do on load");
  console.log("═══════════════════════════════════════════════════════════");

  await phaseA();
  await phaseB();

  console.log("\n═══════════════════════════════════════════════════════════");
  if (FAILURES.length === 0) {
    console.log("✅ All conformance checks passed");
    process.exit(0);
  } else {
    console.log(`❌ ${FAILURES.length} conformance check(s) failed:`);
    for (const f of FAILURES) console.log(`   - ${f.label}: ${f.detail}`);
    process.exit(1);
  }
})();
