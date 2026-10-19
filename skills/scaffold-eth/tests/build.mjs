// --full: build a real project the way the skill tells people to.
//   1. `create-eth@2.0.23 se-app -s hardhat` with its own `yarn install` (Yarn 4.13 via the project's yarnPath; the
//      yarn on PATH is this folder's yarn@1.22.22 devDependency, so no global install or corepack is needed).
//   2. Hardhat: recipe 4c networks added to hardhat.config.ts, recipe 2 deploy script in deploy/, `yarn compile`,
//      `yarn chain` + `yarn deploy` (regenerates deployedContracts.ts), `tsc` on the Hardhat
//      package (only the known rocketh TS2344 errors from errors.md 9 are allowed), and a `hardhat run` script that
//      connects to every network from recipe 4c and checks its chain ID (exit 75 if an RPC is unreachable).
//   3. Frontend variant A (hardhat + six sponsor testnets + Arc mainnet) and variant B (recipe 4a, WETH external):
//      `yarn next:build` (eslint + next build) and `yarn next:check-types` for each.
import { spawn } from "node:child_process";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import * as chains from "viem/chains";
import { join } from "node:path";
import { ENV, HERE, applyVariant, classify, run, scaffold, snapshotGenerated } from "./lib.mjs";

const t0 = Date.now(), b = classify();
const app = scaffold(join(HERE, ".se-full"), "se-app", { install: true });
const hh = join(app, "packages", "hardhat"), nx = join(app, "packages", "nextjs");
const failures = [];
let network = false;
const step = (label, fn) => {
  try { const m = fn(); console.log(`  ✓ ${label}${m ? `: ${m}` : ""}`); }
  catch (e) { console.log(`  ✗ ${label}: ${e.message}`); failures.push(label); }
};

// ---- Hardhat --------------------------------------------------------------------------------------------------------
const cfgPath = join(hh, "hardhat.config.ts");
let cfg = readFileSync(cfgPath, "utf8");
if (!/networks:\s*\{\n/.test(cfg)) throw new Error("hardhat.config.ts has no `networks: {` block");
cfg = cfg.replace(/networks:\s*\{\n/, (m) => `${m}${b.hhNetworks.text.trimEnd()}\n`);
writeFileSync(cfgPath, cfg);
writeFileSync(join(hh, "deploy", "00_deploy_your_contract.ts"), b.deploy.text);
const hhNames = [...b.hhNetworks.text.matchAll(/^\s*(\w+):\s*\{\s*type:/gm)].map((m) => m[1]);

step("yarn compile", () => `${run("yarn", ["compile"], app, { capture: true }).secs}s`);
// `yarn chain` + `yarn deploy`, as SKILL.md steps 3 and 4 say. (`--network hardhat` deploys to a throwaway in-process
// chain and generateTsAbis then refuses to write deployedContracts.ts, so a real local node is needed.)
const rpcUp = async (port) => {
  try {
    const r = await fetch(`http://127.0.0.1:${port}`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}', signal: AbortSignal.timeout(2000) });
    return (await r.json()).result;
  } catch { return null; }
};
const portFree = (port) => new Promise((resolve) => { const srv = createServer().once("error", () => resolve(false)).once("listening", () => srv.close(() => resolve(true))).listen(port, "127.0.0.1"); });
{
  // If something already listens on 8545 (another local node), use a free port for this project instead of
  // deploying to someone else's chain: point the template's `default` network at it and start the node there.
  let port = 8545;
  if (!(await portFree(8545))) {
    for (port = 18545; !(await portFree(port)); port++);
    writeFileSync(cfgPath, readFileSync(cfgPath, "utf8").replace("http://127.0.0.1:8545", `http://127.0.0.1:${port}`));
    console.log(`  · port 8545 is busy on this machine, so the local node runs on ${port}`);
  }
  const chain = port === 8545
    ? spawn("yarn", ["chain"], { cwd: app, env: ENV, detached: true, stdio: ["ignore", "pipe", "pipe"] })
    : spawn("yarn", ["workspace", "@se-2/hardhat", "hardhat", "node", "--network", "hardhat", "--port", String(port)], { cwd: app, env: ENV, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  let chainLog = "";
  chain.stdout.on("data", (d) => (chainLog += d));
  chain.stderr.on("data", (d) => (chainLog += d));
  const stop = () => { try { process.kill(-(chain.pid ?? 0), "SIGTERM"); } catch { /* already gone */ } };
  process.on("exit", stop);
  let up = false;
  for (let i = 0; i < 120 && !up && chain.exitCode === null; i++) {
    await new Promise((r) => setTimeout(r, 500));
    up = (await rpcUp(port)) === "0x7a69";
  }
  if (!up) { console.log(`  ✗ yarn chain did not start on 127.0.0.1:${port}\n${chainLog.split("\n").slice(-15).join("\n")}`); failures.push("yarn chain"); }
  else {
    console.log(`  ✓ yarn chain: local node on 127.0.0.1:${port} (chain 31337)`);
    step(`yarn deploy (${b.deploy.name})`, () => {
      const r = run("yarn", ["deploy"], app, { capture: true });
      const dc = readFileSync(join(nx, "contracts", "deployedContracts.ts"), "utf8");
      if (!/31337:\s*\{/.test(dc) || !/YourContract:/.test(dc)) throw new Error("deployedContracts.ts was not regenerated with YourContract on 31337");
      return `${r.secs}s, deployedContracts.ts regenerated with YourContract on 31337`;
    });
  }
  stop();
}
step(`Hardhat package tsc (${b.hhNetworks.name} in hardhat.config.ts, ${b.deploy.name} in deploy/)`, () => {
  const r = run("yarn", ["hardhat:check-types"], app, { capture: true, allowFail: true });
  const errors = r.out.split("\n").filter((l) => /error TS\d+/.test(l));
  const unexpected = errors.filter((l) => !/^rocketh\/\S+\.ts\(\d+,\d+\): error TS2344/.test(l.trim()));
  if (unexpected.length) throw new Error(`\n${unexpected.map((l) => `      ${l}`).join("\n")}`);
  if (r.code !== 0 && !errors.length) throw new Error(r.out.split("\n").slice(-20).join("\n"));
  return errors.length ? `only the ${errors.length} known rocketh TS2344 errors (errors.md 9)` : "clean (errors.md 9's rocketh TS2344 errors are gone; update errors.md)";
});
{
  cpSync(join(HERE, "app", "verifySponsorReads.ts"), join(hh, "scripts", "verifySponsorReads.ts"));
  ENV.VERIFY_NETWORKS = JSON.stringify(Object.fromEntries(hhNames.map((n) => [n, /** @type {any} */ (chains)[n]?.id ?? 0])));
  const r = run("yarn", ["workspace", "@se-2/hardhat", "hardhat", "run", "scripts/verifySponsorReads.ts"], app, { capture: true, allowFail: true });
  const lines = r.out.split("\n").filter((l) => /^(OK|WRONG|UNREACHABLE) /.test(l));
  const okCount = lines.filter((l) => l.startsWith("OK")).length;
  if (okCount === hhNames.length) console.log(`  ✓ hardhat run: all ${okCount} recipe 4c networks answered with the right chain ID (${r.secs}s)`);
  else if (lines.some((l) => l.startsWith("WRONG")) || !lines.length) { console.log(`  ✗ hardhat run sponsor reads:\n${(lines.length ? lines : r.out.split("\n").slice(-20)).map((l) => `      ${l}`).join("\n")}`); failures.push("hardhat sponsor reads"); }
  else { network = true; console.log(`  ~ hardhat run: ${okCount}/${hhNames.length} networks answered\n${lines.filter((l) => !l.startsWith("OK")).map((l) => `      ${l}`).join("\n")}`); }
}

// ---- Frontend ---------------------------------------------------------------------------------------------------------
snapshotGenerated(nx);
for (const v of ["A", "B"]) {
  applyVariant(nx, v, b, null); // keeps the deployedContracts.ts that `yarn deploy` just wrote
  step(`variant ${v}: yarn next:build`, () => `${run("yarn", ["next:build"], app, { capture: true }).secs}s`);
  step(`variant ${v}: yarn next:check-types`, () => `${run("yarn", ["next:check-types"], app, { capture: true }).secs}s`);
}

console.log(`\nbuild: ${failures.length ? `FAILED: ${failures.join("; ")}` : "ok"} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
process.exit(failures.length ? 1 : network ? 75 : 0);
