export const DEFAULT_HOSTS = ["jwxt.swufe.edu.cn"] as const;
export const EXCLUDED_HOSTS = ["webvpn.swufe.edu.cn", "authserver.swufe.edu.cn"] as const;
export const GATEWAY_HOST = "webvpn.swufe.edu.cn";
export const AUTH_HOST = "authserver.swufe.edu.cn";

const MAX_HOST_LENGTH = 253;
const LABEL_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const BANNED = new Set([":", "/", " ", "\t", "*", "?", "#", "@"]);

export interface RoutingPolicy {
  exactHosts: string[];
  includeSwufeWildcard: boolean;
  excludedHosts: string[];
}

export type RouteDecision =
  | { kind: "gateway" }
  | { kind: "auth" }
  | { kind: "rewrite"; originalHost: string }
  | { kind: "pass" }
  | { kind: "invalid"; reason: string };

export function defaultRoutingPolicy(): RoutingPolicy {
  return {
    exactHosts: [...DEFAULT_HOSTS],
    includeSwufeWildcard: false,
    excludedHosts: [...EXCLUDED_HOSTS],
  };
}

export function normalizeHost(host: string): string {
  if (typeof host !== "string") {
    throw new Error("INVALID_HOST");
  }
  const candidate = host.trim().toLowerCase().replace(/\.+$/, "");
  if (!candidate) {
    throw new Error("INVALID_HOST");
  }
  if ([...candidate].some((char) => BANNED.has(char)) || candidate.length > MAX_HOST_LENGTH) {
    throw new Error("INVALID_HOST");
  }
  for (const label of candidate.split(".")) {
    if (!label || label.length > 63 || !LABEL_RE.test(label)) {
      throw new Error("INVALID_HOST");
    }
  }
  return candidate;
}

export function tryNormalizeHost(host: string): string | null {
  try {
    return normalizeHost(host);
  } catch {
    return null;
  }
}

export function decideRoute(host: string, policy: RoutingPolicy): RouteDecision {
  const candidate = tryNormalizeHost(host);
  if (candidate === null) {
    return { kind: "invalid", reason: "invalid-host" };
  }
  if (candidate === GATEWAY_HOST) {
    return { kind: "gateway" };
  }
  if (candidate === AUTH_HOST || isExcluded(candidate, policy.excludedHosts)) {
    return candidate === AUTH_HOST ? { kind: "auth" } : { kind: "pass" };
  }
  const exact = policy.exactHosts
    .map((item) => tryNormalizeHost(item))
    .filter((item): item is string => item !== null);
  if (exact.includes(candidate)) {
    return { kind: "rewrite", originalHost: candidate };
  }
  if (
    policy.includeSwufeWildcard &&
    (candidate === "swufe.edu.cn" || candidate.endsWith(".swufe.edu.cn"))
  ) {
    return { kind: "rewrite", originalHost: candidate };
  }
  return { kind: "pass" };
}

function isExcluded(host: string, excluded: string[]): boolean {
  return excluded.some((entry) => tryNormalizeHost(entry) === host);
}
