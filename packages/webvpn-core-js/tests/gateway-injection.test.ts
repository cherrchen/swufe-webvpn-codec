import { describe, expect, it } from "vitest";
import { DEFAULT_KEY, TICKET_COOKIE_NAME, WrdCodec, classifyGatewayRequest, defaultRoutingPolicy, mergeCookies, rewriteRequest, type SessionRecordV1 } from "../src/index.ts";

const now = "2026-09-25T00:00:00.000Z";
const settings = { gatewayBase: "https://webvpn.swufe.edu.cn", wrdKey: DEFAULT_KEY, wrdIv: DEFAULT_KEY, routing: defaultRoutingPolicy(), debug: false };
const stored: SessionRecordV1 = { schemaVersion: 1, gatewayHost: "webvpn.swufe.edu.cn", cookieHeader: `${TICKET_COOKIE_NAME}=A; route=one`, capturedAt: now, lastConfirmedAt: null, expiresAt: null, status: "captured" };
const decide = (url: string, headers: Record<string, string> = {}, session: SessionRecordV1 | null = stored) => rewriteRequest({ url, method: "GET", headers }, settings, session, now);
const wrapped = (scheme: "http" | "https", host = "jwxt.swufe.edu.cn") => new WrdCodec(DEFAULT_KEY, DEFAULT_KEY, "webvpn.swufe.edu.cn").encodeUrl(`${scheme}://${host}/path`, settings.gatewayBase);

describe("direct gateway session", () => {
  it("classifies only known paths and leaves login, settings, and unknown closed", () => {
    expect(classifyGatewayRequest("https://webvpn.swufe.edu.cn/__swufe_bridge__/api")).toBe("settings");
    expect(classifyGatewayRequest("https://webvpn.swufe.edu.cn/login")).toBe("login");
    expect(classifyGatewayRequest("https://webvpn.swufe.edu.cn/logout")).toBe("logout");
    expect(classifyGatewayRequest("https://webvpn.swufe.edu.cn/logout?next=%2F")).toBe("logout");
    expect(classifyGatewayRequest("https://webvpn.swufe.edu.cn/logout-extra")).toBe("unknown");
    expect(classifyGatewayRequest("https://webvpn.swufe.edu.cn/wengine-vpn/js/a.js")).toBe("gateway-owned");
    for (const path of ["/login", "/logout", "/other", "/wengine-vpn/logout", "/__swufe_bridge__/api"]) expect(decide(`https://webvpn.swufe.edu.cn${path}`)).toEqual({ kind: "pass" });
    expect(decide("https://webvpn.swufe.edu.cn/logout", { cookie: `${TICKET_COOKIE_NAME}=B` })).toEqual({ kind: "pass" });
  });

  it("injects only to allowed gateway URLs, including both WRD schemes", () => {
    for (const url of ["https://webvpn.swufe.edu.cn/", wrapped("http"), wrapped("https")]) {
      const result = decide(url, { cookie: "other=x" });
      expect(result.kind).toBe("inject_gateway_session");
      if (result.kind === "inject_gateway_session") expect(result.headers.cookie).toContain(`${TICKET_COOKIE_NAME}=A`);
    }
    expect(decide("https://webvpn.swufe.edu.cn/", {}, null)).toEqual({ kind: "pass" });
    expect(decide("https://webvpn.swufe.edu.cn/", {}, { ...stored, expiresAt: "2026-09-24T00:00:00.000Z" })).toEqual({ kind: "pass" });
    expect(decide("https://authserver.swufe.edu.cn/", {}, stored)).toEqual({ kind: "pass" });
    expect(decide(wrapped("https", "authserver.swufe.edu.cn"))).toEqual({ kind: "pass" });
    expect(decide(wrapped("https", "example.com"))).toEqual({ kind: "pass" });
    expect(decide(wrapped("https", "tyxycg.swufe.edu.cn"))).toEqual({ kind: "pass" });
    const selected = { ...settings, routing: { ...settings.routing, exactHosts: ["jwxt.swufe.edu.cn", "tyxycg.swufe.edu.cn"] } };
    expect(rewriteRequest({ url: wrapped("https", "tyxycg.swufe.edu.cn"), method: "GET", headers: {} }, selected, stored, now).kind).toBe("inject_gateway_session");
    expect(decide("https://webvpn.swufe.edu.cn/http/invalid/path")).toEqual({ kind: "pass" });
    expect(rewriteRequest({ url: "https://webvpn.swufe.edu.cn/", method: "POST", headers: {} }, settings, stored, now)).toEqual({ kind: "pass" });
  });

  it("captures client ticket B and never replaces it with stored ticket A", () => {
    const result = decide(wrapped("http"), { Cookie: `${TICKET_COOKIE_NAME}=B` });
    expect(result.kind).toBe("capture_session");
    if (result.kind === "capture_session") expect(result.session.cookieHeader).toBe(`${TICKET_COOKIE_NAME}=B`);
    expect(mergeCookies(`${TICKET_COOKIE_NAME}=B; app=x`, stored.cookieHeader)).toBe(`${TICKET_COOKIE_NAME}=B; app=x; route=one`);
  });
});
