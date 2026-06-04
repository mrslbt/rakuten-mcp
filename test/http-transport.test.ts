/**
 * Unit tests for the HTTP transport security gate.
 *
 * Full end-to-end transport tests would require spinning up a real HTTP
 * server and an MCP client. Those are deferred to the manual smoke step
 * during release. Here we verify the gate logic in isolation, which is
 * where 100% of the security-critical decisions live.
 */

import { describe, expect, it } from "vitest";
import { isPubliclyBound } from "../src/config.js";
import { gateRequest } from "../src/transports/http.js";

const baseConfig = {
  httpHost: "127.0.0.1",
  httpAuthToken: undefined as string | undefined,
  httpAllowedOrigins: [] as string[],
};

describe("gateRequest — host validation", () => {
  it("allows localhost loopback", () => {
    const r = gateRequest({ host: "127.0.0.1:3000" }, baseConfig);
    expect(r.ok).toBe(true);
  });

  it("allows 'localhost' name", () => {
    const r = gateRequest({ host: "localhost:3000" }, baseConfig);
    expect(r.ok).toBe(true);
  });

  it("allows the configured host", () => {
    const r = gateRequest({ host: "10.0.0.5:3000" }, { ...baseConfig, httpHost: "10.0.0.5" });
    expect(r.ok).toBe(true);
  });

  it("rejects any other host (DNS rebinding protection)", () => {
    const r = gateRequest({ host: "evil.example.com:3000" }, baseConfig);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
    expect(r.reason).toMatch(/Host/);
  });

  it("allows missing Host header (CLI tools)", () => {
    const r = gateRequest({}, baseConfig);
    expect(r.ok).toBe(true);
  });
});

describe("gateRequest — origin validation", () => {
  it("allows missing Origin (curl/CLI)", () => {
    const r = gateRequest({ host: "127.0.0.1:3000" }, baseConfig);
    expect(r.ok).toBe(true);
  });

  it("allows localhost-like Origins automatically", () => {
    const cases = [
      "http://127.0.0.1",
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "https://localhost:3000",
      "http://[::1]:3000",
    ];
    for (const origin of cases) {
      const r = gateRequest({ host: "127.0.0.1:3000", origin }, baseConfig);
      expect(r.ok, `expected origin ${origin} to be allowed`).toBe(true);
    }
  });

  it("rejects a non-localhost Origin not in allowlist", () => {
    const r = gateRequest(
      { host: "127.0.0.1:3000", origin: "https://evil.example.com" },
      baseConfig,
    );
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
    expect(r.reason).toMatch(/Origin/);
  });

  it("allows an explicitly allowlisted Origin", () => {
    const r = gateRequest(
      { host: "127.0.0.1:3000", origin: "https://app.example.com" },
      { ...baseConfig, httpAllowedOrigins: ["https://app.example.com"] },
    );
    expect(r.ok).toBe(true);
  });

  it("matches Origin case-insensitively", () => {
    const r = gateRequest(
      { host: "127.0.0.1:3000", origin: "HTTPS://APP.EXAMPLE.COM" },
      { ...baseConfig, httpAllowedOrigins: ["https://app.example.com"] },
    );
    expect(r.ok).toBe(true);
  });
});

describe("gateRequest — bearer auth", () => {
  it("requires Bearer when token is configured", () => {
    const r = gateRequest({ host: "127.0.0.1:3000" }, { ...baseConfig, httpAuthToken: "secret" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
    expect(r.reason).toMatch(/Missing Bearer/);
  });

  it("rejects wrong scheme", () => {
    const r = gateRequest(
      { host: "127.0.0.1:3000", authorization: "Basic abc==" },
      { ...baseConfig, httpAuthToken: "secret" },
    );
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
  });

  it("rejects wrong token", () => {
    const r = gateRequest(
      { host: "127.0.0.1:3000", authorization: "Bearer wrong-token" },
      { ...baseConfig, httpAuthToken: "secret" },
    );
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
    expect(r.reason).toMatch(/Invalid Bearer/);
  });

  it("accepts correct token", () => {
    const r = gateRequest(
      { host: "127.0.0.1:3000", authorization: "Bearer secret" },
      { ...baseConfig, httpAuthToken: "secret" },
    );
    expect(r.ok).toBe(true);
  });

  it("skips auth when no token configured", () => {
    const r = gateRequest({ host: "127.0.0.1:3000" }, baseConfig);
    expect(r.ok).toBe(true);
  });

  it("requires both Host and Bearer together (defense in depth)", () => {
    // Wrong host + good bearer → host check fires first
    const r = gateRequest(
      { host: "evil.example.com:3000", authorization: "Bearer secret" },
      { ...baseConfig, httpAuthToken: "secret" },
    );
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });
});

describe("isPubliclyBound", () => {
  it("treats 127.0.0.1 as private", () => {
    expect(isPubliclyBound("127.0.0.1")).toBe(false);
  });

  it("treats localhost as private", () => {
    expect(isPubliclyBound("localhost")).toBe(false);
    expect(isPubliclyBound("LOCALHOST")).toBe(false);
  });

  it("treats ::1 as private", () => {
    expect(isPubliclyBound("::1")).toBe(false);
  });

  it("treats 0.0.0.0 as PUBLIC (binds all interfaces)", () => {
    expect(isPubliclyBound("0.0.0.0")).toBe(true);
  });

  it("treats LAN addresses as PUBLIC", () => {
    expect(isPubliclyBound("10.0.0.5")).toBe(true);
    expect(isPubliclyBound("192.168.1.100")).toBe(true);
  });
});
