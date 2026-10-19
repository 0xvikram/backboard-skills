// HyperIndex handler blocks only type-check inside an indexer project (codegen writes the per-project types for the
// `envio` module). So this script:
//  1. places each block that imports from "envio" into one of two real projects in app/ (picked by content, not by
//     block number): quickstart (Arc testnet Vault, references/quickstart.md) and recipes (multichain factory +
//     effects + wildcard + onBlock, references/recipes.md);
//  2. runs `envio codegen` (pinned envio 3.14.0, no Docker, no network) and strict `tsc --noEmit` in each;
//  3. type-checks the remaining blocks (GraphQL fetch client, HyperSync client) on their own.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const blocks = readdirSync("blocks").sort().map((f) => ({ f, code: readFileSync(`blocks/${f}`, "utf8") }));
const rules = [
  ["quickstart", "src/indexer.test.ts", (c) => c.includes("createTestIndexer") && c.includes("5042002")],
  ["quickstart", "src/handlers/Vault.ts", (c) => /contract: "Vault"/.test(c) && /event: "Withdraw"/.test(c)],
  // SKILL.md's short version of the same handler; kept outside handlers/ so the event is not registered twice.
  ["quickstart", "src/skill-md-handler.ts", (c) => /contract: "Vault", event: "Deposit"/.test(c) && !/Withdraw|VaultFactory/.test(c)],
  ["recipes", "src/effects.ts", (c) => c.includes("createEffect")],
  ["recipes", "src/handlers/Factory.ts", (c) => c.includes("VaultFactory")],
  ["recipes", "src/handlers/ERC20.ts", (c) => /contract: "ERC20"/.test(c)],
  ["recipes", "src/handlers/Blocks.ts", (c) => c.includes("indexer.onBlock")],
];
for (const app of ["quickstart", "recipes"]) { rmSync(`app/${app}/src/handlers`, { recursive: true, force: true }); mkdirSync(`app/${app}/src/handlers`, { recursive: true }); }
rmSync("blocks-plain", { recursive: true, force: true }); mkdirSync("blocks-plain");

let failed = false;
const used = new Set();
for (const [app, dest, match] of rules) {
  const b = blocks.find((x) => !used.has(x.f) && match(x.code));
  if (!b) { console.error(`✗ no block found for app/${app}/${dest}: did the skill's code change shape?`); failed = true; continue; }
  used.add(b.f);
  mkdirSync(dirname(`app/${app}/${dest}`), { recursive: true });
  copyFileSync(`blocks/${b.f}`, `app/${app}/${dest}`);
  console.log(`  ${b.f} -> app/${app}/${dest}`);
}
for (const b of blocks) {
  if (used.has(b.f)) continue;
  if (/from "envio"/.test(b.code)) { console.error(`✗ ${b.f} imports from "envio" but no project slot matches it; add a rule in typecheck.mjs`); failed = true; continue; }
  copyFileSync(`blocks/${b.f}`, `blocks-plain/${b.f}`);
  console.log(`  ${b.f} -> standalone tsc`);
}
if (failed) process.exit(1);

const bin = (n) => resolve("node_modules/.bin", n);
const run = (label, cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, ENVIO_API_TOKEN: "" } });
  if (r.status !== 0) { console.error(`✗ ${label} failed`); process.exit(1); }
  console.log(`✓ ${label}`);
};
for (const app of ["quickstart", "recipes"]) {
  run(`${app}: envio codegen`, bin("envio"), ["codegen"], `app/${app}`);
  run(`${app}: tsc --noEmit`, bin("tsc"), ["--noEmit", "-p", "."], `app/${app}`);
}
run("standalone blocks: tsc --noEmit", bin("tsc"), ["--noEmit", "-p", "."], ".");
