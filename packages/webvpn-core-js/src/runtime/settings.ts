import type { PluginErrorCode } from "../errors.ts";
import { DEFAULT_IV, DEFAULT_KEY, gatewayHost } from "../codec/wrd-codec.ts";
import { defaultRoutingPolicy, normalizeHost, type RoutingPolicy } from "../routing/allowlist.ts";
import { DEFAULT_BODY_REWRITE_MAX_BYTES } from "../rewrite/request.ts";

export interface PluginSettingsV1 {
  schemaVersion: 1;
  enabled: boolean;
  gatewayBase: string;
  exactHosts: string[];
  includeSwufeWildcard: boolean;
  debug: boolean;
  wrdKeyOverride?: string;
  wrdIvOverride?: string;
  bodyRewriteMaxBytes: number;
}

export function defaultSettings(): PluginSettingsV1 {
  return {
    schemaVersion: 1,
    enabled: true,
    gatewayBase: "https://webvpn.swufe.edu.cn",
    exactHosts: ["jwxt.swufe.edu.cn"],
    includeSwufeWildcard: false,
    debug: false,
    bodyRewriteMaxBytes: DEFAULT_BODY_REWRITE_MAX_BYTES,
  };
}

export function parseSettings(raw: string | null): PluginSettingsV1 {
  if (!raw) {
    return defaultSettings();
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaultSettings();
  }
  if (!data || typeof data !== "object") {
    return defaultSettings();
  }
  const record = data as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    return defaultSettings();
  }
  const base = defaultSettings();
  const gatewayBase = typeof record.gatewayBase === "string" ? record.gatewayBase : base.gatewayBase;
  try {
    gatewayHost(gatewayBase);
  } catch {
    return base;
  }
  const exactHosts = Array.isArray(record.exactHosts)
    ? uniqueHosts(record.exactHosts.filter((item): item is string => typeof item === "string"))
    : base.exactHosts;
  const maxBytes = typeof record.bodyRewriteMaxBytes === "number" ? record.bodyRewriteMaxBytes : base.bodyRewriteMaxBytes;
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    return base;
  }
  const settings: PluginSettingsV1 = {
    schemaVersion: 1,
    enabled: typeof record.enabled === "boolean" ? record.enabled : base.enabled,
    gatewayBase,
    exactHosts,
    includeSwufeWildcard: typeof record.includeSwufeWildcard === "boolean" ? record.includeSwufeWildcard : false,
    debug: record.debug === true,
    bodyRewriteMaxBytes: maxBytes,
  };
  if (typeof record.wrdKeyOverride === "string") {
    if (new TextEncoder().encode(record.wrdKeyOverride).length !== 16) {
      return base;
    }
    settings.wrdKeyOverride = record.wrdKeyOverride;
  }
  if (typeof record.wrdIvOverride === "string") {
    if (new TextEncoder().encode(record.wrdIvOverride).length !== 16) {
      return base;
    }
    settings.wrdIvOverride = record.wrdIvOverride;
  }
  return settings;
}

export function toRewriteSettings(settings: PluginSettingsV1): {
  gatewayBase: string;
  wrdKey: string;
  wrdIv: string;
  routing: RoutingPolicy;
  debug: boolean;
  bodyRewriteMaxBytes: number;
} {
  return {
    gatewayBase: settings.gatewayBase,
    wrdKey: settings.wrdKeyOverride ?? DEFAULT_KEY,
    wrdIv: settings.wrdIvOverride ?? DEFAULT_IV,
    routing: {
      ...defaultRoutingPolicy(),
      exactHosts: settings.exactHosts,
      includeSwufeWildcard: settings.includeSwufeWildcard,
    },
    debug: settings.debug,
    bodyRewriteMaxBytes: settings.bodyRewriteMaxBytes,
  };
}

export interface StashTileViewModel {
  title: "SWUFE WebVPN";
  content: string;
  url: string;
  icon?: string;
}

export function stashTile(input: {
  sessionReady: boolean;
  expired: boolean;
  incompatible: boolean;
}): StashTileViewModel {
  let content = "未登录 · 打开网页登录";
  if (input.incompatible) {
    content = "插件需要更新";
  } else if (input.expired) {
    content = "会话已失效 · 打开网页登录";
  } else if (input.sessionReady) {
    content = "已登录";
  }
  const loggedIn = input.sessionReady && !input.expired && !input.incompatible;
  return {
    title: "SWUFE WebVPN",
    content,
    url: loggedIn ? "https://webvpn.swufe.edu.cn/__swufe_bridge__/" : "https://webvpn.swufe.edu.cn",
    icon: "network",
  };
}

export type RuntimeCompatibility = {
  compatible: boolean;
  missingCapabilities: string[];
  code?: PluginErrorCode;
};

function uniqueHosts(hosts: string[]): string[] {
  const out: string[] = [];
  for (const host of hosts) {
    try {
      const normalized = normalizeHost(host);
      if (!out.includes(normalized)) {
        out.push(normalized);
      }
    } catch {
      continue;
    }
  }
  return out.length > 0 ? out : ["jwxt.swufe.edu.cn"];
}
