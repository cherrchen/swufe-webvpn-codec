import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_KEY, SETTINGS_PAGE_URL, STORAGE_KEYS, TICKET_COOKIE_NAME, WrdCodec } from "webvpn-core-js";
import { bindLoonRuntime, type LoonGlobals } from "../src/runtime.ts";
import { loonEnvironment } from "../src/adapter.ts";

const gateway = "https://webvpn.swufe.edu.cn";
const codec = new WrdCodec(DEFAULT_KEY, DEFAULT_KEY, "webvpn.swufe.edu.cn");
const wrapped = codec.encodeUrl("http://jwxt.swufe.edu.cn/a", gateway);
const api = SETTINGS_PAGE_URL + "api/settings";
const nonce = "0123456789abcdef0123456789abcdef";
const bundles: Record<string, string> = {};

beforeAll(async () => {
  for (const kind of ["request", "response", "generic"]) {
    const result = await build({ entryPoints: [`src/${kind}-entry.ts`], bundle: true, format: "iife", platform: "browser", target: "es2020", write: false });
    bundles[kind] = result.outputFiles[0]!.text;
  }
});

function session(ticket = "stored-ticket", status = "captured") {
  return JSON.stringify({ schemaVersion: 1, gatewayHost: "webvpn.swufe.edu.cn", cookieHeader: `${TICKET_COOKIE_NAME}=${ticket}; route=fake`, capturedAt: new Date().toISOString(), lastConfirmedAt: null, expiresAt: null, status });
}

function fixture(initial: Record<string, string> = {}) {
  const store = { ...initial };
  const outputs: Record<string, unknown>[] = [];
  const notes: unknown[][] = [];
  const logs: string[] = [];
  let writeOk = true;
  const persistent = {
    read: (key: string) => store[key] ?? null,
    write: (value: string | undefined, key: string) => {
      if (!writeOk) return false;
      if (value === undefined) delete store[key]; else store[key] = value;
      return true;
    },
  };
  function run(kind: string, request?: LoonGlobals["request"], response?: LoonGlobals["response"], argument: unknown = { enabled: true, debug: false }, extra: Record<string, unknown> = {}) {
    outputs.length = 0;
    runInNewContext(bundles[kind]!, {
      $request: request, $response: response, $argument: argument,
      $loon: "iPhone15,2 18.0 3.5.1(998)",
      $persistentStore: persistent, $notification: { post: (...values: unknown[]) => notes.push(values) },
      $done: (value: Record<string, unknown>) => outputs.push(value),
      console: { log: (value: string) => logs.push(value) },
      URL, TextEncoder, TextDecoder, Uint8Array,
      ...extra,
    });
    expect(outputs).toHaveLength(1);
    return outputs[0]!;
  }
  return { store, outputs, notes, logs, run, persistent, failWrites: () => { writeOk = false; } };
}

function settingsGet(rt: ReturnType<typeof fixture>, token = nonce, headers: Record<string, string> = {}) {
  return rt.run("request", { url: api, headers: { referer: SETTINGS_PAGE_URL, "x-swufe-settings-bootstrap": token, ...headers } }).response as { status: number; body: string };
}
function settingsPost(rt: ReturnType<typeof fixture>, body: string, token = nonce, headers: Record<string, string> = {}) {
  return rt.run("request", { url: api, method: "POST", headers: { origin: gateway, referer: SETTINGS_PAGE_URL, "content-type": "application/json", "x-swufe-settings-token": token, ...headers }, body }).response as { status: number; body: string };
}
const update = JSON.stringify({ schemaVersion: 2, builtinSiteStates: { jwxt: false }, customHosts: ["tyxycg.swufe.edu.cn"], hostSchemes: { "tyxycg.swufe.edu.cn": "https" } });

describe("Loon native runtime and request mapping", () => {
  it("parses the documented string runtime without relying on $environment", () => {
    expect(loonEnvironment("iPad13,1 18.0 3.5.1(998)")).toMatchObject({ host: "loon", version: "3.5.1", build: 998, platform: "ipados" });
    expect(loonEnvironment("Mac 3.5.1(998)").platform).toBe("macos");
    expect(loonEnvironment("").build).toBeUndefined();
  });
  it.each(["iPhone 18.0 3.5.1(982)", ""])("passes business traffic for unsupported runtime %s", loon => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    expect(rt.run("request", { url: "http://jwxt.swufe.edu.cn/" }, undefined, undefined, { $loon: loon })).toEqual({});
    expect(rt.run("request", { url: api }, undefined, undefined, { $loon: loon })).toMatchObject({ response: { status: 503 } });
  });
  it("redirects HTTP/80 documents and preserves a POST body by omission", () => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    const out = rt.run("request", { url: "http://jwxt.swufe.edu.cn/", headers: { accept: "text/html" } });
    expect(out).toEqual({ response: { status: 302, headers: { location: codec.encodeUrl("http://jwxt.swufe.edu.cn/", gateway), "cache-control": "no-store" } } });
    const post = rt.run("request", { url: "http://jwxt.swufe.edu.cn/api", method: "POST", headers: {}, body: "password=do-not-log" });
    expect(post).not.toHaveProperty("body");
    expect(JSON.stringify(post.headers)).toContain("stored-ticket");
    expect(rt.logs.join("")).not.toContain("do-not-log");
  });
  it.each(["http", "https"])("redirects %s page navigation without looping on the gateway", scheme => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    const out = rt.run("request", { url: `${scheme}://jwxt.swufe.edu.cn/xtgl/login_slogin.html?q=1`, headers: { Accept: "text/html" } });
    const response = out.response as { status: number; headers: Record<string, string> };
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(codec.encodeUrl("http://jwxt.swufe.edu.cn/xtgl/login_slogin.html?q=1", gateway));
    expect(out).not.toHaveProperty("url");
    const next = rt.run("request", { url: response.headers.location!, headers: { accept: "text/html" } });
    expect(next).not.toHaveProperty("response");
    expect(next).not.toHaveProperty("url");
    expect(next.headers).toHaveProperty("cookie");
    expect(rt.run("response", { url: response.headers.location! }, { status: 200, headers: { "content-type": "text/html" }, body: "<html>native bootstrap</html>" })).toEqual({});
  });
  it("keeps non-document GET and HEAD requests transparent", () => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    for (const request of [
      { url: "http://jwxt.swufe.edu.cn/api", method: "GET", headers: { accept: "application/json" } },
      { url: "http://jwxt.swufe.edu.cn/", method: "HEAD", headers: { accept: "text/html" } },
    ]) {
      const out = rt.run("request", request);
      expect(out.url).toMatch(/^https:\/\/webvpn\.swufe\.edu\.cn\/http\//);
      expect(out).not.toHaveProperty("response");
      expect(out).not.toHaveProperty("body");
    }
  });
  it.each(["Host", "host", "HOST"])("replaces %s with the rewritten gateway authority", hostKey => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    for (const path of ["/", "/wengine-vpn/js/main.js"]) {
      const out = rt.run("request", {
        url: `http://jwxt.swufe.edu.cn${path}`, method: "POST",
        headers: { [hostKey]: "jwxt.swufe.edu.cn:80", accept: "text/html", "X-Keep": "yes" },
        body: "keep-body",
      });
      const headers = out.headers as Record<string, string>;
      const authorities = Object.entries(headers).filter(([key]) => key.toLowerCase() === "host");
      expect(authorities).toEqual([["Host", new URL(out.url as string).host]]);
      expect(headers["X-Keep"]).toBe("yes");
      expect(headers.cookie).toContain("stored-ticket");
      expect(out).not.toHaveProperty("body");
    }
  });
  it("sets the gateway Host when absent and preserves its non-default port", () => {
    const rt = fixture({
      [STORAGE_KEYS.session]: session(),
      [STORAGE_KEYS.settingsV2]: JSON.stringify({ schemaVersion: 2, enabled: true,
        gatewayBase: gateway + ":8443", builtinSiteStates: { jwxt: true },
        customHosts: [], hostSchemes: {}, debug: false, bodyRewriteMaxBytes: 1048576 }),
    });
    const out = rt.run("request", { url: "http://jwxt.swufe.edu.cn/api", method: "POST", headers: {} });
    expect(out.url).toMatch(/^https:\/\/webvpn\.swufe\.edu\.cn:8443\//);
    expect(out.headers).toMatchObject({ Host: "webvpn.swufe.edu.cn:8443" });
  });
  it("captures Safari gateway ticket and uses headers-only edits for direct WRD requests", () => {
    const rt = fixture();
    expect(rt.run("request", { url: gateway + "/", headers: { cookie: `${TICKET_COOKIE_NAME}=A` } })).toEqual({});
    expect(rt.store[STORAGE_KEYS.session]).toContain(`${TICKET_COOKIE_NAME}=A`);
    const out = rt.run("request", { url: wrapped, headers: { cookie: `${TICKET_COOKIE_NAME}=B; app=x` } });
    expect(out).not.toHaveProperty("url");
    expect(out).toEqual({ headers: { cookie: `app=x; ${TICKET_COOKIE_NAME}=A` } });
    expect(rt.store[STORAGE_KEYS.session]).toContain(`${TICKET_COOKIE_NAME}=A`);
  });
  it.each(["https://authserver.swufe.edu.cn/authserver/login", gateway + "/login", gateway + "/callback", gateway + "/?login=1", "http://unselected.swufe.edu.cn/"])("does not inject or persist credentials for %s", url => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    expect(rt.run("request", { url, headers: { cookie: "CAS=secret", authorization: "secret" }, body: "password=secret" })).toEqual({});
    expect(Object.values(rt.store).join("")).not.toContain("CAS=secret");
    expect(rt.logs.join("")).not.toContain("secret");
  });
  it("reuses a persisted Safari session in a separate client with no gateway cookie", () => {
    const safari = fixture();
    const loginRequest = { url: gateway + "/", headers: { cookie: `${TICKET_COOKIE_NAME}=A; route=route-A` } };
    safari.run("request", loginRequest);
    safari.run("response", loginRequest, { status: 200, headers: {} });
    expect(JSON.parse(safari.store[STORAGE_KEYS.session]!)).toMatchObject({ status: "valid" });
    const saved = safari.store[STORAGE_KEYS.session];
    safari.run("request", { url: "https://authserver.swufe.edu.cn/authserver/login", headers: { cookie: "CASTGC=not-stored" } });
    expect(safari.store[STORAGE_KEYS.session]).toBe(saved);
    expect(safari.store[STORAGE_KEYS.session]).not.toContain("not-stored");
    const client = fixture({ ...safari.store });
    const navigation = client.run("request", { url: "http://jwxt.swufe.edu.cn/", headers: { accept: "text/html" } });
    const response = navigation.response as { headers: { location: string } };
    expect(response.headers.location).toBe(codec.encodeUrl("http://jwxt.swufe.edu.cn/", gateway));
    const forwarded = client.run("request", { url: response.headers.location, headers: { Cookie: "app=client-cookie" } });
    expect(forwarded).toEqual({ headers: { cookie: `app=client-cookie; ${TICKET_COOKIE_NAME}=A; route=route-A` } });
    const conflict = client.run("request", { url: wrapped, headers: { cookie: `${TICKET_COOKIE_NAME}=B; app=client-cookie` } });
    expect(conflict).toEqual({ headers: { cookie: `app=client-cookie; ${TICKET_COOKIE_NAME}=A; route=route-A` } });
    expect(client.store[STORAGE_KEYS.session]).toBe(safari.store[STORAGE_KEYS.session]);
  });
  it("switches to a new login ticket only after a gateway root 200 confirms it", () => {
    const rt = fixture({ [STORAGE_KEYS.session]: session("A", "valid") });
    const newLogin = { url: gateway + "/", headers: { cookie: `${TICKET_COOKIE_NAME}=B; route=route-B` } };
    expect(rt.run("request", newLogin)).toEqual({});
    expect(rt.store[STORAGE_KEYS.session]).toContain(`${TICKET_COOKIE_NAME}=A`);
    rt.run("response", newLogin, { status: 302, headers: { location: "/login" } });
    expect(rt.store[STORAGE_KEYS.session]).toContain(`${TICKET_COOKIE_NAME}=A`);
    rt.run("response", newLogin, { status: 200, headers: { "set-cookie": `${TICKET_COOKIE_NAME}=unbound; Max-Age=3600` } });
    expect(rt.store[STORAGE_KEYS.session]).toContain(`${TICKET_COOKIE_NAME}=A`);
    rt.run("response", newLogin, { status: 200, headers: {} });
    expect(JSON.parse(rt.store[STORAGE_KEYS.session]!)).toMatchObject({ status: "valid", cookieHeader: `${TICKET_COOKIE_NAME}=B; route=route-B` });
    const out = rt.run("request", { url: wrapped, headers: {} });
    expect(out).toEqual({ headers: { cookie: `${TICKET_COOKIE_NAME}=B; route=route-B` } });
  });
  it("supports the native enable switch while keeping settings accessible", () => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    expect(rt.run("request", { url: "http://jwxt.swufe.edu.cn/" }, undefined, { enabled: false })).toEqual({});
    expect(rt.run("request", { url: SETTINGS_PAGE_URL }, undefined, { enabled: false })).toMatchObject({ response: { status: 200 } });
    expect(rt.run("request", { url: "http://jwxt.swufe.edu.cn/" }, undefined, { enabled: true })).toMatchObject({ response: { status: 302 } });
  });
  it("throttles login notifications for 30 minutes and uses openUrl", () => {
    const rt = fixture();
    rt.run("request", { url: "http://jwxt.swufe.edu.cn/" });
    rt.run("request", { url: "http://jwxt.swufe.edu.cn/" });
    expect(rt.notes).toHaveLength(1);
    expect(rt.notes[0]?.[3]).toEqual({ openUrl: gateway });
    const value = JSON.parse(rt.store[STORAGE_KEYS.notificationThrottle]!);
    value.lastByEvent["login-required"] -= 31 * 60_000;
    rt.store[STORAGE_KEYS.notificationThrottle] = JSON.stringify(value);
    rt.run("request", { url: "http://jwxt.swufe.edu.cn/" });
    expect(rt.notes).toHaveLength(2);
  });
  it("keeps login and runtime-error throttle timestamps independent", () => {
    const rt = fixture();
    rt.run("request", { url: "http://jwxt.swufe.edu.cn/" });
    rt.run("request", { url: "http://jwxt.swufe.edu.cn/" }, undefined, undefined, { $loon: "" });
    rt.run("request", { url: "http://jwxt.swufe.edu.cn/" });
    rt.run("request", { url: "http://jwxt.swufe.edu.cn/" }, undefined, undefined, { $loon: "" });
    expect(rt.notes).toHaveLength(2);
    expect(Object.keys(JSON.parse(rt.store[STORAGE_KEYS.notificationThrottle]!).lastByEvent).sort()).toEqual(["login-required", "runtime-incompatible"]);
  });
  it("clears a clock-expired ticket and throttles the expiry notification", () => {
    const record = JSON.parse(session());
    record.expiresAt = "2020-01-01T00:00:00.000Z";
    const rt = fixture({ [STORAGE_KEYS.session]: JSON.stringify(record) });
    expect(rt.run("request", { url: "http://jwxt.swufe.edu.cn/" })).toEqual({});
    expect(rt.store[STORAGE_KEYS.session]).toBeUndefined();
    expect(rt.store[STORAGE_KEYS.lastError]).toContain("SESSION_EXPIRED");
    expect(rt.notes).toHaveLength(1);
  });
  it("deletes only the session key on logout using undefined and does not recapture response tickets", () => {
    const rt = fixture({ [STORAGE_KEYS.session]: session(), unrelated: "keep" });
    rt.run("request", { url: gateway + "/logout" });
    expect(rt.store[STORAGE_KEYS.session]).toBeUndefined();
    rt.run("response", { url: gateway + "/logout" }, { status: 302, headers: { "set-cookie": `${TICKET_COOKIE_NAME}=B` } });
    expect(rt.store[STORAGE_KEYS.session]).toBeUndefined();
    expect(rt.store.unrelated).toBe("keep");
  });
});

describe("Loon local settings", () => {
  it("serves the bundled Loon page and never captures settings cookies", () => {
    const rt = fixture();
    const response = rt.run("request", { url: SETTINGS_PAGE_URL, headers: { cookie: `${TICKET_COOKIE_NAME}=secret` } }).response as { body: string };
    expect(response.body).toContain("同一 Loon");
    expect(response.body).toContain("crypto.getRandomValues(bytes)");
    expect(response.body).toContain("x-swufe-settings-bootstrap");
    expect(rt.store[STORAGE_KEYS.session]).toBeUndefined();
    expect(rt.run("response", { url: SETTINGS_PAGE_URL }, { status: 200, body: response.body })).toEqual({});
  });
  it("bootstraps and consumes a one-use nonce without host crypto; settings affect the next request", () => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    expect(settingsGet(rt).status).toBe(200);
    expect(settingsPost(rt, update).status).toBe(200);
    expect(settingsPost(rt, update).status).toBe(401);
    expect(rt.run("request", { url: "http://jwxt.swufe.edu.cn/a" })).toEqual({});
    const out = rt.run("request", { url: "http://tyxycg.swufe.edu.cn/a" });
    expect(out.url).toMatch(/\/https\//);
    expect(rt.store[STORAGE_KEYS.session]).toContain("stored-ticket");
    expect(rt.logs.join("")).not.toContain(nonce);
  });
  it.each([
    { referer: "" }, { referer: gateway + "/" }, { referer: "https://evil.example/" }, { origin: "https://evil.example" },
  ] as Array<Record<string, string>>)("rejects nonce bootstrap with untrusted source %j", headers => {
    const rt = fixture();
    expect(settingsGet(rt, nonce, headers).status).toBe(503);
    expect(rt.store[STORAGE_KEYS.settingsCsrf]).toBeUndefined();
  });
  it("rejects missing or malformed bootstrap nonce", () => {
    const rt = fixture();
    expect(settingsGet(rt, "").status).toBe(503);
    expect(settingsGet(rt, "guessable").status).toBe(503);
  });
  it("rejects cross-origin, oversized, invalid and reserved-host updates locally", () => {
    const rt = fixture();
    settingsGet(rt);
    expect(settingsPost(rt, update, nonce, { origin: "https://evil.example" }).status).toBe(401);
    expect(settingsPost(rt, "x".repeat(16385)).status).toBe(413);
    settingsGet(rt);
    expect(settingsPost(rt, "not-json").status).toBe(400);
    settingsGet(rt);
    expect(settingsPost(rt, update.replace("tyxycg.swufe.edu.cn", "authserver.swufe.edu.cn")).body).toContain("RESERVED_HOST");
  });
  it("expires the nonce after two minutes", () => {
    const rt = fixture();
    settingsGet(rt);
    const saved = JSON.parse(rt.store[STORAGE_KEYS.settingsCsrf]!);
    saved.issuedAt = "2020-01-01T00:00:00.000Z";
    rt.store[STORAGE_KEYS.settingsCsrf] = JSON.stringify(saved);
    expect(settingsPost(rt, update).status).toBe(401);
  });
  it("keeps unknown namespace routes and storage exceptions local", () => {
    const rt = fixture();
    expect(rt.run("request", { url: SETTINGS_PAGE_URL + "unknown" }).response).toMatchObject({ status: 404 });
    expect(rt.run("request", { url: api, method: "OPTIONS" }).response).toMatchObject({ status: 405 });
    expect(rt.run("request", { url: api }, undefined, undefined, { $persistentStore: { read: () => { throw new Error("secret"); }, write: () => true } }).response).toMatchObject({ status: 500 });
    expect(rt.logs.join("")).not.toContain("secret");
    rt.failWrites();
    expect(settingsGet(rt).status).toBe(500);
  });
  it("migrates V1 while preserving session and unrelated keys", () => {
    const rt = fixture({ [STORAGE_KEYS.settings]: JSON.stringify({ schemaVersion: 1, enabled: true, gatewayBase: gateway, exactHosts: ["jwxt.swufe.edu.cn"], includeSwufeWildcard: false, debug: false, bodyRewriteMaxBytes: 1048576 }), [STORAGE_KEYS.session]: session(), other: "keep" });
    const old = rt.store[STORAGE_KEYS.session];
    settingsGet(rt);
    expect(JSON.parse(rt.store[STORAGE_KEYS.settingsV2]!).builtinSiteStates).toEqual({ jwxt: true });
    expect(rt.store[STORAGE_KEYS.session]).toBe(old);
    expect(rt.store.other).toBe("keep");
  });
});

describe("Loon response, session and diagnostic boundaries", () => {
  it.each(["captured", "valid"])("preserves %s session through CAS-only redirects", status => {
    const rt = fixture({ [STORAGE_KEYS.session]: session("stored-ticket", status) });
    rt.run("response", { url: "http://jwxt.swufe.edu.cn/a" }, { status: 302, headers: { location: "https://authserver.swufe.edu.cn/authserver/login?ticket=secret" } });
    expect(JSON.parse(rt.store[STORAGE_KEYS.session]!).status).toBe(status);
  });
  it("keeps native gateway bootstrap and headers unchanged without self-promotion", () => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    expect(rt.run("response", { url: wrapped }, { status: 200, headers: { "content-type": "text/html" }, body: '<html><script src="/wengine-vpn/js/main.js"></script></html>' })).toEqual({});
  });
  it("absolutizes a relative WRD redirect when Loon exposes the upstream URL", () => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    const target = codec.encodeUrl("https://jwxt.swufe.edu.cn/xtgl/dl_loginForward.html?language=&_t=123", gateway);
    const relative = new URL(target).pathname + new URL(target).search;
    const out = rt.run("response", { url: codec.encodeUrl("http://jwxt.swufe.edu.cn/", gateway) },
      { status: 302, headers: { Location: relative, "X-Keep": "yes" } });
    expect(out).toEqual({ headers: { Location: target, "X-Keep": "yes" } });
    const browserNext = new URL((out.headers as Record<string, string>).Location!, "http://jwxt.swufe.edu.cn/").href;
    expect(browserNext).toBe(target);
    expect(rt.run("request", { url: browserNext, headers: { cookie: `${TICKET_COOKIE_NAME}=stored-ticket` } })).toEqual({});
  });
  it("does not change native absolute, external, malformed or non-redirect Locations", () => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    const target = codec.encodeUrl("https://jwxt.swufe.edu.cn/b", gateway);
    for (const location of [target, "https://evil.example" + new URL(target).pathname, "/https/not-a-token/b", "/login", wrapped]) {
      expect(rt.run("response", { url: wrapped }, { status: 302, headers: { location } })).toEqual({});
    }
    expect(rt.run("response", { url: wrapped }, { status: 200, headers: { location: new URL(target).pathname } })).toEqual({});
    expect(rt.run("response", { url: wrapped }, { status: 302, headers: { location: new URL(target).pathname } }, { enabled: false })).toEqual({});
  });
  it("rewrites header-only Location when the original URL is exposed without clearing the body", () => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    const out = rt.run("response", { url: "http://jwxt.swufe.edu.cn/a" }, { status: 302, headers: { location: codec.encodeUrl("http://jwxt.swufe.edu.cn/b", gateway) } });
    expect(out).toMatchObject({ headers: { location: "http://jwxt.swufe.edu.cn/b" } });
    expect(out).not.toHaveProperty("body");
  });
  it("decodes relative WRD Location when Loon exposes the original browser URL", () => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    const target = codec.encodeUrl("https://jwxt.swufe.edu.cn/xtgl/dl_loginForward.html?language=&_t=123", gateway);
    const out = rt.run("response", { url: "http://jwxt.swufe.edu.cn/" },
      { status: 302, headers: { location: new URL(target).pathname + new URL(target).search } });
    expect(out).toEqual({ status: 302, headers: { location: "https://jwxt.swufe.edu.cn/xtgl/dl_loginForward.html?language=&_t=123" } });
  });
  it("promotes captured to valid only after a successful protected response", () => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    rt.run("response", { url: "http://jwxt.swufe.edu.cn/a" }, { status: 200, headers: {} });
    expect(JSON.parse(rt.store[STORAGE_KEYS.session]!).status).toBe("valid");
  });
  it("ignores ticket deletion for another client, rotates or deletes a bound ticket", () => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    const deletion = { status: 302, headers: { "set-cookie": `${TICKET_COOKIE_NAME}=; Max-Age=0` } };
    rt.run("response", { url: gateway + "/login", headers: {} }, deletion);
    expect(rt.store[STORAGE_KEYS.session]).toContain("stored-ticket");
    rt.run("response", { url: gateway + "/", headers: { cookie: `${TICKET_COOKIE_NAME}=stored-ticket` } }, { status: 200, headers: { "set-cookie": `${TICKET_COOKIE_NAME}=rotated; Max-Age=3600` } });
    expect(rt.store[STORAGE_KEYS.session]).toContain("rotated");
    rt.run("response", { url: gateway + "/login", headers: { cookie: `${TICKET_COOKIE_NAME}=rotated` } }, deletion);
    expect(rt.store[STORAGE_KEYS.session]).toBeUndefined();
  });
  it("emits safe raw/wrapped authserver classification with debug Argument without secrets", () => {
    const rt = fixture({ [STORAGE_KEYS.session]: session() });
    rt.run("request", { url: "https://authserver.swufe.edu.cn/authserver/login?ticket=CAS-secret&execution=execution-secret", headers: { cookie: "CAS=cookie-secret", authorization: "auth-secret" }, body: "password=password-secret" }, undefined, { debug: true });
    const authWrapped = codec.encodeUrl("https://authserver.swufe.edu.cn/authserver/login", gateway);
    rt.run("request", { url: authWrapped }, undefined, { debug: true });
    expect(rt.logs.join("")).toContain("decodedOriginalHost=authserver.swufe.edu.cn");
    for (const value of ["CAS-secret", "execution-secret", "cookie-secret", "auth-secret", "password-secret", authWrapped]) expect(rt.logs.join("")).not.toContain(value);
  });
  it("preserves Uint8Array results and boolean storage failures at the native boundary", () => {
    const rt = fixture();
    const runtime = bindLoonRuntime({ loon: "iPhone 18.0 3.5.1(998)", store: rt.persistent, notification: { post: () => undefined }, done: value => rt.outputs.push(value) });
    const body = new Uint8Array([0, 255, 128]);
    runtime.finishResponse({ body });
    expect(rt.outputs[0]?.body).toBe(body);
    rt.failWrites();
    expect(runtime.write("key", "value")).toBe(false);
  });
  it.each(["settings", "login"])("generic %s opens the expected Safari URL", action => {
    const rt = fixture();
    expect(rt.run("generic", undefined, undefined, action)).toEqual({});
    expect(rt.notes[0]?.[3]).toEqual({ openUrl: action === "login" ? gateway + "/" : SETTINGS_PAGE_URL });
  });
});
