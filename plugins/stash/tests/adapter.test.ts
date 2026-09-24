import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "webvpn-core-js";
import { handleStashRequest, handleStashResponse, handleStashTile, type StashRuntime } from "../src/adapter.ts";

const NOW = "2026-09-24T08:00:00.000Z";

function runtime(overrides: Partial<StashRuntime> = {}): StashRuntime & {
  store: Record<string, string>;
  requests: unknown[];
  responses: unknown[];
  notes: unknown[];
} {
  const store: Record<string, string> = {};
  const requests: unknown[] = [];
  const responses: unknown[] = [];
  const notes: unknown[] = [];
  return {
    nowIso: NOW,
    store,
    requests,
    responses,
    notes,
    read: (key) => store[key] ?? null,
    write: (key, value) => {
      if (value === null || value === "") delete store[key];
      else store[key] = value;
      return true;
    },
    notify: (input) => notes.push(input),
    debug: () => undefined,
    finishRequest: (result) => requests.push(result),
    finishResponse: (result) => responses.push(result),
    env: () => ({ host: "stash", version: "test", platform: "ios" }),
    ...overrides,
  };
}

describe("Stash adapter", () => {
  it("rewrites an allowlisted request after a gateway cookie is stored", () => {
    const rt = runtime({
      request: { url: "https://webvpn.swufe.edu.cn/", method: "GET", headers: { cookie: "route=fake" } },
    });
    handleStashRequest(rt);
    expect(rt.store[STORAGE_KEYS.session]).toContain("route=fake");
    const next = runtime({
      request: { url: "https://jwxt.swufe.edu.cn/sso/jziotlogin", method: "GET", headers: {} },
      read: (key) => rt.store[key] ?? null,
      write: (key, value) => {
        if (value === null || value === "") delete rt.store[key];
        else rt.store[key] = value;
        return true;
      },
    });
    next.store = rt.store;
    handleStashRequest(next);
    expect(next.requests[0]).toMatchObject({ decision: "rewrite" });
    expect(JSON.stringify(next.requests[0])).toContain("route=fake");
    expect(JSON.stringify(next.requests[0])).toContain("webvpn.swufe.edu.cn/https/");
  });

  it("asks for login and does not attach a cookie when no session exists", () => {
    const rt = runtime({ request: { url: "https://jwxt.swufe.edu.cn/", method: "GET", headers: {} } });
    handleStashRequest(rt);
    expect(rt.requests[0]).toEqual({ decision: "pass" });
    expect(rt.notes[0]).toMatchObject({ event: "login-required", body: "打开网页登录" });
    expect(JSON.stringify(rt.notes)).not.toMatch(/cookie|password/i);
  });

  it("does not persist an authserver cookie", () => {
    const rt = runtime({
      request: { url: "https://authserver.swufe.edu.cn/authserver/login", method: "POST", headers: { cookie: "CASTGC=fake" } },
    });
    handleStashRequest(rt);
    expect(rt.store[STORAGE_KEYS.session]).toBeUndefined();
    expect(rt.requests[0]).toEqual({ decision: "pass" });
  });

  it("reverse-rewrites a location on the rewritten request URL", () => {
    const req = runtime({
      request: { url: "https://jwxt.swufe.edu.cn/main", method: "GET", headers: {} },
    });
    req.store[STORAGE_KEYS.session] = JSON.stringify({
      schemaVersion: 1,
      gatewayHost: "webvpn.swufe.edu.cn",
      cookieHeader: "route=fake",
      capturedAt: NOW,
      lastConfirmedAt: null,
      status: "captured",
    });
    handleStashRequest(req);
    const rewritten = req.requests[0] as { url: string };
    const res = runtime({
      request: { url: rewritten.url, method: "GET", headers: {} },
      response: { status: 302, headers: { location: rewritten.url }, body: "" },
      read: (key) => req.store[key] ?? null,
      write: req.write,
    });
    handleStashResponse(res);
    expect(res.responses[0]).toMatchObject({
      headers: { location: "https://jwxt.swufe.edu.cn/main" },
    });
  });

  it("H02 tile copy follows session state", () => {
    const loggedOut = runtime();
    expect(handleStashTile(loggedOut).content).toBe("未登录 · 打开网页登录");
    const ready = runtime();
    ready.store[STORAGE_KEYS.session] = JSON.stringify({
      schemaVersion: 1,
      gatewayHost: "webvpn.swufe.edu.cn",
      cookieHeader: "route=fake",
      capturedAt: NOW,
      lastConfirmedAt: null,
      status: "valid",
    });
    expect(handleStashTile(ready)).toMatchObject({ title: "SWUFE WebVPN", content: "已登录", url: "https://webvpn.swufe.edu.cn" });
    const expired = runtime();
    expired.store[STORAGE_KEYS.lastError] = JSON.stringify({ schemaVersion: 1, code: "SESSION_EXPIRED", ts: NOW, host: "jwxt.swufe.edu.cn", detail: "SESSION_EXPIRED" });
    expect(handleStashTile(expired).content).toContain("打开网页登录");
    expect(handleStashTile(expired).content).toContain("失效");
  });
});
