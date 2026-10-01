import { isSettingsNamespaceUrl, settingsErrorResponse, type HostRequestResult, type HostResponseResult } from "webvpn-core-js";
import { traceEntered, traceThrew } from "webvpn-plugin-runtime";
import { handleLoonRequest, handleLoonResponse, loonEnvironment, type LoonRuntime } from "./adapter.ts";

export interface LoonGlobals {
  request?: LoonRuntime["request"];
  response?: LoonRuntime["response"];
  argument?: unknown;
  loon: string;
  store: { read(key: string): string | null; write(value: string | undefined, key: string): boolean };
  notification: { post(title: string, subtitle: string, content: string, attach?: { openUrl: string }): void };
  done(value: Record<string, unknown>): void;
}

export function bindLoonRuntime(globals: LoonGlobals): LoonRuntime {
  return {
    nowIso: new Date().toISOString(), request: globals.request, response: globals.response,
    read: key => globals.store.read(key) || null,
    write: (key, value) => globals.store.write(value === null ? undefined : value, key),
    notify: input => globals.notification.post(input.title, "", input.body, input.openUrl ? { openUrl: input.openUrl } : undefined),
    debug: record => console.log(JSON.stringify(record)),
    finishRequest: result => globals.done(requestOutput(result)),
    finishResponse: result => globals.done(responseOutput(result)),
    env: () => loonEnvironment(globals.loon),
  };
}

export function executeLoonHttp(kind: "request" | "response", globals: LoonGlobals): void {
  let finished = false;
  const done = (value: Record<string, unknown>) => {
    if (finished) return;
    finished = true;
    globals.done(value);
  };
  try {
    traceEntered(`swufe-webvpn-loon-${kind} 0.1.1-m3`, globals.request?.url);
    const runtime = bindLoonRuntime({ ...globals, done });
    if (kind === "request") handleLoonRequest(runtime, globals.argument);
    else handleLoonResponse(runtime, globals.argument);
  } catch (error) {
    traceThrew(`swufe-webvpn-loon-${kind}`, globals.request?.url, error);
    done(kind === "request" && globals.request?.url && isSettingsNamespaceUrl(globals.request.url)
      ? { response: settingsErrorResponse(500, "STORAGE_FAILED") } : {});
  }
}

function requestOutput(result: HostRequestResult): Record<string, unknown> {
  if (result.decision === "respond" && result.response) return { response: result.response };
  if (result.decision === "rewrite" && result.url) {
    // Loon retains an explicitly supplied Host when applying a URL rewrite.
    // Keep the upstream authority consistent with the gateway URL, including
    // a non-default port, without duplicating differently cased Host fields.
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(result.headers ?? {})) {
      if (key.toLowerCase() !== "host") headers[key] = value;
    }
    headers.Host = new URL(result.url).host;
    return { url: result.url, headers };
  }
  if (result.decision === "rewrite_headers" && result.headers) return { headers: result.headers };
  return {};
}

function responseOutput(result: HostResponseResult): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (result.status !== undefined) out.status = result.status;
  if (result.headers !== undefined) out.headers = result.headers;
  // Loon accepts Uint8Array. Do not decode binary payloads or clear an omitted body.
  if (result.body !== undefined) out.body = result.body;
  return out;
}
