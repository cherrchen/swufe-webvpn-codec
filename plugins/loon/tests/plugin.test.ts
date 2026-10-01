import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const plugin = readFileSync("swufe-webvpn.plugin", "utf8");
const lines = plugin.split("\n").filter(line => /^(request|response|generic) /.test(line));

it("uses new Script syntax, typed arguments and mandatory response URL guards", () => {
  expect(plugin).toContain("#!loon_version = 3.5.1(983)");
  expect(lines).toHaveLength(7);
  expect(plugin).not.toMatch(/http-request |http-response |script-path=|requires-body=|img-url=/);
  for (const line of lines) {
    expect(line).toContain('then script("https://raw.githubusercontent.com/cherrchen/swufe-webvpn-codec/main/plugins/loon/dist/');
    if (line.startsWith("response")) expect(line).toContain("${url} ~= /");
    if (!line.startsWith("generic")) expect(line).toContain("{${enabled}, ${debug}}");
  }
});

it("routes settings before business and leaves the body of ordinary requests unread", () => {
  expect(lines[0]).toContain("__swufe_bridge__");
  expect(lines[0]).toContain("requires_body=true");
  expect(lines[1]).toContain("requires_body=false");
  expect(lines[1]).not.toContain("enable=${enabled}");
  // Settings remains intercepted even when forwarding is switched off.
  expect(plugin).not.toContain("enable=${enabled}");
});

it("matches exact SWUFE authorities, including HTTP/80, and excludes suffix lookalikes", () => {
  const pattern = /\$\{url\} ~= (\/.+?\/i) then/.exec(lines[1]!)?.[1];
  expect(pattern).toBeDefined();
  const regex = new RegExp(pattern!.slice(1, -2), "i");
  for (const url of ["http://jwxt.swufe.edu.cn/", "http://custom.swufe.edu.cn:80/", "https://webvpn.swufe.edu.cn/"]) expect(regex.test(url)).toBe(true);
  for (const url of ["https://jwxt.swufe.edu.cn.evil.example/", "https://evil.example/swufe.edu.cn/", "https://swufe.edu.cn@evil.example/"]) expect(regex.test(url)).toBe(false);
});

it("rejects only SWUFE QUIC and declares wildcard MitM for dynamic exact routing", () => {
  expect(plugin).toContain("AND,((DOMAIN-SUFFIX,swufe.edu.cn),(PROTOCOL,QUIC)),REJECT");
  expect(plugin).not.toMatch(/^PROTOCOL,QUIC,REJECT/m);
  expect(plugin).not.toContain("disable-udp-ports");
  expect(plugin).toContain("hostname = *.swufe.edu.cn");
  expect(lines[2]).toContain("authserver");
  expect(lines[2]).toContain("requires_body=false");
});
