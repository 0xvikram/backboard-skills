// 1. tsc (strict) over every app-side TS/TSX block. Mapping blocks are AssemblyScript and are compiled by `graph build`
//    in build.mjs instead (they would not type-check as TypeScript).
// 2. graphql.parse over every GraphQL document embedded in the blocks (syntax only; there is no live schema).
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parse } from "graphql";
import { all, isMapping } from "./blocks-lib.mjs";

const blocks = all(), mappings = blocks.filter(isMapping), app = blocks.filter((b) => !isMapping(b));
console.log(`${app.length} app blocks for tsc, ${mappings.length} AssemblyScript mapping blocks (checked by graph build)`);
if (mappings.length < 2 || app.length < 5) { console.error("Expected at least 2 mapping blocks and 5 app blocks: did the skill's code fences change?"); process.exit(1); }

writeFileSync("tsconfig.gen.json", JSON.stringify({ extends: "./tsconfig.json", include: ["globals.d.ts", ...app.map((b) => `blocks/${b.file}`)] }, null, 2));
const r = spawnSync("npx", ["tsc", "-p", "tsconfig.gen.json"], { stdio: "inherit" });
if (r.status !== 0) process.exit(1);
console.log("tsc: OK");

let docs = 0, bad = 0;
for (const b of app) {
  for (const m of b.code.matchAll(/`([^`]*)`/g)) {
    const s = m[1].trim();
    if (!/^(query\b|\{)/.test(s) || s.includes("${")) continue;
    try { parse(s); docs++; } catch (e) { bad++; console.error(`${b.file}: GraphQL syntax error: ${e.message}`); }
  }
  for (const m of b.code.matchAll(/query:\s*"([^"]+)"/g)) { try { parse(m[1]); docs++; } catch (e) { bad++; console.error(`${b.file}: ${e.message}`); } }
}
console.log(`graphql.parse: ${docs} documents parsed${bad ? `, ${bad} failed` : ""}`);
if (bad || docs < 5) process.exit(1);
