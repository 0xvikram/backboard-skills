// Recipes import the quickstart's files by name (`./onramp-url.ts`, `./onramp-api.ts`). The runner writes blocks as
// quickstart-1.ts, recipes-5.ts, ..., so this adds two one-line re-export files that point at the right blocks
// (found by content, not number). Run before tsc and before the unit tests.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const blocks = readdirSync("blocks").filter((f) => /\.(ts|tsx)$/.test(f)).sort().map((f) => ({ f, code: readFileSync(`blocks/${f}`, "utf8") }));
const find = (desc, test) => {
  const b = blocks.find((x) => test(x.code));
  if (!b) { console.error(`No block found for ${desc}: did the skill's code change shape?`); process.exit(1); }
  return b.f;
};
const url = find("onramp-url.ts (quickstart.md step 3)", (c) => /export function buildOnrampUrl/.test(c) && /export interface OnrampUrlParams/.test(c));
const api = find("onramp-api.ts (recipes.md)", (c) => /export function signOnrampRequest/.test(c) && /export function verifyOnrampWebhook/.test(c));
writeFileSync("blocks/onramp-url.ts", `export * from "./${url}";\n`);
writeFileSync("blocks/onramp-api.ts", `export * from "./${api}";\n`);
console.log(`blocks/onramp-url.ts -> ${url}, blocks/onramp-api.ts -> ${api}`);
