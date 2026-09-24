import { handleStashResponse, type StashRuntime } from "./adapter.ts";
import { traceThrew } from "./script-trace.ts";

declare const $request: StashRuntime["request"];
declare const $response: StashRuntime["response"];
declare const $persistentStore: { read(key: string): string | null; write(value: string, key: string): void };
declare const $notification: { post(title: string, subtitle?: string, body?: string, options?: { url?: string }): void };
declare const $environment: { system?: string; version?: string } | undefined;
declare function $done(value: Record<string, unknown>): void;

const requestUrl = typeof $request === "undefined" ? undefined : $request?.url;
try {
  handleStashResponse(bindResponseRuntime());
} catch (error) {
  traceThrew("swufe-webvpn-response", requestUrl, error);
  $done({});
}

function bindResponseRuntime(): StashRuntime {
  return {
    nowIso: new Date().toISOString(),
    request: typeof $request === "undefined" ? undefined : $request,
    response: typeof $response === "undefined" ? undefined : $response,
    read: (key) => $persistentStore.read(key) || null,
    write: (key, value) => {
      $persistentStore.write(value ?? "", key);
      return true;
    },
    notify: (input) => {
      $notification.post(input.title, "", input.body, input.openUrl ? { url: input.openUrl } : undefined);
    },
    debug: (record) => {
      console.log(JSON.stringify(record));
    },
    finishRequest: () => $done({}),
    finishResponse: (result) => {
      if (result.status === undefined && result.headers === undefined && result.body === undefined) {
        $done({});
        return;
      }
      $done({
        status: result.status,
        headers: result.headers,
        body: typeof result.body === "string" ? result.body : result.body ? bytesToString(result.body) : "",
      });
    },
    env: () => ({
      host: "stash",
      version: $environment?.version ?? "",
      platform: $environment?.system === "macOS" ? "macos" : "ios",
    }),
  };
}

function bytesToString(body: Uint8Array): string {
  return new TextDecoder().decode(body);
}
