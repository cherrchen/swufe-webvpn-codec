import { describe, expect, it } from "vitest";
import {
  decideRoute,
  defaultSettings,
  memoryKv,
  STORAGE_KEYS,
  classifySettingsRoute,
  compileRoutingPolicy,
  defaultSettingsV2,
  handleSettingsRequest,
  loadSettingsV2,
  migrateV1ToV2,
  validateSettingsHostname,
  validateSettingsUpdate,
  BUILTIN_SITES,
  MIGRATION_WARNING,
  SETTINGS_BODY_MAX_BYTES,
  type SettingsV2,
} from "../src/index.ts";

const NOW = "2026-09-24T08:00:00.000Z";
const TOKEN = "ab".repeat(16);

function settings(overrides: Partial<SettingsV2> = {}): SettingsV2 {
  return { ...defaultSettingsV2(), ...overrides };
}

describe("settings hostname", () => {
  it("L01 normalizes case, space, and trailing dots", () => {
    expect(validateSettingsHostname(" JWXT.SWUFE.EDU.CN. ")).toMatchObject({ ok: true, value: "jwxt.swufe.edu.cn" });
  });

  it("L02 rejects a URL", () => {
    expect(validateSettingsHostname("https://jwxt.swufe.edu.cn/foo?a=1").ok).toBe(false);
  });

  it("L03 and K15 reject path, port, userinfo, wildcard, IP, and localhost", () => {
    for (const sample of ["foo/bar", "foo.swufe.edu.cn:443", "user@foo.swufe.edu.cn", "*.swufe.edu.cn", "127.0.0.1", "localhost", "foo.com", "swufe.edu.cn"]) {
      expect(validateSettingsHostname(sample).ok).toBe(false);
    }
  });

  it("K16 rejects reserved hosts after normalization", () => {
    expect(validateSettingsHostname("WEBVPN.SWUFE.EDU.CN.")).toMatchObject({ ok: false, code: "RESERVED_HOST" });
    expect(validateSettingsHostname("authserver.swufe.edu.cn")).toMatchObject({ ok: false, code: "RESERVED_HOST" });
  });

  it("K17 rejects a custom host that duplicates a builtin", () => {
    const result = validateSettingsUpdate(
      { schemaVersion: 2, builtinSiteStates: { jwxt: true }, customHosts: ["jwxt.swufe.edu.cn"] },
      BUILTIN_SITES.map((site) => site.host),
    );
    expect(result).toMatchObject({ ok: false, code: "DUPLICATE_HOST" });
  });
});

describe("settings migration", () => {
  it("L04 maps V1 defaults onto the jwxt builtin", () => {
    const migrated = migrateV1ToV2(defaultSettings());
    expect(migrated.builtinSiteStates.jwxt).toBe(true);
    expect(migrated.customHosts).toEqual([]);
    expect(migrated.migrationWarnings).toEqual([]);
    expect(compileRoutingPolicy(migrated).includeSwufeWildcard).toBe(false);
  });

  it("L05 keeps an in-scope custom host", () => {
    const migrated = migrateV1ToV2({ ...defaultSettings(), exactHosts: ["jwxt.swufe.edu.cn", "LIB.SWUFE.EDU.CN."] });
    expect(migrated.customHosts).toEqual(["lib.swufe.edu.cn"]);
  });

  it("L06 drops out-of-scope hosts and the wildcard without echoing them", () => {
    const migrated = migrateV1ToV2({
      ...defaultSettings(),
      exactHosts: ["example.com", "webvpn.swufe.edu.cn", "*.swufe.edu.cn", "127.0.0.1"],
      includeSwufeWildcard: true,
    });
    expect(migrated.customHosts).toEqual([]);
    expect(migrated.builtinSiteStates.jwxt).toBe(false);
    expect(migrated.migrationWarnings).toEqual([MIGRATION_WARNING]);
    expect(JSON.stringify(migrated)).not.toContain("example.com");
    expect(compileRoutingPolicy(migrated).includeSwufeWildcard).toBe(false);
  });

  it("L07 keeps V1 and uses the default exact route when V2 cannot be written", () => {
    const kv = memoryKv({
      [STORAGE_KEYS.settings]: JSON.stringify({ ...defaultSettings(), exactHosts: ["lib.swufe.edu.cn"], includeSwufeWildcard: true }),
      [STORAGE_KEYS.session]: "session-keep",
    });
    kv.write = () => false;
    const loaded = loadSettingsV2(kv);
    expect(loaded.kind).toBe("fail-closed");
    if (loaded.kind === "fail-closed") {
      expect(compileRoutingPolicy(loaded.settings).exactHosts).toEqual(["jwxt.swufe.edu.cn"]);
      expect(compileRoutingPolicy(loaded.settings).includeSwufeWildcard).toBe(false);
    }
    expect(kv.read(STORAGE_KEYS.settings)).toContain("lib.swufe.edu.cn");
    expect(kv.read(STORAGE_KEYS.session)).toBe("session-keep");
  });

  it("L08 migration does not change the session value", () => {
    const kv = memoryKv({
      [STORAGE_KEYS.settings]: JSON.stringify(defaultSettings()),
      [STORAGE_KEYS.session]: "session-keep",
    });
    expect(loadSettingsV2(kv).kind).toBe("ready");
    expect(kv.read(STORAGE_KEYS.session)).toBe("session-keep");
    expect(kv.read(STORAGE_KEYS.settingsV2)).toContain("\"schemaVersion\":2");
  });
});

describe("compiled routing", () => {
  it("M01 rewrites only a selected custom host", () => {
    const policy = compileRoutingPolicy(settings({ customHosts: ["lib.swufe.edu.cn"] }));
    expect(decideRoute("lib.swufe.edu.cn", policy)).toMatchObject({ kind: "rewrite" });
  });

  it("M02 passes an unselected SWUFE host", () => {
    expect(decideRoute("lib.swufe.edu.cn", compileRoutingPolicy(settings())).kind).toBe("pass");
  });

  it("M03 passes jwxt when the builtin is disabled", () => {
    const policy = compileRoutingPolicy(settings({ builtinSiteStates: { jwxt: false } }));
    expect(decideRoute("jwxt.swufe.edu.cn", policy).kind).toBe("pass");
  });

  it("M04 passes a removed custom host", () => {
    const before = compileRoutingPolicy(settings({ customHosts: ["lib.swufe.edu.cn"] }));
    const after = compileRoutingPolicy(settings({ customHosts: [] }));
    expect(decideRoute("lib.swufe.edu.cn", before).kind).toBe("rewrite");
    expect(decideRoute("lib.swufe.edu.cn", after).kind).toBe("pass");
  });
});

describe("settings route", () => {
  it("classifies the reserved namespace and leaves other paths alone", () => {
    expect(classifySettingsRoute({ method: "GET", path: "/__swufe_bridge__/" }).kind).toBe("settings-page");
    expect(classifySettingsRoute({ method: "POST", path: "/__swufe_bridge__/api/settings" }).kind).toBe("settings-post");
    expect(classifySettingsRoute({ method: "PUT", path: "/__swufe_bridge__/api/settings" }).kind).toBe("settings-method-not-allowed");
    expect(classifySettingsRoute({ method: "GET", path: "/__swufe_bridge__/missing" }).kind).toBe("settings-not-found");
    expect(classifySettingsRoute({ method: "GET", path: "/portal" }).kind).toBe("business-request");
  });

  it("rejects an oversized body before parsing it", () => {
    const kv = memoryKv();
    const response = handleSettingsRequest(
      {
        method: "POST",
        path: "/__swufe_bridge__/api/settings",
        nowIso: NOW,
        contentType: "application/json",
        token: TOKEN,
        body: "x".repeat(SETTINGS_BODY_MAX_BYTES + 1),
      },
      { kv, statusProvider: { getStatus: () => "logged-out" }, pageHtml: "<p>settings</p>" },
    );
    expect(response.status).toBe(413);
    expect(response.body).toContain("BODY_TOO_LARGE");
    expect(kv.read(STORAGE_KEYS.settingsV2)).toBeNull();
  });

  it("K23 does not issue a token when no secure nonce is available", () => {
    const response = handleSettingsRequest(
      { method: "GET", path: "/__swufe_bridge__/api/settings", nowIso: NOW },
      { kv: memoryKv(), statusProvider: { getStatus: () => "logged-out" }, pageHtml: "<p>settings</p>" },
    );
    expect(response.status).toBe(503);
    expect(response.body).toContain("SETTINGS_UNAVAILABLE");
    expect(response.body).not.toContain("token");
  });

  it("returns local 404 and 405 for unknown settings routes", () => {
    const deps = { kv: memoryKv(), statusProvider: { getStatus: () => "logged-out" as const }, pageHtml: "<p>settings</p>" };
    expect(handleSettingsRequest({ method: "GET", path: "/__swufe_bridge__/missing", nowIso: NOW }, deps).status).toBe(404);
    expect(handleSettingsRequest({ method: "PUT", path: "/__swufe_bridge__/api/settings", nowIso: NOW }, deps).status).toBe(405);
  });
});
