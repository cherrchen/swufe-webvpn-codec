import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_KEY,
  defaultRoutingPolicy,
  diagnosticContainsSensitive,
  isGatewayBootstrapHtml,
  notificationFor,
  promoteSession,
  redactText,
  rewriteRequest,
  rewriteResponse,
  safeDiagnostic,
  type RequestRewriteContext,
  type RewriteSettings,
  type SessionRecordV1,
} from "../src/index.ts";

const NOW = "2026-09-24T08:00:00.000Z";
const SESSION: SessionRecordV1 = {
  schemaVersion: 1,
  gatewayHost: "webvpn.swufe.edu.cn",
  cookieHeader: "route=fake; show_vpn=1",
  capturedAt: NOW,
  lastConfirmedAt: null,
  status: "captured",
};

function settings(overrides: Partial<RewriteSettings> = {}): RewriteSettings {
  return {
    gatewayBase: "https://webvpn.swufe.edu.cn",
    wrdKey: DEFAULT_KEY,
    wrdIv: DEFAULT_KEY,
    routing: defaultRoutingPolicy(),
    debug: false,
    ...overrides,
  };
}

describe("IOS-TC-D request rewrite", () => {
  it("D01 allowlist plus session rewrites to the gateway and injects the cookie", () => {
    const decision = rewriteRequest(
      { url: "https://jwxt.swufe.edu.cn/sso/jziotlogin", method: "GET", headers: {} },
      settings(),
      SESSION,
      NOW,
    );
    expect(decision.kind).toBe("rewrite");
    if (decision.kind !== "rewrite") return;
    expect(decision.url).toContain("https://webvpn.swufe.edu.cn/https/");
    expect(decision.url).toContain("/sso/jziotlogin");
    expect(decision.headers.cookie).toBe(SESSION.cookieHeader);
    expect(decision.context.gatewayOwned).toBe(false);
  });

  it("D02 allowlist without session asks for login", () => {
    expect(
      rewriteRequest({ url: "https://jwxt.swufe.edu.cn/", method: "GET", headers: {} }, settings(), null, NOW).kind,
    ).toBe("login_required");
  });

  it("D03 non-allowlist does not attach the session cookie", () => {
    const decision = rewriteRequest(
      { url: "https://example.com/a", method: "GET", headers: { cookie: "site=1" } },
      settings(),
      SESSION,
      NOW,
    );
    expect(decision).toEqual({ kind: "pass" });
  });

  it("D04 gateway request can capture and still pass", () => {
    const decision = rewriteRequest(
      { url: "https://webvpn.swufe.edu.cn/", method: "GET", headers: { cookie: "route=fake" } },
      settings(),
      null,
      NOW,
    );
    expect(decision.kind).toBe("capture_session");
    if (decision.kind !== "capture_session") return;
    expect(decision.pass).toBe(true);
    expect(decision.session.cookieHeader).toBe("route=fake");
  });

  it("D05 auth request passes and does not require the body", () => {
    const decision = rewriteRequest(
      {
        url: "https://authserver.swufe.edu.cn/authserver/login",
        method: "POST",
        headers: { cookie: "CASTGC=fake" },
        body: "username=should-not-matter",
      },
      settings(),
      SESSION,
      NOW,
    );
    expect(decision).toEqual({ kind: "pass" });
  });

  it("D06 codec failure is fail-closed", () => {
    const decision = rewriteRequest(
      { url: "https://jwxt.swufe.edu.cn/", method: "GET", headers: {} },
      settings({ wrdKey: "short" }),
      SESSION,
      NOW,
    );
    expect(decision).toEqual({ kind: "error", code: "CODEC_FAILED" });
  });

  it("D07 D08 origin and referer follow the desktop contract", () => {
    const decision = rewriteRequest(
      {
        url: "https://jwxt.swufe.edu.cn/app",
        method: "GET",
        headers: {
          origin: "https://jwxt.swufe.edu.cn",
          referer: "https://jwxt.swufe.edu.cn/home",
        },
      },
      settings(),
      SESSION,
      NOW,
    );
    expect(decision.kind).toBe("rewrite");
    if (decision.kind !== "rewrite") return;
    expect(decision.headers.origin).toBe("https://webvpn.swufe.edu.cn");
    expect(decision.headers.referer).toContain("https://webvpn.swufe.edu.cn/https/");
    expect(decision.headers.referer).toContain("/home");
  });

  it("D09 a pass decision never emits the webvpn cookie", () => {
    const decision = rewriteRequest(
      { url: "https://example.com/", method: "GET", headers: {} },
      settings(),
      SESSION,
      NOW,
    );
    expect(JSON.stringify(decision)).not.toContain(SESSION.cookieHeader);
  });

  it("gateway-owned paths are not token-wrapped", () => {
    const decision = rewriteRequest(
      { url: "http://jwxt.swufe.edu.cn/wengine-vpn/js/main.js?ver=1", method: "GET", headers: {} },
      settings(),
      SESSION,
      NOW,
    );
    expect(decision.kind).toBe("rewrite");
    if (decision.kind !== "rewrite") return;
    expect(decision.url).toBe("https://webvpn.swufe.edu.cn/wengine-vpn/js/main.js?ver=1");
    expect(decision.context.gatewayOwned).toBe(true);
  });
});

describe("IOS-TC-E response rewrite", () => {
  function context(): RequestRewriteContext {
    const decision = rewriteRequest(
      { url: "https://jwxt.swufe.edu.cn/main", method: "GET", headers: {} },
      settings(),
      SESSION,
      NOW,
    );
    if (decision.kind !== "rewrite") {
      throw new Error(decision.kind);
    }
    return decision.context;
  }

  it("E01 E02 location", () => {
    const ctx = context();
    const wrd = rewriteResponse(ctx, { status: 302, headers: { location: ctx.wrdUrl } }, settings());
    expect(wrd.changes).toContain("location");
    expect(wrd.response.headers.location).toBe("https://jwxt.swufe.edu.cn/main");
    const plain = rewriteResponse(ctx, { status: 302, headers: { location: "https://example.com/x" } }, settings());
    expect(plain.changes).not.toContain("location");
  });

  it("E03 E04 set-cookie domain and path", () => {
    const ctx = context();
    const result = rewriteResponse(
      ctx,
      {
        status: 200,
        headers: { "set-cookie": `a=b; domain=webvpn.swufe.edu.cn; path=${ctx.wrdPrefix}/app` },
      },
      settings(),
    );
    expect(result.changes).toContain("set-cookie");
    expect(result.response.headers["set-cookie"]).toContain("domain=jwxt.swufe.edu.cn");
    expect(result.response.headers["set-cookie"]).toContain("path=/app");
  });

  it("E05 E06 E07 body forms", () => {
    const ctx = context();
    const token = ctx.wrdUrl.split("/")[4] ?? "";
    const html = rewriteResponse(
      ctx,
      { status: 200, headers: { "content-type": "text/html" }, body: `<a href="/https/${token}/main">` },
      settings(),
    );
    expect(html.response.body).toContain("https://jwxt.swufe.edu.cn/main");
    const script = rewriteResponse(
      ctx,
      {
        status: 200,
        headers: { "content-type": "application/javascript" },
        body: `x = "\\/https\\/${token}\\/api";`,
      },
      settings(),
    );
    expect(script.response.body).toBe('x = "https:\\/\\/jwxt.swufe.edu.cn\\/api";');
    const json = rewriteResponse(
      ctx,
      {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: `/https/${token}/main` }),
      },
      settings(),
    );
    expect(String(json.response.body)).toContain("https://jwxt.swufe.edu.cn/main");
  });

  it("E08 image is not body-rewritten", () => {
    const result = rewriteResponse(
      context(),
      { status: 200, headers: { "content-type": "image/png" }, body: "not-really" },
      settings(),
    );
    expect(result.changes).not.toContain("body");
    expect(result.response.body).toBe("not-really");
  });

  it("E09 oversized body is skipped", () => {
    const result = rewriteResponse(
      context(),
      { status: 200, headers: { "content-type": "text/html" }, body: "<html>https://webvpn.swufe.edu.cn</html>" },
      settings({ bodyRewriteMaxBytes: 8 }),
    );
    expect(result.warning).toBe("body-too-large");
    expect(result.changes).not.toContain("body");
  });

  it("E10 bootstrap html is promoted", () => {
    const ctx = context();
    const body = `<html><script>var __vpn_ok=1</script><script src="/wengine-vpn/js/main.js"></script></html>`;
    expect(isGatewayBootstrapHtml("text/html", new TextEncoder().encode(body))).toBe(true);
    const result = rewriteResponse(ctx, { status: 200, headers: { "content-type": "text/html" }, body }, settings());
    expect(result.changes).toEqual(["promotion"]);
    expect(result.response.status).toBe(302);
    expect(result.response.headers.location).toBe(ctx.wrdUrl);
  });

  it("E11 gateway-owned responses are not reverse-rewritten", () => {
    const decision = rewriteRequest(
      { url: "https://jwxt.swufe.edu.cn/wengine-vpn/js/main.js", method: "GET", headers: {} },
      settings(),
      SESSION,
      NOW,
    );
    if (decision.kind !== "rewrite") throw new Error(decision.kind);
    const result = rewriteResponse(
      decision.context,
      { status: 200, headers: { "content-type": "application/javascript" }, body: "keep" },
      settings(),
    );
    expect(result.changed).toBe(false);
    expect(result.response.body).toBe("keep");
  });

  it("authserver redirect on a rewritten allowlist response marks the session expired", () => {
    const result = rewriteResponse(
      context(),
      { status: 302, headers: { location: "https://authserver.swufe.edu.cn/authserver/login" } },
      settings(),
    );
    expect(result.sessionExpired).toBe(true);
  });

  it("login redirect from the gateway itself does not mark the session expired", () => {
    const result = rewriteResponse(
      null,
      { status: 302, headers: { location: "https://authserver.swufe.edu.cn/authserver/login" } },
      settings(),
    );
    expect(result.sessionExpired).toBe(false);
  });
});

describe("IOS-TC-F diagnostics", () => {
  it("F01 debug off yields no traffic record", () => {
    expect(
      safeDiagnostic(
        { ts: NOW, host: "jwxt.swufe.edu.cn", direction: "request", action: "rewrite" },
        false,
      ),
    ).toBeNull();
  });

  it("F01 system entered is kept when debug is off and query is redacted", () => {
    const record = safeDiagnostic(
      {
        ts: NOW,
        host: "webvpn.swufe.edu.cn",
        direction: "system",
        action: "entered",
        detail: "swufe-webvpn-request https://webvpn.swufe.edu.cn/login?ticket=abc",
      },
      false,
    );
    expect(record?.action).toBe("entered");
    expect(record?.detail).toBe("swufe-webvpn-request https://webvpn.swufe.edu.cn/login?ticket=[redacted]");
    expect(diagnosticContainsSensitive(record)).toBe(false);
  });

  it("F02 debug on redacts cookie, body, and token", () => {
    const record = safeDiagnostic(
      {
        ts: NOW,
        host: "jwxt.swufe.edu.cn",
        direction: "request",
        action: "error",
        detail: "cookie=route-secret body=secret 77726476706e69737468656265737421f1e2559434357a467b1ac7bf8f40253097e41b52087752",
      },
      true,
    );
    expect(diagnosticContainsSensitive(record)).toBe(false);
    expect(record?.detail).not.toContain("route-secret");
  });

  it("F03 notification has no cookie or account", () => {
    const note = notificationFor("login-required");
    expect(note.body).toBe("打开网页登录");
    expect(note.openUrl).toBe("https://webvpn.swufe.edu.cn");
    expect(JSON.stringify(note)).not.toMatch(/cookie|password|学号/i);
  });

  it("F05 wildcard default is false", () => {
    expect(defaultRoutingPolicy().includeSwufeWildcard).toBe(false);
  });

  it("F08 thrown codec text does not include the input secret", () => {
    expect(redactText("password=secret")).not.toContain("secret");
  });

  it("a successful rewrite can promote captured to valid", () => {
    expect(promoteSession(SESSION, NOW).status).toBe("valid");
  });
});

describe("host isolation", () => {
  it("core source does not touch host globals or Node crypto", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../src");
    const files = walk(root);
    const banned = ["$request", "$response", "$persistentStore", "$done", "node:crypto", "from \"fs\"", "Buffer"];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const word of banned) {
        expect(text, file).not.toContain(word);
      }
    }
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : path.endsWith(".ts") ? [path] : [];
  });
}
