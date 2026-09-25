import { isSettingsNamespaceUrl } from "../runtime/settings-v2.ts";

export type GatewayRequestKind = "settings" | "wrapped-resource" | "gateway-root" | "gateway-owned" | "login" | "logout" | "unknown";

/** Only observed namespaces are classified. Unknown authentication endpoints remain closed to injection. */
export function classifyGatewayRequest(url: string): GatewayRequestKind {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return "unknown"; }
  if (isSettingsNamespaceUrl(url)) return "settings";
  const path = parsed.pathname;
  if (path === "/login" || path.startsWith("/login/")) return "login";
  if (path === "/logout") return "logout";
  if (path === "/" && !parsed.search) return "gateway-root";
  if (/^\/(?:https?(?:-\d+)?)\/[^/]+(?:\/|$)/.test(path)) return "wrapped-resource";
  if (path === "/wengine-vpn" || path.startsWith("/wengine-vpn/")) return "gateway-owned";
  return "unknown";
}

export function gatewayRequestAllowsInjection(kind: GatewayRequestKind): boolean {
  // Gateway-owned endpoints may contain logout or login actions. Their exact
  // path inventory is not established by device evidence yet.
  return kind === "wrapped-resource" || kind === "gateway-root";
}
