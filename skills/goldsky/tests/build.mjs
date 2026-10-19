// The Goldsky CLI (pinned 13.17.1, from npm) has no local build: generation runs on Goldsky's servers after login.
// What it can do without an account, and what this checks:
//  1. `goldsky subgraph init <name>/<version> --from-config goldsky-config.json` validates the skill's instant-subgraph
//     config (SKILL.md step 4 / quickstart.md, placeholders filled in) and writes the subgraph files locally.
//  2. errors.md #1: the same config with an uppercase ABI key ("Counter") fails with "Failed to locate ABIs".
//  3. errors.md #2: `subgraph deploy --from-abi` and `subgraph list` without login fail with the quoted messages.
// HOME is pointed at a throwaway folder so the CLI never sees or writes a real ~/.goldsky.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const home = resolve(".goldsky-home");
mkdirSync(home, { recursive: true });
for (const d of ["app/out", "app/out-upper"]) rmSync(d, { recursive: true, force: true }); // init refuses a non-empty target
const bin = resolve("node_modules/.bin/goldsky");
const strip = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
const gs = (args) => {
  const r = spawnSync(bin, args, { cwd: "app", encoding: "utf8", timeout: 120000, env: { ...process.env, HOME: home, GOLDSKY_CLI_TELEMETRY_DISABLED: "1", GOLDSKY_TOKEN: "" } });
  return { code: r.status, out: strip(`${r.stdout}${r.stderr}`) };
};
let failed = 0;
const ok = (m) => console.log(`  ✓ ${m}`), bad = (m, out = "") => { failed++; console.error(`  ✗ ${m}\n${out.slice(-800)}`); };

const v = gs(["--version"]);
v.out.trim() === "13.17.1" ? ok(`goldsky --version: ${v.out.trim()}`) : bad(`goldsky --version: expected 13.17.1`, v.out);

const init = gs(["subgraph", "init", "counter/1.0.0", "--from-config", "goldsky-config.json", "--target-path", "./out"]);
const written = "app/out/counter-subgraph.json";
if (init.code === 0 && init.out.includes("configuration valid") && existsSync(written) && existsSync("app/out/abis/counter.json")) {
  const sg = JSON.parse(readFileSync(written, "utf8"));
  const text = JSON.stringify(sg);
  text.includes("arc-testnet") && text.includes("0x1111111111111111111111111111111111111111") ? ok("init --from-config: config valid, counter-subgraph.json + abis/counter.json written (chain + address kept)") : bad("init wrote a subgraph file without the chain/address", text);
} else bad("init --from-config did not validate/write the files", init.out);

const cfg = JSON.parse(readFileSync("app/goldsky-config.json", "utf8"));
cfg.abis = { Counter: cfg.abis.counter }; cfg.instances[0].abi = "Counter";
writeFileSync("app/upper-config.json", JSON.stringify(cfg, null, 2));
const upper = gs(["subgraph", "init", "counter/1.0.0", "--from-config", "upper-config.json", "--target-path", "./out-upper"]);
upper.out.includes("Failed to locate ABIs") && !existsSync("app/out-upper/counter-subgraph.json")
  ? ok('uppercase ABI key: "Failed to locate ABIs" (errors.md #1 still true)')
  : bad("uppercase ABI key no longer fails: errors.md #1 and the 'keep ABI names lowercase' advice may be stale", upper.out);

const deploy = gs(["subgraph", "deploy", "counter/1.0.0", "--from-abi", "goldsky-config.json"]);
if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|fetch failed/.test(deploy.out)) { console.error("network: deploy could not reach Goldsky"); process.exit(75); }
deploy.out.includes("Make sure to run 'goldsky login'") ? ok("deploy without login: \"Make sure to run 'goldsky login'...\"") : bad("deploy without login: message changed (errors.md #2)", deploy.out);
const list = gs(["subgraph", "list"]);
if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|fetch failed/.test(list.out)) { console.error("network: list could not reach Goldsky"); process.exit(75); }
list.code !== 0 && list.out.includes("A valid API token is required") ? ok('subgraph list without login: "A valid API token is required"') : bad("subgraph list without login: message changed (errors.md #2)", list.out);

if (failed) { console.error(`${failed} build check(s) failed`); process.exit(1); }
console.log("build: all CLI checks passed");
