import { SETTINGS_PAGE_URL } from "webvpn-core-js";
import { handleStatusTile, traceEntered, traceThrew } from "webvpn-plugin-runtime";
import { bindLoonRuntime, type LoonGlobals } from "./runtime.ts";

declare const $argument: unknown;
declare const $loon: string;
declare const $persistentStore: LoonGlobals["store"];
declare const $notification: LoonGlobals["notification"];
declare const $done: LoonGlobals["done"];

try {
  traceEntered("swufe-webvpn-loon-generic 0.1.1-m3", undefined);
  const runtime = bindLoonRuntime({
    loon: typeof $loon === "undefined" ? "" : $loon,
    store: $persistentStore, notification: $notification, done: () => undefined,
  });
  const login = typeof $argument !== "undefined" && $argument === "login";
  const status = handleStatusTile(runtime);
  $notification.post("SWUFE WebVPN", status.content, login ? "点击打开网页登录" : "点击管理网站设置", {
    openUrl: login ? "https://webvpn.swufe.edu.cn/" : SETTINGS_PAGE_URL,
  });
} catch (error) {
  traceThrew("swufe-webvpn-loon-generic", undefined, error);
}
$done({});
