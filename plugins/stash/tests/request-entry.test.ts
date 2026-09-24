import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { STORAGE_KEYS } from "webvpn-core-js";

it("returns a synthetic redirect for a jwxt document navigation", async () => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL("../src/request-entry.ts", import.meta.url))],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    write: false,
  });
  const store: Record<string, string> = {
    [STORAGE_KEYS.session]: JSON.stringify({
      schemaVersion: 1,
      gatewayHost: "webvpn.swufe.edu.cn",
      cookieHeader: "route=fake",
      capturedAt: "2026-09-24T08:00:00.000Z",
      lastConfirmedAt: null,
      status: "captured",
    }),
  };
  const done: Array<Record<string, unknown>> = [];
  runInNewContext(bundle.outputFiles[0]?.text ?? "", {
    $request: { url: "http://jwxt.swufe.edu.cn/", method: "GET", headers: { accept: "text/html" } },
    $persistentStore: {
      read: (key: string) => store[key] ?? null,
      write: (value: string, key: string) => { store[key] = value; },
    },
    $notification: { post: () => undefined },
    $environment: { system: "iOS", version: "test" },
    $done: (value: Record<string, unknown>) => done.push(value),
    console: { log: () => undefined },
    URL,
    TextEncoder,
    TextDecoder,
    Uint8Array,
  });
  expect(done).toHaveLength(1);
  expect(done[0]).toMatchObject({ response: { status: 302, headers: { "cache-control": "no-store" } } });
  const response = done[0]?.response as { headers: { location: string } };
  expect(response.headers.location).toMatch(/^https:\/\/webvpn\.swufe\.edu\.cn\/http\//);
});
