import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { defaultSettingsV2, STORAGE_KEYS } from "webvpn-core-js";

it("omits a binary PDF body when only Cookie attributes change", async () => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL("../src/response-entry.ts", import.meta.url))],
    bundle: true, format: "iife", platform: "browser", write: false,
  });
  const store: Record<string, string> = {
    [STORAGE_KEYS.settingsV2]: JSON.stringify(defaultSettingsV2()),
    [STORAGE_KEYS.session]: JSON.stringify({ schemaVersion: 1, gatewayHost: "webvpn.swufe.edu.cn", cookieHeader: "route=STUB", capturedAt: "2026-10-01T00:00:00Z", lastConfirmedAt: null, expiresAt: null, status: "valid" }),
  };
  const done: Array<Record<string, unknown>> = [];
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0xff, 0x80]);
  runInNewContext(bundle.outputFiles[0]?.text ?? "", {
    $request: { url: "http://jwxt.swufe.edu.cn/file.pdf", method: "GET", headers: {} },
    $response: { status: 200, headers: { "content-type": "application/pdf", "set-cookie": "app=STUB; Domain=webvpn.swufe.edu.cn; Path=/" }, body: bytes },
    $persistentStore: { read: (key: string) => store[key] ?? null, write: (value: string, key: string) => { store[key] = value; return true; } },
    $notification: { post: () => undefined },
    $environment: { system: "iOS", version: "test" },
    $done: (value: Record<string, unknown>) => done.push(value),
    console: { log: () => undefined }, URL, TextEncoder, TextDecoder, Uint8Array,
  });
  expect(done).toHaveLength(1);
  expect(done[0]?.headers).toMatchObject({ "set-cookie": "app=STUB; domain=jwxt.swufe.edu.cn; path=/" });
  expect(done[0]).not.toHaveProperty("body");
  expect(Array.from(bytes)).toEqual([0x25, 0x50, 0x44, 0x46, 0xff, 0x80]);
});
