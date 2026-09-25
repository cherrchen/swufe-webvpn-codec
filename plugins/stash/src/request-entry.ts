import { handleStashRequest, nativeGatewayRedirect, type StashRuntime } from "./adapter.ts";
import { traceEntered, traceThrew } from "./script-trace.ts";

declare const $request: StashRuntime["request"];
declare const $persistentStore: { read(key: string): string | null; write(value: string, key: string): void };
declare const $notification: { post(title: string, subtitle?: string, body?: string, options?: { url?: string }): void };
declare const $environment: { system?: string; version?: string } | undefined;
declare function $done(value: Record<string, unknown>): void;

const requestUrl = typeof $request === "undefined" ? undefined : $request?.url;
try {
  traceEntered("swufe-webvpn-request", requestUrl);
  handleStashRequest(bindRuntime());
} catch (error) {
  traceThrew("swufe-webvpn-request", requestUrl, error);
  $done({});
}

function bindRuntime(): StashRuntime {
  return {
    nowIso: new Date().toISOString(),
    request: typeof $request === "undefined" ? undefined : $request,
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
    finishRequest: (result) => {
      if (result.decision === "respond" && result.response) {
        $done({ response: result.response });
        return;
      }
      const nativeUrl = nativeGatewayRedirect(typeof $request === "undefined" ? undefined : $request, result);
      if (nativeUrl) {
        $done({ response: { status: 302, headers: { location: nativeUrl, "cache-control": "no-store" } } });
        return;
      }
      if (result.decision === "rewrite" && result.url) {
        $done({ url: result.url, headers: result.headers ?? {} });
        return;
      }
      $done({});
    },
    finishResponse: () => $done({}),
    env: () => ({
      host: "stash",
      version: $environment?.version ?? "",
      platform: $environment?.system === "macOS" ? "macos" : "ios",
    }),
  };
}
