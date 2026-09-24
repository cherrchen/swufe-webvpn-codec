import { readFileSync, readdirSync } from "node:fs";

const banned = [
  /require\s*\(\s*["']node:/,
  /require\s*\(\s*["'](?:fs|crypto|buffer)["']/,
  /node:/,
  /\bBuffer\b/,
  /from\s+["']fs["']/,
  /from\s+["']crypto["']/,
];
const files = readdirSync("dist").filter((name) => name.endsWith(".js"));
if (files.length < 3) {
  console.error("expected request.js, response.js, and tile.js");
  process.exit(1);
}
let failed = false;
for (const name of files) {
  const text = readFileSync(`dist/${name}`, "utf8");
  if (text.includes("import ") || text.includes("export ")) {
    console.error(`${name} still has an import or export`);
    failed = true;
  }
  for (const pattern of banned) {
    if (pattern.test(text)) {
      console.error(`${name} matched ${pattern}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log(`bundle scan ok: ${files.join(", ")}`);
