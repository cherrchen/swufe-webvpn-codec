import { describe, expect, it } from "vitest";
import { DEFAULT_KEY, STORAGE_KEYS, TICKET_COOKIE_NAME, WrdCodec } from "webvpn-core-js";
import { handleStashRequest, handleStashResponse, handleStashTile, nativeGatewayRedirect, type StashRuntime } from "../src/adapter.ts";

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
  it("clears the local gateway session for the observed /logout endpoint and never injects it", () => {
    const rt = runtime({ request: { url: "https://webvpn.swufe.edu.cn/logout?next=%2F", headers: { cookie: `${TICKET_COOKIE_NAME}=B` } } });
    rt.store[STORAGE_KEYS.session] = JSON.stringify({ schemaVersion: 1, gatewayHost: "webvpn.swufe.edu.cn", cookieHeader: `${TICKET_COOKIE_NAME}=A`, capturedAt: NOW, lastConfirmedAt: null, expiresAt: null, status: "valid" });
    handleStashRequest(rt);
    expect(rt.requests[0]).toEqual({ decision: "pass" });
    expect(rt.store[STORAGE_KEYS.session]).toBeUndefined();
    rt.response = { status: 302, headers: { "set-cookie": `${TICKET_COOKIE_NAME}=C; Max-Age=3600`, location: "/" } };
    handleStashResponse(rt);
    expect(rt.responses[0]).toEqual({});
    expect(rt.store[STORAGE_KEYS.session]).toBeUndefined();

    rt.store[STORAGE_KEYS.session] = JSON.stringify({ schemaVersion: 1, gatewayHost: "webvpn.swufe.edu.cn", cookieHeader: `${TICKET_COOKIE_NAME}=A`, capturedAt: NOW, lastConfirmedAt: null, expiresAt: null, status: "valid" });
    rt.request = { url: "https://authserver.swufe.edu.cn/logout", headers: {} };
    handleStashRequest(rt);
    expect(rt.store[STORAGE_KEYS.session]).toBeDefined();
  });
  it("injects a stored gateway ticket as a same URL header edit and preserves client ticket precedence", () => {
    const codec = new WrdCodec(DEFAULT_KEY, DEFAULT_KEY, "webvpn.swufe.edu.cn");
    const rt = runtime({ request: { url: codec.encodeUrl("http://jwxt.swufe.edu.cn/path", "https://webvpn.swufe.edu.cn"), headers: { cookie: "other=x" } } });
    rt.store[STORAGE_KEYS.session] = JSON.stringify({ schemaVersion: 1, gatewayHost: "webvpn.swufe.edu.cn", cookieHeader: `${TICKET_COOKIE_NAME}=A`, capturedAt: NOW, lastConfirmedAt: null, expiresAt: null, status: "valid" });
    handleStashRequest(rt);
    expect(rt.requests[0]).toEqual({ decision: "rewrite_headers", headers: { cookie: `other=x; ${TICKET_COOKIE_NAME}=A` } });
    expect(JSON.stringify(rt.requests[0])).not.toContain("url");

    rt.request = { url: codec.encodeUrl("https://jwxt.swufe.edu.cn/path", "https://webvpn.swufe.edu.cn"), headers: { Cookie: `${TICKET_COOKIE_NAME}=B` } };
    handleStashRequest(rt);
    expect(rt.requests[1]).toEqual({ decision: "pass" });
    expect(JSON.parse(rt.store[STORAGE_KEYS.session] ?? "{}").cookieHeader).toContain(`${TICKET_COOKIE_NAME}=B`);
  });

  it("does not inject for authserver, settings, login, or an expired gateway session", () => {
    const rt = runtime({ request: { url: "https://webvpn.swufe.edu.cn/login", headers: {} } });
    rt.store[STORAGE_KEYS.session] = JSON.stringify({ schemaVersion: 1, gatewayHost: "webvpn.swufe.edu.cn", cookieHeader: `${TICKET_COOKIE_NAME}=A`, capturedAt: NOW, lastConfirmedAt: null, expiresAt: null, status: "valid" });
    handleStashRequest(rt);
    expect(rt.requests[0]).toEqual({ decision: "pass" });
    rt.request = { url: "https://authserver.swufe.edu.cn/authserver/login", headers: {} };
    handleStashRequest(rt);
    expect(rt.requests[1]).toEqual({ decision: "pass" });
    rt.request = { url: "https://webvpn.swufe.edu.cn/__swufe_bridge__/", headers: {} };
    handleStashRequest(rt);
    expect(rt.requests[2]).toMatchObject({ decision: "respond" });
    rt.store[STORAGE_KEYS.session] = JSON.stringify({ schemaVersion: 1, gatewayHost: "webvpn.swufe.edu.cn", cookieHeader: `${TICKET_COOKIE_NAME}=A`, capturedAt: NOW, lastConfirmedAt: null, expiresAt: "2026-09-24T00:00:00.000Z", status: "valid" });
    rt.request = { url: "https://webvpn.swufe.edu.cn/http/opaque/path", headers: {} };
    handleStashRequest(rt);
    expect(rt.requests[3]).toEqual({ decision: "pass" });
    expect(rt.store[STORAGE_KEYS.session]).toBeUndefined();
  });

  it("emits safe gateway and auth trace fields without secrets", () => {
    const logs: string[] = [];
    const wrapped = new WrdCodec(DEFAULT_KEY, DEFAULT_KEY, "webvpn.swufe.edu.cn").encodeUrl("http://tyxycg.swufe.edu.cn/path?service=https%3A%2F%2Ftyxycg.swufe.edu.cn%2Fsecret", "https://webvpn.swufe.edu.cn");
    const rt = runtime({ request: { url: wrapped, headers: {} }, debug: (record) => logs.push(JSON.stringify(record)) });
    rt.store[STORAGE_KEYS.session] = JSON.stringify({ schemaVersion: 1, gatewayHost: "webvpn.swufe.edu.cn", cookieHeader: `${TICKET_COOKIE_NAME}=secret-ticket`, capturedAt: NOW, lastConfirmedAt: null, expiresAt: null, status: "valid" });
    handleStashRequest(rt);
    const output = logs.join("\n");
    expect(output).toContain("route=gateway");
    expect(output).toContain("gatewayKind=wrapped-resource");
    expect(output).toContain("decodedOriginalHost=tyxycg.swufe.edu.cn");
    expect(output).toContain("serviceHost=tyxycg.swufe.edu.cn");
    expect(output).not.toMatch(/secret-ticket|%2Fsecret|service=https|cookieHeader=|\/http\/[a-z0-9]+/);
  });

  it("rotates a gateway ticket and clears it only on an explicit deletion", () => {
    const rt = runtime({ request: { url: "https://webvpn.swufe.edu.cn/http/opaque/path", headers: {} }, response: { status: 200, headers: { "set-cookie": `${TICKET_COOKIE_NAME}=B; Max-Age=3600` } } });
    rt.store[STORAGE_KEYS.session] = JSON.stringify({ schemaVersion: 1, gatewayHost: "webvpn.swufe.edu.cn", cookieHeader: `${TICKET_COOKIE_NAME}=A`, capturedAt: NOW, lastConfirmedAt: null, expiresAt: null, status: "valid" });
    handleStashResponse(rt);
    expect(JSON.parse(rt.store[STORAGE_KEYS.session] ?? "{}").cookieHeader).toContain(`${TICKET_COOKIE_NAME}=B`);
    rt.response = { status: 302, headers: { "set-cookie": `${TICKET_COOKIE_NAME}=; Max-Age=0`, location: "/login" } };
    handleStashResponse(rt);
    expect(rt.store[STORAGE_KEYS.session]).toBeUndefined();
  });

  it("traces raw authserver redirects using only the service hostname", () => {
    const logs: string[] = [];
    const rt = runtime({ request: { url: "https://webvpn.swufe.edu.cn/", headers: {} }, response: { status: 302, headers: { location: "https://authserver.swufe.edu.cn/authserver/login?service=https%3A%2F%2Ftyxycg.swufe.edu.cn%2Fprivate" } }, debug: (record) => logs.push(JSON.stringify(record)) });
    handleStashResponse(rt);
    const output = logs.join("\n");
    expect(output).toContain("locationAuth=raw-authserver");
    expect(output).toContain("serviceHost=tyxycg.swufe.edu.cn");
    expect(output).not.toMatch(/private|service=https|%2F/);
    logs.length = 0;
    const wrapped = new WrdCodec(DEFAULT_KEY, DEFAULT_KEY, "webvpn.swufe.edu.cn").encodeUrl("https://authserver.swufe.edu.cn/authserver/login?service=https%3A%2F%2Ftyxycg.swufe.edu.cn%2Fprivate", "https://webvpn.swufe.edu.cn");
    rt.response = { status: 302, headers: { location: wrapped } };
    handleStashResponse(rt);
    expect(logs.join("\n")).toContain("locationAuth=wrapped-authserver");
    expect(logs.join("\n")).not.toMatch(/private|service=https|%2F/);
  });
  it("rewrites an allowlisted request after a gateway cookie is stored", () => {
    const rt = runtime({
      request: { url: "https://webvpn.swufe.edu.cn/", method: "GET", headers: { cookie: `route=fake; ${TICKET_COOKIE_NAME}=A` } },
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
    expect(JSON.stringify(next.requests[0])).toContain("webvpn.swufe.edu.cn/http/");
  });

  it("routes the plain-HTTP jwxt entry through the gateway HTTP namespace", () => {
    const rt = runtime({ request: { url: "http://jwxt.swufe.edu.cn/", method: "GET", headers: {} } });
    rt.store[STORAGE_KEYS.session] = JSON.stringify({
      schemaVersion: 1,
      gatewayHost: "webvpn.swufe.edu.cn",
      cookieHeader: "route=fake",
      capturedAt: NOW,
      lastConfirmedAt: null,
      status: "captured",
    });
    handleStashRequest(rt);
    const rewritten = rt.requests[0] as { decision: string; url: string };
    expect(rewritten.decision).toBe("rewrite");
    expect(rewritten.url).toMatch(/^https:\/\/webvpn\.swufe\.edu\.cn\/http\//);

    expect(nativeGatewayRedirect(rt.request, rewritten as { decision: "rewrite"; url: string; headers: Record<string, string> })).toBe(rewritten.url);
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

  it("redirects jwxt document navigation into native WebVPN space", () => {
    const rewritten = { decision: "rewrite" as const, url: "https://webvpn.swufe.edu.cn/http/token/", headers: {} };
    expect(nativeGatewayRedirect({ url: "http://jwxt.swufe.edu.cn/", method: "GET", headers: {} }, rewritten)).toBe(rewritten.url);
    expect(nativeGatewayRedirect({ url: "http://jwxt.swufe.edu.cn/xtgl/index_initMenu.html", method: "GET", headers: { Accept: "text/html,application/xhtml+xml" } }, rewritten)).toBe(rewritten.url);
    expect(nativeGatewayRedirect({ url: "http://jwxt.swufe.edu.cn/api", method: "GET", headers: { Accept: "application/json" } }, rewritten)).toBeNull();
    expect(nativeGatewayRedirect({ url: "https://jwxt.swufe.edu.cn/", method: "GET", headers: {} }, rewritten)).toBe(rewritten.url);
    expect(nativeGatewayRedirect({ url: "http://resource.swufe.edu.cn/", method: "GET", headers: {} }, rewritten)).toBe(rewritten.url);
    expect(nativeGatewayRedirect({ url: "https://resource.swufe.edu.cn/", method: "GET", headers: {} }, rewritten)).toBe(rewritten.url);
  });

  it("passes the native WebVPN bootstrap document without redirecting to itself", () => {
    const req = runtime({
      request: { url: "http://jwxt.swufe.edu.cn/", method: "GET", headers: {} },
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
      response: { status: 200, headers: { "content-type": "text/html" }, body: '<script>var __vpn_x=1</script><script src="/wengine-vpn/js/main.js"></script>' },
      read: (key) => req.store[key] ?? null,
      write: req.write,
    });
    handleStashResponse(res);
    expect(res.responses[0]).toEqual({});
  });

  it("reverse-rewrites when Stash exposes the original URL to the response script", () => {
    const rt = runtime({
      request: { url: "https://jwxt.swufe.edu.cn/main", method: "GET", headers: {} },
    });
    rt.store[STORAGE_KEYS.session] = JSON.stringify({
      schemaVersion: 1,
      gatewayHost: "webvpn.swufe.edu.cn",
      cookieHeader: "route=fake",
      capturedAt: NOW,
      lastConfirmedAt: null,
      status: "captured",
    });
    const other = runtime({
      request: { url: "https://jwxt.swufe.edu.cn/xtgl/index_initMenu.html", method: "GET", headers: {} },
      read: rt.read,
    });
    handleStashRequest(other);
    const rewritten = other.requests[0] as { url: string };
    rt.response = { status: 302, headers: { location: rewritten.url }, body: "" };
    handleStashResponse(rt);
    expect(rt.responses[0]).toMatchObject({ headers: { location: "http://jwxt.swufe.edu.cn/xtgl/index_initMenu.html" } });
  });

  it("does not emit a redirect whose target is the current browser URL", () => {
    const rt = runtime({
      request: { url: "http://jwxt.swufe.edu.cn/main", method: "GET", headers: {} },
    });
    rt.store[STORAGE_KEYS.session] = JSON.stringify({
      schemaVersion: 1,
      gatewayHost: "webvpn.swufe.edu.cn",
      cookieHeader: "route=fake",
      capturedAt: NOW,
      lastConfirmedAt: null,
      status: "captured",
    });
    const req = runtime({ request: rt.request, read: rt.read });
    handleStashRequest(req);
    const rewritten = req.requests[0] as { url: string };
    rt.response = { status: 302, headers: { location: rewritten.url }, body: "" };
    handleStashResponse(rt);
    expect(rt.responses[0]).toEqual({});
  });

  it("passes a native https WebVPN document without promoting it to itself", () => {
    const req = runtime({
      request: { url: "https://jwxt.swufe.edu.cn/", method: "GET", headers: {} },
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
    expect(rewritten.url).toMatch(/^https:\/\/webvpn\.swufe\.edu\.cn\/http\//);
    const res = runtime({
      request: { url: rewritten.url, method: "GET", headers: {} },
      response: {
        status: 200,
        headers: { "content-type": "text/html" },
        body: '<script>var __vpn_x=1</script><script src="/wengine-vpn/js/main.js"></script>',
      },
      read: (key) => req.store[key] ?? null,
      write: req.write,
    });
    handleStashResponse(res);
    expect(res.responses[0]).toEqual({});
  });

  it("keeps a captured session when the login page redirects to CAS", () => {
    const rt = runtime({
      request: { url: "https://webvpn.swufe.edu.cn/", method: "GET", headers: { cookie: `route=fake; ${TICKET_COOKIE_NAME}=A` } },
    });
    handleStashRequest(rt);
    expect(rt.store[STORAGE_KEYS.session]).toContain("route=fake");
    const res = runtime({
      request: { url: "https://webvpn.swufe.edu.cn/", method: "GET", headers: { cookie: "route=fake" } },
      response: { status: 302, headers: { location: "https://authserver.swufe.edu.cn/authserver/login" }, body: "" },
      read: (key) => rt.store[key] ?? null,
      write: (key, value) => {
        if (value === null || value === "") delete rt.store[key];
        else rt.store[key] = value;
        return true;
      },
    });
    handleStashResponse(res);
    expect(rt.store[STORAGE_KEYS.session]).toContain("route=fake");
    const jwxt = runtime({
      request: { url: "https://jwxt.swufe.edu.cn/", method: "GET", headers: {} },
      read: (key) => rt.store[key] ?? null,
      write: (key, value) => {
        if (value === null || value === "") delete rt.store[key];
        else rt.store[key] = value;
        return true;
      },
    });
    handleStashRequest(jwxt);
    expect(jwxt.requests[0]).toMatchObject({ decision: "rewrite" });
    expect(JSON.stringify(jwxt.requests[0])).not.toContain("NOT_LOGGED_IN");
  });

  it("keeps a captured gateway session through the initial jwxt CAS redirect", () => {
    const rt = runtime({ request: { url: "http://jwxt.swufe.edu.cn/xtgl/login_slogin.html", method: "GET", headers: {} } });
    rt.store[STORAGE_KEYS.session] = JSON.stringify({
      schemaVersion: 1,
      gatewayHost: "webvpn.swufe.edu.cn",
      cookieHeader: "route=fake",
      capturedAt: NOW,
      lastConfirmedAt: null,
      status: "captured",
    });
    handleStashRequest(rt);
    expect(JSON.parse(rt.store[STORAGE_KEYS.session] ?? "{}").status).toBe("captured");
    rt.response = { status: 302, headers: { location: "https://authserver.swufe.edu.cn/authserver/login" } };
    handleStashResponse(rt);
    expect(rt.store[STORAGE_KEYS.session]).toContain("route=fake");
    expect(rt.responses[0]).toEqual({});
    expect(rt.notes).toEqual([]);

    rt.request = { url: "http://jwxt.swufe.edu.cn/sso/jziotlogin?ticket=fake", method: "GET", headers: {} };
    handleStashRequest(rt);
    expect(rt.requests[1]).toMatchObject({ decision: "rewrite" });
    rt.response = { status: 200, headers: { "content-type": "text/html" }, body: "<html>ready</html>" };
    handleStashResponse(rt);
    expect(JSON.parse(rt.store[STORAGE_KEYS.session] ?? "{}").status).toBe("valid");
  });

  it("keeps a confirmed gateway session when a rewritten allowlist response redirects to CAS", () => {
    const req = runtime({
      request: { url: "https://jwxt.swufe.edu.cn/main", method: "GET", headers: {} },
    });
    req.store[STORAGE_KEYS.session] = JSON.stringify({
      schemaVersion: 1,
      gatewayHost: "webvpn.swufe.edu.cn",
      cookieHeader: "route=fake",
      capturedAt: NOW,
      lastConfirmedAt: null,
      status: "valid",
    });
    handleStashRequest(req);
    const res = runtime({
      request: { url: "https://jwxt.swufe.edu.cn/main", method: "GET", headers: {} },
      response: { status: 302, headers: { location: "https://authserver.swufe.edu.cn/authserver/login" }, body: "" },
      read: (key) => req.store[key] ?? null,
      write: req.write,
    });
    handleStashResponse(res);
    expect(req.store[STORAGE_KEYS.session]).toBeDefined();
    expect(handleStashTile(res).content).toContain("已登录");
  });

  it("logs the decision without a cookie value when debug is off", () => {
    const logs: string[] = [];
    const rt = runtime({
      request: { url: "https://webvpn.swufe.edu.cn/?ticket=abc", method: "GET", headers: { cookie: `route=fake; ${TICKET_COOKIE_NAME}=A` } },
      debug: (record) => logs.push(JSON.stringify(record)),
    });
    handleStashRequest(rt);
    const visible = logs.filter((line) => line.includes('"direction":"system"'));
    expect(visible.some((line) => line.includes("session-captured"))).toBe(true);
    expect(visible.join("\n")).not.toContain("route=fake");
    expect(visible.join("\n")).not.toContain("ticket=abc");
    expect(handleStashTile(rt).sessionState).toBe("ok");
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
    expect(handleStashTile(ready)).toMatchObject({ title: "SWUFE WebVPN", content: "已登录", url: "https://webvpn.swufe.edu.cn/__swufe_bridge__/" });
    expect(handleStashTile(loggedOut).url).toBe("https://webvpn.swufe.edu.cn");
    const expired = runtime();
    expired.store[STORAGE_KEYS.lastError] = JSON.stringify({ schemaVersion: 1, code: "SESSION_EXPIRED", ts: NOW, host: "jwxt.swufe.edu.cn", detail: "SESSION_EXPIRED" });
    expect(handleStashTile(expired).content).toContain("打开网页登录");
    expect(handleStashTile(expired).content).toContain("失效");
    expect(handleStashTile(expired).url).toBe("https://webvpn.swufe.edu.cn");
  });

  it("stores the ticket lifetime from a gateway Set-Cookie and expires on the clock", () => {
    const rt = runtime({
      request: { url: "https://webvpn.swufe.edu.cn/", method: "GET", headers: {} },
      response: {
        status: 200,
        headers: { "set-cookie": `show_faq=1; Max-Age=30\n${TICKET_COOKIE_NAME}=fake; Max-Age=3600` },
      },
    });
    handleStashResponse(rt);
    const saved = JSON.parse(rt.store[STORAGE_KEYS.session] ?? "{}") as { expiresAt?: string; cookieHeader?: string };
    expect(saved.expiresAt).toBe("2026-09-24T09:00:00.000Z");
    expect(saved.cookieHeader).toBe(`${TICKET_COOKIE_NAME}=fake`);
    expect(saved.cookieHeader).not.toContain("show_faq");

    const later = runtime({
      nowIso: "2026-09-24T09:00:00.000Z",
      request: { url: "https://jwxt.swufe.edu.cn/", method: "GET", headers: {} },
    });
    later.store[STORAGE_KEYS.session] = rt.store[STORAGE_KEYS.session] ?? "";
    handleStashRequest(later);
    expect(later.store[STORAGE_KEYS.session]).toBeUndefined();
    expect(later.requests[0]).toEqual({ decision: "pass" });
    expect(handleStashTile(later).content).toContain("失效");
  });

  it("keeps a stored ticket when the gateway answers 302 to /login without an explicit expiry", () => {
    const rt = runtime({
      request: {
        url: "https://webvpn.swufe.edu.cn/",
        method: "GET",
        headers: { cookie: `${TICKET_COOKIE_NAME}=fake` },
      },
      response: { status: 302, headers: { location: "https://webvpn.swufe.edu.cn/login" } },
    });
    rt.store[STORAGE_KEYS.session] = JSON.stringify({
      schemaVersion: 1,
      gatewayHost: "webvpn.swufe.edu.cn",
      cookieHeader: `${TICKET_COOKIE_NAME}=fake`,
      capturedAt: NOW,
      lastConfirmedAt: null,
      expiresAt: null,
      status: "valid",
    });
    handleStashResponse(rt);
    expect(rt.store[STORAGE_KEYS.session]).toBeDefined();
  });

  it("serves settings HTML without capturing the session", () => {
    const rt = runtime({
      request: { url: "https://webvpn.swufe.edu.cn/__swufe_bridge__/", method: "GET", headers: { cookie: "route=secret" } },
    });
    handleStashRequest(rt);
    const result = rt.requests[0] as { decision: string; response: { status: number; headers: Record<string, string>; body: string } };
    expect(result.decision).toBe("respond");
    expect(result.response.status).toBe(200);
    expect(result.response.headers["content-type"]).toContain("text/html");
    expect(result.response.body).toContain("打开网页登录");
    expect(result.response.body).not.toContain("cdn");
    expect(rt.store[STORAGE_KEYS.session]).toBeUndefined();
  });

  it("returns a one-use settings token and writes only v2 on a valid post", () => {
    const rt = runtime({
      request: { url: "https://webvpn.swufe.edu.cn/__swufe_bridge__/api/settings", method: "GET", headers: {} },
    });
    handleStashRequest(rt);
    const first = rt.requests[0] as { response: { body: string } };
    const token = JSON.parse(first.response.body).token as string;
    expect(JSON.parse(first.response.body).data.settings).not.toHaveProperty("wrdKeyOverride");
    const post = runtime({
      request: {
        url: "https://webvpn.swufe.edu.cn/__swufe_bridge__/api/settings",
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://webvpn.swufe.edu.cn", "x-swufe-settings-token": token },
        body: JSON.stringify({ schemaVersion: 2, builtinSiteStates: { jwxt: false }, customHosts: ["lib.swufe.edu.cn"] }),
      },
      read: (key) => rt.store[key] ?? null,
      write: (key, value) => {
        if (value === null || value === "") delete rt.store[key];
        else rt.store[key] = value;
        return true;
      },
    });
    handleStashRequest(post);
    expect(post.requests[0]).toMatchObject({ decision: "respond", response: { status: 200 } });
    expect(rt.store[STORAGE_KEYS.settingsV2]).toContain("lib.swufe.edu.cn");
    expect(rt.store[STORAGE_KEYS.session]).toBeUndefined();
    handleStashRequest(post);
    expect(post.requests[1]).toMatchObject({ decision: "respond", response: { status: 401 } });
  });

  it("rejects a settings post that fails origin, json, or size checks", () => {
    const rt = runtime({
      request: {
        url: "https://webvpn.swufe.edu.cn/__swufe_bridge__/api/settings",
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example", "x-swufe-settings-token": "aa".repeat(16) },
        body: "{}",
      },
    });
    handleStashRequest(rt);
    expect(rt.requests[0]).toMatchObject({ response: { status: 401 } });
    const huge = runtime({
      request: {
        url: "https://webvpn.swufe.edu.cn/__swufe_bridge__/api/settings",
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "x".repeat(16 * 1024 + 1),
      },
    });
    handleStashRequest(huge);
    expect(huge.requests[0]).toMatchObject({ response: { status: 413 } });
    expect(JSON.stringify(huge.requests[0])).not.toContain("xxxxx");
  });

  it("returns a local 500 when the settings handler throws", () => {
    const rt = runtime({
      request: { url: "https://webvpn.swufe.edu.cn/__swufe_bridge__/api/settings", method: "GET", headers: {} },
      read: () => { throw new Error("store down"); },
    });
    handleStashRequest(rt);
    expect(rt.requests[0]).toMatchObject({ decision: "respond", response: { status: 500 } });
  });

  it("passes an unselected SWUFE host without injecting a cookie", () => {
    const rt = runtime({
      request: { url: "https://lib.swufe.edu.cn/home", method: "GET", headers: {} },
    });
    rt.store[STORAGE_KEYS.session] = JSON.stringify({
      schemaVersion: 1,
      gatewayHost: "webvpn.swufe.edu.cn",
      cookieHeader: "route=fake",
      capturedAt: NOW,
      lastConfirmedAt: NOW,
      status: "valid",
    });
    handleStashRequest(rt);
    expect(rt.requests[0]).toEqual({ decision: "pass" });
  });

  it("does not rewrite a settings response", () => {
    const rt = runtime({
      request: { url: "https://webvpn.swufe.edu.cn/__swufe_bridge__/", method: "GET", headers: {} },
      response: { status: 200, headers: { "content-type": "text/html" }, body: "<p>local</p>" },
    });
    handleStashResponse(rt);
    expect(rt.responses[0]).toEqual({});
  });
});
