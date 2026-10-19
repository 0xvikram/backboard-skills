// Type-checks every code block of the skill inside a real create-eth@2.0.23 project (Hardhat flavour, scaffolded
// with --skip-install; the frontend's packages come from this folder's package.json at the template's exact versions).
//   Variant A: hardhat + the six sponsor testnets (chains.md snippet) + Arc mainnet (recipe 4b); SKILL.md, quickstart
//              and recipe 3 pages (YourContract) + the wagmi read (recipe 6).
//   Variant B: recipe 4a scaffold.config.ts (worldchainSepolia first, every chain uncommented), recipe 6
//              externalContracts.ts (WETH on 4801) and the WETH hook fragment.
//   Hardhat:   recipe 4c networks against hardhat@3.19.0's HardhatUserConfig; recipe 2's deploy script compared with
//              the template's generated one (it is fully type-checked in `build`, which installs rocketh).
//   Negative checks: the errors errors.md 3, 5 and 6 describe must still happen, so the checks above are not vacuous.
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ENV, HERE, applyVariant, classify, codeTokens, hardhatNetworksFile, scaffold, snapshotGenerated, wrapFragment } from "./lib.mjs";

const work = join(HERE, ".se"), tsc = join(HERE, "node_modules", "typescript", "bin", "tsc");
const b = classify();
const app = scaffold(work, "se-app", { install: false });
const nx = join(app, "packages", "nextjs");
snapshotGenerated(nx);
const fixture = readFileSync(join(HERE, "fixtures", "deployedContracts.ts"), "utf8");
const isWeth = (/** @type {{text: string}} */ x) => /contractName:\s*"WETH"/.test(x.text);
const failures = [];

const tscAsync = (dir) => new Promise((resolve) => {
  const t = Date.now(), p = spawn(process.execPath, [tsc, "--noEmit", "-p", "tsconfig.json"], { cwd: dir, env: ENV });
  let out = "";
  p.stdout.on("data", (d) => (out += d));
  p.stderr.on("data", (d) => (out += d));
  p.on("close", (code) => resolve({ code, out, secs: ((Date.now() - t) / 1000).toFixed(0) }));
});
const nextjsCopy = (name, variant, extra = () => {}) => {
  const dir = join(work, `nextjs-${name}`);
  rmSync(dir, { recursive: true, force: true });
  cpSync(nx, dir, { recursive: true });
  applyVariant(dir, variant, b, fixture);
  // next-env.d.ts imports .next/dev/types/routes.d.ts, which only exists after `next dev`/`next build`
  writeFileSync(join(dir, "next-env.d.ts"), '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n');
  extra(dir);
  return dir;
};
const hardhatDir = (name, networksTs) => {
  const dir = join(work, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), '{ "type": "module" }\n');
  writeFileSync(join(dir, "networks.ts"), networksTs);
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "es2022", module: "node16", moduleResolution: "node16", strict: true, skipLibCheck: true, noEmit: true, types: [] }, files: ["networks.ts"] }));
  return dir;
};

const wethFrag = b.fragments.find(isWeth);
const all = b.pages.concat(b.fragments);
const checks = [
  { label: "nextjs variant A (hardhat + six sponsor testnets + Arc mainnet)", blocks: [b.chainsSnippet, b.customChains, ...all.filter((p) => !isWeth(p))], dir: nextjsCopy("A", "A") },
  { label: "nextjs variant B (recipe 4a config, worldchainSepolia first, WETH external)", blocks: [b.config, b.customChains, b.external, ...b.fragments], dir: nextjsCopy("B", "B") },
  { label: "hardhat networks (Hardhat 3 HardhatUserConfig)", blocks: [b.hhNetworks], dir: hardhatDir("hh", hardhatNetworksFile(b)) },
];
// errors.md 5: a WETH hook with hardhat first (YourContract only) must be rejected.
if (wethFrag) checks.push({
  label: "errors.md 5: WETH hook with hardhat first", expect: /'"WETH"' is not assignable to type '"YourContract"'/,
  dir: nextjsCopy("neg5", "A", (dir) => { mkdirSync(join(dir, "app", "verify-neg5"), { recursive: true }); writeFileSync(join(dir, "app", "verify-neg5", "page.tsx"), wrapFragment(wethFrag.text)); }),
});
// errors.md 6: the same external contract without deployedOnBlock breaks the template's useScaffoldEventHistory.ts.
checks.push({
  label: "errors.md 6: external contract without deployedOnBlock", expect: /useScaffoldEventHistory\.ts.*error TS2345/,
  dir: nextjsCopy("neg6", "B", (dir) => writeFileSync(join(dir, "contracts", "externalContracts.ts"), b.external.text.replace(/,\s*deployedOnBlock:\s*\d+/, ""))),
});
// errors.md 3: a Hardhat 3 network without `type` is rejected (the Hardhat 2 docs shape).
checks.push({ label: "errors.md 3: Hardhat network without type", expect: /error TS2322/, dir: hardhatDir("hh-neg3", hardhatNetworksFile(b).replace(/type:\s*"http",\s*/g, "")) });

const results = await Promise.all(checks.map((c) => tscAsync(c.dir)));
checks.forEach((c, i) => {
  const r = results[i];
  if (!c.expect) {
    if (r.code === 0) console.log(`  ✓ ${c.label} (${r.secs}s)\n    blocks: ${c.blocks.map((x) => x.name).join(", ")}`);
    else { console.log(`  ✗ ${c.label} (${r.secs}s)\n${r.out.trim().split("\n").slice(0, 40).map((l) => `    ${l}`).join("\n")}`); failures.push(c.label); }
  } else if (r.code !== 0 && c.expect.test(r.out)) console.log(`  ✓ ${c.label}: fails as documented (${r.secs}s)`);
  else { console.log(`  ✗ ${c.label}: expected ${c.expect}, got exit ${r.code}\n${r.out.trim().split("\n").slice(0, 15).map((l) => `    ${l}`).join("\n")}`); failures.push(c.label); }
});

// Deploy script (recipe 2): every statement of the block must appear in the template's generated deploy script.
const tmpl = codeTokens(readFileSync(join(app, "packages", "hardhat", "deploy", "00_deploy_your_contract.ts"), "utf8"));
const blk = b.deploy.text;
const parts = [
  blk.match(/^import[^\n]*;/m)?.[0],
  blk.match(/const \{ deployer \} = env\.namedAccounts;/)?.[0],
  blk.match(/env\.deploy\([\s\S]*?\}\)/)?.[0],
  blk.match(/tags: \[[^\]]*\]/)?.[0],
];
const missing = parts.map((p, i) => (p && tmpl.includes(codeTokens(p)) ? null : p || `part ${i} not found in block`)).filter(Boolean);
if (!missing.length) console.log(`  ✓ deploy script ${b.deploy.name} matches the template's deploy/00_deploy_your_contract.ts`);
else { console.log(`  ✗ deploy script ${b.deploy.name}: not in the template:\n${missing.map((m) => `    ${m}`).join("\n")}`); failures.push("deploy script"); }

if (failures.length) { console.error(`typecheck FAILED: ${failures.join("; ")}`); process.exit(1); }
console.log(`typecheck: all ${b.pages.length + b.fragments.length + 6} blocks type-check against the create-eth@2.0.23 template`);
