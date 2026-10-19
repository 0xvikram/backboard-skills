// --full checks for the envio skill (no Docker, no token). Run after typecheck, which placed the blocks and ran codegen.
//  1. vitest in app/quickstart: the skill's own test block (simulate 2 deposits + 1 withdraw -> balance 120n, count 2).
//     vitest in app/recipes: a simulated mint through the wildcard ERC20 handler with its `where` filter.
//  2. chains.md table, straight from envio 3.14.0: each sponsor chain ID with no `rpc:` either codegens (HyperSync built
//     in) or fails with errors.md #2 "Failed to automatically find HyperSync endpoint".
//  3. errors.md #3: V2 config keys (`rpc_config:`, `networks:`, `id: arc`) are rejected with the quoted messages.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

let failed = 0;
const ok = (m) => console.log(`  ✓ ${m}`), bad = (m, out = "") => { failed++; console.error(`  ✗ ${m}\n${out.slice(-1000)}`); };
const bin = (n) => resolve("node_modules/.bin", n);
const env = { ...process.env, ENVIO_API_TOKEN: "", CI: "1" };

console.log("Simulate tests (vitest)");
for (const app of ["quickstart", "recipes"]) {
  const r = spawnSync(bin("vitest"), ["run", "--test-timeout=60000"], { cwd: `app/${app}`, encoding: "utf8", env, timeout: 240000 });
  const out = `${r.stdout}${r.stderr}`;
  r.status === 0 && /passed/.test(out) ? ok(`app/${app}: ${(out.match(/Tests\s+[^\n]*/) || [""])[0].replace(/\x1b\[[0-9;]*m/g, "").trim()}`) : bad(`app/${app}: vitest failed`, out);
}

const codegen = (name, yaml) => {
  const dir = resolve("build-tmp", name);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/config.yaml`, yaml);
  writeFileSync(`${dir}/schema.graphql`, "type Ping {\n  id: ID!\n}\n");
  const r = spawnSync(bin("envio"), ["codegen"], { cwd: dir, encoding: "utf8", env, timeout: 120000 });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};
const contract = `contracts:\n  - name: Vault\n    events:\n      - event: Deposit(address indexed user, uint256 amount)\n`;
const chainCfg = (idLine, extra = "") => `name: probe\n${contract}chains:\n  - ${idLine}\n    start_block: 0\n${extra}    contracts:\n      - name: Vault\n        address: "0x0000000000000000000000000000000000000001"\n`;

console.log("HyperSync built in vs RPC only (chains.md)");
const HYPERSYNC = [130, 480, 5042, 5042002], RPC_ONLY = [1301, 4801, 295, 296, 16661, 16602, 1875, 1874];
for (const id of [...HYPERSYNC, ...RPC_ONLY]) {
  const r = codegen(`chain-${id}`, chainCfg(`id: ${id}`));
  const noHs = r.out.includes(`Failed to automatically find HyperSync endpoint for the chain ${id}`);
  if (HYPERSYNC.includes(id)) r.code === 0 ? ok(`${id}: HyperSync built in`) : bad(`${id}: chains.md says HyperSync, but codegen failed`, r.out);
  else r.code !== 0 && noHs ? ok(`${id}: RPC only ("Failed to automatically find HyperSync endpoint")`) : bad(`${id}: chains.md says RPC only, but codegen ${r.code === 0 ? "succeeded (HyperSync may have been added: update chains.md)" : "failed differently"}`, r.out);
}
const rpc = codegen("chain-296-rpc", chainCfg("id: 296", "    rpc: https://testnet.hashio.io/api\n"));
rpc.code === 0 ? ok("296 with rpc: codegen passes (the errors.md #2 fix)") : bad("296 with rpc: codegen failed", rpc.out);

console.log("V2 config on V3 (errors.md #3)");
const v2 = [
  ["rpc_config", chainCfg("id: 296", "    rpc_config:\n      url: https://testnet.hashio.io/api\n"), "unknown field `rpc_config`"],
  ["networks", `name: probe\n${contract}networks:\n  - id: 130\n    start_block: 0\n    contracts:\n      - name: Vault\n        address: "0x0000000000000000000000000000000000000001"\n`, "missing field `chains`"],
  ["id: arc", chainCfg("id: arc"), 'invalid type: string "arc"'],
];
for (const [label, yaml, expected] of v2) {
  const r = codegen(`v2-${label.replace(/\W+/g, "-")}`, yaml);
  r.code !== 0 && r.out.includes(expected) ? ok(`${label}: rejected with "${expected}"`) : bad(`${label}: expected codegen to fail with "${expected}"`, r.out);
}

rmSync("build-tmp", { recursive: true, force: true });
if (failed) { console.error(`${failed} build check(s) failed`); process.exit(1); }
console.log("build: all checks passed");
