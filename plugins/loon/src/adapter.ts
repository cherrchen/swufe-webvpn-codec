import {
  SETTINGS_ORIGIN, SETTINGS_PAGE_URL, STORAGE_KEYS, headerValue,
  loadSettingsV2, notificationFor, settingsErrorResponse, type HostEnvironment,
} from "webvpn-core-js";
import {
  createPluginAdapter, handlePluginRequest, handlePluginResponse,
  type PluginRuntime,
} from "webvpn-plugin-runtime";
import { LOON_SETTINGS_PAGE_HTML } from "./settings-page.ts";

export type LoonRuntime = PluginRuntime;
export interface LoonArguments { enabled?: boolean; debug?: boolean }
export const MIN_LOON_BUILD = 983;

export function loonEnvironment(value: string): HostEnvironment {
  const match = /(\d+\.\d+\.\d+)\((\d+)\)/.exec(value);
  return {
    host: "loon", version: match?.[1] ?? "",
    ...(match?.[2] ? { build: Number(match[2]) } : {}),
    platform: /^Mac\b/.test(value) ? "macos" : /^iPad/.test(value) ? "ipados" : /^iPhone/.test(value) ? "ios" : "other",
  };
}

export const createLoonAdapter = createPluginAdapter;

export function handleLoonRequest(runtime: LoonRuntime, argument?: unknown): void {
  const rt = configuredRuntime(runtime, argument);
  if (!compatible(runtime)) {
    incompatibleNotification(rt);
    // Even an unsupported host must not send settings data to the gateway.
    if (isLocalSettings(runtime)) rt.finishRequest({ decision: "respond", response: settingsErrorResponse(503, "RUNTIME_INCOMPATIBLE") });
    else rt.finishRequest({ decision: "pass" });
    return;
  }
  handlePluginRequest(rt);
}

export function handleLoonResponse(runtime: LoonRuntime, argument?: unknown): void {
  if (!compatible(runtime)) { runtime.finishResponse({}); return; }
  handlePluginResponse(configuredRuntime(runtime, argument));
}

function incompatibleNotification(runtime: LoonRuntime): void {
  const now = Date.parse(runtime.nowIso);
  let lastByEvent: Record<string, number> = {};
  try { lastByEvent = JSON.parse(runtime.read(STORAGE_KEYS.notificationThrottle) ?? "{}").lastByEvent ?? {}; } catch { /* ignore corrupt throttle */ }
  if (now - (lastByEvent["runtime-incompatible"] ?? 0) < 10 * 60_000) return;
  runtime.notify(notificationFor("runtime-incompatible"));
  runtime.write(STORAGE_KEYS.notificationThrottle, JSON.stringify({ schemaVersion: 1, lastByEvent: { ...lastByEvent, "runtime-incompatible": now } }));
}

function compatible(runtime: LoonRuntime): boolean {
  const build = runtime.env().build;
  return build !== undefined && build >= MIN_LOON_BUILD;
}

function isLocalSettings(runtime: LoonRuntime): boolean {
  try {
    const url = new URL(runtime.request?.url ?? "");
    return url.hostname === "webvpn.swufe.edu.cn" && url.pathname.startsWith("/__swufe_bridge__");
  } catch { return false; }
}

function configuredRuntime(runtime: LoonRuntime, argument: unknown): LoonRuntime {
  const args = argument && typeof argument === "object" ? argument as LoonArguments : {};
  // Arguments override only runtime switches. Website configuration belongs to
  // the local page and is read anew for each request.
  const read = (key: string): string | null => {
    if (key !== STORAGE_KEYS.settingsV2) return runtime.read(key);
    const loaded = loadSettingsV2({ read: runtime.read, write: runtime.write });
    if (loaded.kind === "incompatible") return runtime.read(key);
    return JSON.stringify({ ...loaded.settings,
      ...(typeof args.enabled === "boolean" ? { enabled: args.enabled } : {}),
      ...(typeof args.debug === "boolean" ? { debug: args.debug } : {}),
    });
  };
  return {
    ...runtime, read, pageHtml: LOON_SETTINGS_PAGE_HTML,
    write: (key, value) => {
      // Keep independent event timestamps when shared orchestration updates a
      // single event, so alternating errors cannot bypass Loon's throttle.
      if (key === STORAGE_KEYS.notificationThrottle && value) {
        let previous: Record<string, number> = {};
        try { previous = JSON.parse(runtime.read(key) ?? "{}").lastByEvent ?? {}; } catch { /* ignore corrupt throttle */ }
        const next = JSON.parse(value) as { schemaVersion: number; lastByEvent: Record<string, number> };
        return runtime.write(key, JSON.stringify({ ...next, lastByEvent: { ...previous, ...next.lastByEvent } }));
      }
      return runtime.write(key, value);
    },
    settingsNonce: () => browserNonce(runtime),
    notificationGapMs: event => event === "login-required" || event === "session-expired" ? 30 * 60_000 : 10 * 60_000,
  };
}

function browserNonce(runtime: LoonRuntime): string | null {
  const request = runtime.request;
  if (!request || (request.method ?? "GET").toUpperCase() !== "GET") return null;
  const url = new URL(request.url);
  if (url.origin !== SETTINGS_ORIGIN || url.pathname !== "/__swufe_bridge__/api/settings") return null;
  const headers = request.headers ?? {};
  const origin = headerValue(headers, "origin");
  if (origin && origin !== SETTINGS_ORIGIN) return null;
  const referer = headerValue(headers, "referer");
  if (!referer) return null;
  try {
    const page = new URL(referer);
    if (page.origin !== SETTINGS_ORIGIN || page.pathname !== new URL(SETTINGS_PAGE_URL).pathname) return null;
  } catch { return null; }
  const nonce = headerValue(headers, "x-swufe-settings-bootstrap");
  return nonce && /^[0-9a-f]{32}$/.test(nonce) ? nonce : null;
}
