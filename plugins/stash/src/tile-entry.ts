import { handleStashTile, type StashRuntime } from "./adapter.ts";
import { traceEntered, traceThrew } from "./script-trace.ts";

declare const $persistentStore: { read(key: string): string | null; write(key: string, value: string): void };
declare function $done(value: Record<string, unknown>): void;

try {
  traceEntered("swufe-webvpn-tile", undefined);
  const tile = handleStashTile(bindTileRuntime());
  console.log(JSON.stringify({ direction: "system", action: "entered", detail: `swufe-webvpn-tile trace=1 content=${tile.content} session=${tile.sessionState}` }));
  $done({ title: tile.title, content: tile.content, url: tile.url, icon: tile.icon });
} catch (error) {
  traceThrew("swufe-webvpn-tile", undefined, error);
  $done({ title: "SWUFE WebVPN", content: "脚本异常", url: "https://webvpn.swufe.edu.cn" });
}

function bindTileRuntime(): StashRuntime {
  return {
    nowIso: new Date().toISOString(),
    read: (key) => $persistentStore.read(key) || null,
    write: () => true,
    notify: () => undefined,
    debug: () => undefined,
    finishRequest: () => undefined,
    finishResponse: () => undefined,
    env: () => ({ host: "stash", version: "", platform: "ios" }),
  };
}
