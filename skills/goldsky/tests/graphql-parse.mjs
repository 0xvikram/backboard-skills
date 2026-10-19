// Syntax-checks every GraphQL document embedded in the skill's TS blocks (graphql.parse; there is no live schema).
import { readdirSync, readFileSync } from "node:fs";
import { parse } from "graphql";

let docs = 0, bad = 0;
for (const f of readdirSync("blocks").sort()) {
  const code = readFileSync(`blocks/${f}`, "utf8");
  const found = [...code.matchAll(/`([^`]*)`/g)].map((m) => m[1].trim()).filter((s) => /^(query\b|\{)/.test(s) && !s.includes("${"));
  found.push(...[...code.matchAll(/query:\s*"([^"]+)"/g)].map((m) => m[1]));
  for (const d of found) { try { parse(d); docs++; } catch (e) { bad++; console.error(`${f}: ${e.message}`); } }
}
console.log(`graphql.parse: ${docs} documents parsed${bad ? `, ${bad} failed` : ""}`);
if (bad || docs < 4) process.exit(1);
