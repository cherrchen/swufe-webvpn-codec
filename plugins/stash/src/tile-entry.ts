import { handleStashTile, type StashRuntime } from "./adapter.ts";

declare const $persistentStore: { read(key: string): string | null; write(key: string, value: string): void };
declare function $done(value: Record<string, unknown>): void;

const tile = handleStashTile({
  nowIso: new Date().toISOString(),
  read: (key) => $persistentStore.read(key) || null,
  write: () => true,
  notify: () => undefined,
  debug: () => undefined,
  finishRequest: () => undefined,
  finishResponse: () => undefined,
  env: () => ({ host: "stash", version: "", platform: "ios" }),
} satisfies StashRuntime);

$done({ title: tile.title, content: tile.content, url: tile.url, icon: tile.icon });
