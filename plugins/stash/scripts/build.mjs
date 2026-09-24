import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdir } from "node:fs/promises";

const commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
const banner = `/* swufe-webvpn stash ${commit} */`;

await mkdir("dist", { recursive: true });

for (const name of ["request", "response", "tile"]) {
  await build({
    entryPoints: [`src/${name}-entry.ts`],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    outfile: `dist/${name}.js`,
    banner: { js: banner },
    legalComments: "none",
  });
}
