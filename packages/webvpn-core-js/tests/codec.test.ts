import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CodecError, WrdCodec } from "../src/index.ts";

const vectors = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "vectors/wrd-codec.json"), "utf8"),
) as {
  sampleHostToken: string;
  cases: Array<Record<string, string>>;
};

describe("IOS-TC-A shared vectors", () => {
  const codec = new WrdCodec();

  it("A02 captured token matches Python", () => {
    expect(codec.encryptHost("authserver.swufe.edu.cn")).toBe(vectors.sampleHostToken);
  });

  it("A09 every committed vector matches", () => {
    for (const item of vectors.cases) {
      if (item.op === "encryptHost") {
        expect(codec.encryptHost(item.input ?? ""), item.id).toBe(item.output);
      } else if (item.op === "encode" && item.output) {
        expect(codec.encodeUrl(item.input ?? ""), item.id).toBe(item.output);
      } else if (item.op === "decode" && item.output) {
        expect(codec.decodeUrl(item.input ?? ""), item.id).toBe(item.output);
      } else if (item.op === "encode" && item.error) {
        expect(() => codec.encodeUrl(item.input ?? ""), item.id).toThrow(CodecError);
      } else if (item.op === "decode" && item.error) {
        expect(() => codec.decodeUrl(item.input ?? ""), item.id).toThrow(CodecError);
      } else if (item.op === "decryptHost") {
        expect(() => codec.decryptHost(item.input ?? ""), item.id).toThrow(CodecError);
      } else if (item.op === "construct") {
        expect(() => new WrdCodec(item.key, item.iv), item.id).toThrow(CodecError);
      }
    }
  });

  it("A07 A08 error codes stay free of key material", () => {
    expect(() => new WrdCodec("short")).toThrowError(/INVALID_KEY/);
    try {
      new WrdCodec().decryptHost("zzzz");
    } catch (error) {
      expect(error).toBeInstanceOf(CodecError);
      expect(String(error)).not.toContain("wrdvpnisthebest");
    }
  });
});
