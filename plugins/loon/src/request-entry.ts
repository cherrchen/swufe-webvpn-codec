import { executeLoonHttp, type LoonGlobals } from "./runtime.ts";

declare const $request: LoonGlobals["request"];
declare const $argument: unknown;
declare const $loon: string;
declare const $persistentStore: LoonGlobals["store"];
declare const $notification: LoonGlobals["notification"];
declare const $done: LoonGlobals["done"];

executeLoonHttp("request", {
  request: typeof $request === "undefined" ? undefined : $request,
  argument: typeof $argument === "undefined" ? undefined : $argument,
  loon: typeof $loon === "undefined" ? "" : $loon,
  store: $persistentStore, notification: $notification, done: $done,
});
