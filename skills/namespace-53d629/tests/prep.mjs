// Some blocks import the quickstart/recipe files by name (`./namespace.js`, `./mint-clients.js`). The runner writes
// blocks as quickstart-1.ts, recipes-5.ts, ..., so this adds one-line re-export files that point at the right blocks
// (found by content, not number). Run before tsc and before the live checks.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const blocks = readdirSync("blocks").filter((f) => /\.tsx?$/.test(f)).sort().map((f) => ({ f, code: readFileSync(`blocks/${f}`, "utf8") }));
const find = (desc, test) => {
  const b = blocks.find((x) => test(x.code));
  if (!b) { console.error(`No block found for ${desc}: did the skill's code change shape?`); process.exit(1); }
  return b.f.replace(/\.tsx?$/, ".js");
};
const ns = find("namespace.ts (quickstart.md server client)", (c) => /export const client = createOffchainClient/.test(c));
const mint = find("mint-clients.ts (recipes.md)", (c) => /export const mintClient = createMintClient/.test(c));
writeFileSync("blocks/namespace.ts", `export * from "./${ns}";\n`);
writeFileSync("blocks/mint-clients.ts", `export * from "./${mint}";\n`);
console.log(`blocks/namespace.ts -> ${ns}, blocks/mint-clients.ts -> ${mint}`);
