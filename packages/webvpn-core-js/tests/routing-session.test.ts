import { describe, expect, it } from "vitest";
import {
  applyNewerCookie,
  captureSession,
  createSessionStore,
  decideRoute,
  defaultRoutingPolicy,
  memoryKv,
  parseSession,
  type RoutingPolicy,
} from "../src/index.ts";

const NOW = "2026-09-24T08:00:00.000Z";

function policy(overrides: Partial<RoutingPolicy> = {}): RoutingPolicy {
  return { ...defaultRoutingPolicy(), ...overrides };
}

describe("IOS-TC-B routing", () => {
  it("B01 default jwxt rewrites", () => {
    expect(decideRoute("jwxt.swufe.edu.cn", policy()).kind).toBe("rewrite");
  });

  it("B02 ordinary internet passes", () => {
    expect(decideRoute("example.com", policy()).kind).toBe("pass");
  });

  it("B03 gateway is not an ordinary rewrite", () => {
    expect(decideRoute("webvpn.swufe.edu.cn", policy()).kind).toBe("gateway");
  });

  it("B04 authserver is not an ordinary rewrite", () => {
    expect(decideRoute("authserver.swufe.edu.cn", policy()).kind).toBe("auth");
  });

  it("B05 wildcard off leaves other swufe hosts", () => {
    expect(decideRoute("lib.swufe.edu.cn", policy()).kind).toBe("pass");
  });

  it("B06 wildcard on rewrites swufe hosts", () => {
    expect(decideRoute("lib.swufe.edu.cn", policy({ includeSwufeWildcard: true })).kind).toBe("rewrite");
  });

  it("B07 apex follows the wildcard flag", () => {
    expect(decideRoute("swufe.edu.cn", policy()).kind).toBe("pass");
    expect(decideRoute("swufe.edu.cn", policy({ includeSwufeWildcard: true })).kind).toBe("rewrite");
  });

  it("B08 upper-case host is normalized", () => {
    const decision = decideRoute("JWXT.SWUFE.EDU.CN.", policy());
    expect(decision).toEqual({ kind: "rewrite", originalHost: "jwxt.swufe.edu.cn" });
  });

  it("B09 illegal host is invalid and is not a rewrite", () => {
    expect(decideRoute("https://jwxt.swufe.edu.cn", policy()).kind).toBe("invalid");
    expect(decideRoute("bad host", policy()).kind).toBe("invalid");
  });
});

describe("IOS-TC-C session", () => {
  const gateway = "webvpn.swufe.edu.cn";

  it("C01 captures a gateway cookie", () => {
    const result = captureSession({
      url: "https://webvpn.swufe.edu.cn/portal",
      headers: { Cookie: "route=1; show_vpn=1" },
      nowIso: NOW,
      gatewayHost: gateway,
    });
    expect(result.kind).toBe("captured");
    if (result.kind === "captured") {
      expect(result.session.cookieHeader).toBe("route=1; show_vpn=1");
      expect(result.session.status).toBe("captured");
    }
  });

  it("C02 gateway without cookie does not write", () => {
    expect(
      captureSession({ url: "https://webvpn.swufe.edu.cn/", headers: {}, nowIso: NOW, gatewayHost: gateway }).kind,
    ).toBe("no_cookie");
  });

  it("C03 authserver cookie is not a session", () => {
    expect(
      captureSession({
        url: "https://authserver.swufe.edu.cn/authserver/login",
        headers: { cookie: "CASTGC=fake" },
        nowIso: NOW,
        gatewayHost: gateway,
      }).kind,
    ).toBe("not_gateway");
  });

  it("C04 other hosts are not a session", () => {
    expect(
      captureSession({
        url: "https://jwxt.swufe.edu.cn/",
        headers: { cookie: "JSESSIONID=fake" },
        nowIso: NOW,
        gatewayHost: gateway,
      }).kind,
    ).toBe("not_gateway");
  });

  it("C05 reload reads the stored record", () => {
    const kv = memoryKv();
    const store = createSessionStore(kv);
    const captured = captureSession({
      url: "https://webvpn.swufe.edu.cn/",
      headers: { cookie: "route=1" },
      nowIso: NOW,
      gatewayHost: gateway,
    });
    expect(captured.kind).toBe("captured");
    if (captured.kind !== "captured") return;
    expect(store.save(captured.session)).toBe(true);
    expect(createSessionStore(kv).load()).toEqual(captured.session);
  });

  it("C06 clear is idempotent", () => {
    const store = createSessionStore(memoryKv());
    expect(store.clear()).toBe(true);
    expect(store.clear()).toBe(true);
    expect(store.load()).toBeNull();
  });

  it("C07 a different gateway drops the old session at the caller boundary", () => {
    const captured = captureSession({
      url: "https://webvpn.swufe.edu.cn/",
      headers: { cookie: "route=1" },
      nowIso: NOW,
      gatewayHost: gateway,
    });
    expect(captured.kind).toBe("captured");
    if (captured.kind !== "captured") return;
    const other = applyNewerCookie(captured.session, {
      ...captured.session,
      gatewayHost: "vpn.example.edu",
      cookieHeader: "route=2",
    });
    expect(other.gatewayHost).toBe("vpn.example.edu");
    expect(other.cookieHeader).not.toBe(captured.session.cookieHeader);
  });

  it("C08 corrupt JSON is dropped without echoing it", () => {
    const kv = memoryKv({ "swufe.session.v1": "{not-json cookie=secret" });
    expect(createSessionStore(kv).load()).toBeNull();
    expect(kv.dump()["swufe.session.v1"]).toBeUndefined();
    expect(parseSession("{").kind).toBe("corrupt");
  });

  it("C09 unknown schema is incompatible", () => {
    expect(parseSession(JSON.stringify({ schemaVersion: 9, cookieHeader: "a=b" })).kind).toBe("incompatible");
  });

  it("C10 a newer cookie updates the header and keeps a valid status", () => {
    const current = {
      schemaVersion: 1 as const,
      gatewayHost: gateway,
      cookieHeader: "route=1",
      capturedAt: NOW,
      lastConfirmedAt: NOW,
      status: "valid" as const,
    };
    const next = applyNewerCookie(current, { ...current, cookieHeader: "route=2", status: "captured", lastConfirmedAt: null });
    expect(next.cookieHeader).toBe("route=2");
    expect(next.status).toBe("valid");
  });
});
