// The recipes import two other recipes by file name: "./networks.js" (recipes.md §1) and "./alchemy-rpc.js" (§2).
// Save those two blocks under those names in blocks/, exactly as the skill tells users to, so the imports resolve
// for tsc and tsx. The blocks are found by their first-line comment, not by number.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

for (const name of ["networks", "alchemy-rpc"]) {
  const hit = readdirSync("blocks").find((f) => readFileSync(`blocks/${f}`, "utf8").startsWith(`// ${name}.ts`));
  if (!hit) { console.error(`prep: no block starting with "// ${name}.ts" in the skill`); process.exit(1); }
  writeFileSync(`blocks/${name}.ts`, readFileSync(`blocks/${hit}`, "utf8"));
}
