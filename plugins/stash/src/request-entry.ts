import { handleStashRequest, type StashRuntime } from "./adapter.ts";

declare const $request: StashRuntime["request"];
declare const $persistentStore: { read(key: string): string | null; write(key: string, value: string): void };
declare const $notification: { post(title: string, subtitle?: string, body?: string, options?: { url?: string }): void };
declare const $environment: { system?: string; version?: string } | undefined;
declare function $done(value: Record<string, unknown>): void;

handleStashRequest(bindRuntime());

function bindRuntime(): StashRuntime {
  return {
    nowIso: new Date().toISOString(),
    request: typeof $request === "undefined" ? undefined : $request,
    read: (key) => $persistentStore.read(key) || null,
    write: (key, value) => {
      $persistentStore.write(key, value ?? "");
      return true;
    },
    notify: (input) => {
      $notification.post(input.title, "", input.body, input.openUrl ? { url: input.openUrl } : undefined);
    },
    debug: (record) => {
      console.log(JSON.stringify(record));
    },
    finishRequest: (result) => {
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
