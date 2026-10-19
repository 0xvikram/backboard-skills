// Builds two real subgraphs from the skill's own AssemblyScript blocks with the pinned Graph CLI (no graph-node, no deploy):
//   app/quickstart  references/quickstart.md: manifest + schema + ABI (copied verbatim) + the mapping block
//                   -> graph codegen && graph build
//   app/recipes     recipes 2 + 3: the balances/Token mapping block with the TransferPoint lines from the recipe 3
//                   block spliced into the handler, recipe 2 + 3 schema
//                   -> graph codegen && graph build --network arc-testnet (recipe 4: networks.json rewrites the manifest)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { all, isMapping } from "./blocks-lib.mjs";

const maps = all().filter(isMapping);
const pick = (desc, fn) => { const b = maps.find(fn); if (!b) { console.error(`No mapping block found for ${desc}`); process.exit(1); } console.log(`${desc}: blocks/${b.file}`); return b.code; };
const quick = pick("quickstart mapping", (b) => /export function handleTransfer/.test(b.code) && !/Token/.test(b.code));
const recipe2 = pick("recipe 2 mapping", (b) => /export function handleTransfer/.test(b.code) && /try_totalSupply/.test(b.code));
const recipe3 = pick("recipe 3 fragment", (b) => /new TransferPoint/.test(b.code));

// Recipe 3 is "add this to the handler": its import goes on top, its body lines go at the end of handleTransfer.
const r3 = recipe3.split("\n"), r3imports = r3.filter((l) => l.startsWith("import ")), r3body = r3.filter((l) => l.trim() && !l.startsWith("import ") && !l.startsWith("//"));
const end = recipe2.lastIndexOf("}");
const combined = `${r3imports.join("\n")}\n${recipe2.slice(0, end)}\n${r3body.map((l) => `  ${l}`).join("\n")}\n}\n`;

const sh = (cwd, args) => {
  console.log(`$ (${cwd}) graph ${args.join(" ")}`);
  const r = spawnSync("npx", ["graph", ...args], { cwd, stdio: "inherit", env: { ...process.env, CI: "1" } });
  if (r.status !== 0) { console.error(`graph ${args.join(" ")} failed in ${cwd}`); process.exit(1); }
};

mkdirSync("app/quickstart/src", { recursive: true });
writeFileSync("app/quickstart/src/weth.ts", quick);
sh("app/quickstart", ["codegen"]);
sh("app/quickstart", ["build"]);

mkdirSync("app/recipes/src", { recursive: true });
writeFileSync("app/recipes/src/weth.ts", combined);
sh("app/recipes", ["codegen"]);
sh("app/recipes", ["build", "--network", "arc-testnet"]);
const manifest = readFileSync("app/recipes/subgraph.yaml", "utf8");
if (!/network:\s*arc-testnet/.test(manifest) || !manifest.includes("0x0000000000000000000000000000000000000001")) {
  console.error("graph build --network arc-testnet did not rewrite network/address in subgraph.yaml as recipe 4 says"); process.exit(1);
}
console.log("Both subgraphs built; --network rewrote subgraph.yaml as documented.");
