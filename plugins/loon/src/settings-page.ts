import { SETTINGS_PAGE_HTML } from "webvpn-plugin-runtime";

// Safari provides Web Crypto even when the host's JavaScriptCore does not.
// The nonce stays on the intercepted settings route; no external service is used.
export const LOON_SETTINGS_PAGE_HTML = SETTINGS_PAGE_HTML
  .replace("同一 Stash", "同一 Loon")
  .replace('const response = await fetch(api, { cache: "no-store" });', `
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  const response = await fetch(api, {
    cache: "no-store",
    headers: { "x-swufe-settings-bootstrap": nonce }
  });`);
