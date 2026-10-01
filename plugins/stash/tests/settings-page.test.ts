import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
import { handleSettingsRequest, memoryKv, STORAGE_KEYS } from "webvpn-core-js";
import { SETTINGS_PAGE_HTML } from "webvpn-plugin-runtime";
import { LOON_SETTINGS_PAGE_HTML } from "../../loon/src/settings-page.ts";

// Small DOM fake: verifies the bundled page's actual handlers and submitted payload.
class Element {
  hidden = false;
  disabled = false;
  textContent = "";
  value = "";
  checked = false;
  className = "";
  listeners: Record<string, () => unknown> = {};
  children: unknown[] = [];
  append(...children: unknown[]) { this.children.push(...children); }
  replaceChildren(...children: unknown[]) { this.children = children; }
  setAttribute() {}
  addEventListener(event: string, listener: () => unknown) { this.listeners[event] = listener; }
}

it.each([['Stash', SETTINGS_PAGE_HTML], ['Loon', LOON_SETTINGS_PAGE_HTML]])(
  "%s refreshes tokens and preserves edits across expiry, storage, validation and network failures", async (_host, html) => {
    const nodes: Record<string, Element> = {};
    const node = (id: string) => nodes[id] ??= new Element();
    const memory = memoryKv();
    let failWrite = false;
    const kv = { read: memory.read, write: (key: string, value: string | null) =>
      failWrite && key === STORAGE_KEYS.settingsV2 ? false : memory.write(key, value) };
    const deps = { kv, statusProvider: { getStatus: () => "logged-out" as const }, pageHtml: "" };
    let now = Date.parse("2026-10-02T00:00:00Z");
    let nonce = 0;
    let networkFailure = false;
    const posts: Array<{ token: string; body: string }> = [];
    const fetch = async (_url: string, options: { method?: string; headers?: Record<string, string>; body?: string }) => {
      if (networkFailure) throw new Error("offline");
      const method = options.method ?? "GET";
      if (method === "POST") posts.push({ token: options.headers?.['x-swufe-settings-token'] ?? '', body: options.body ?? '' });
      const response = handleSettingsRequest({ method, path: "/__swufe_bridge__/api/settings",
        nowIso: new Date(now).toISOString(), origin: "https://webvpn.swufe.edu.cn", contentType: "application/json",
        freshNonce: (++nonce).toString(16).padStart(32, "0"), token: options.headers?.['x-swufe-settings-token'], body: options.body }, deps);
      return { ok: response.status === 200, json: async () => JSON.parse(response.body) };
    };
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
    runInNewContext(script, {
      document: { getElementById: node, createElement: () => new Element(), createTextNode: (text: string) => text },
      fetch, location: { href: "" }, Uint8Array,
      crypto: { getRandomValues: (bytes: Uint8Array) => { bytes.fill(++nonce); return bytes; } },
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    // Initial token has expired while the user was editing.
    now += 180_000;
    node('host').value = "library.swufe.edu.cn";
    node('add').listeners.click?.();
    const builtinRow = node('builtin').children[0] as Element;
    const toggle = builtinRow.children[2] as Element;
    toggle.checked = false;
    toggle.listeners.change?.();
    const scheme = (node('custom').children[0] as Element).children[1] as Element;
    scheme.value = "https";
    scheme.listeners.change?.();
    failWrite = true;
    await node('save').listeners.click?.();
    expect(node('feedback').textContent).toBe("保存失败，请重试");
    expect(node('save').disabled).toBe(false);
    failWrite = false;
    networkFailure = true;
    await node('save').listeners.click?.();
    expect(node('feedback').textContent).toBe("保存失败，请重试");
    networkFailure = false;
    await node('save').listeners.click?.();
    expect(node('feedback').textContent).toBe("已保存");
    expect(posts).toHaveLength(2);
    expect(posts[0]?.token).not.toBe(posts[1]?.token);
    expect(posts[0]?.body).toBe(posts[1]?.body);
    expect(JSON.parse(kv.read(STORAGE_KEYS.settingsV2) ?? '{}')).toMatchObject({
      builtinSiteStates: { jwxt: false }, customHosts: ['library.swufe.edu.cn'], hostSchemes: { 'library.swufe.edu.cn': 'https' },
    });
    // Invalid edits consume a token. Correcting them must allow a fresh save.
    node('host').value = 'a'.repeat(70) + '.swufe.edu.cn';
    node('add').listeners.click?.();
    await node('save').listeners.click?.();
    expect(node('feedback').textContent).toBe("保存失败，请重试");
    const lastRow = node('custom').children.at(-1) as Element;
    (lastRow.children[2] as Element).listeners.click?.();
    await node('save').listeners.click?.();
    expect(node('feedback').textContent).toBe("已保存");
  },
);
