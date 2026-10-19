// Re-runs a tested skill's checks, so anyone can confirm the skill still works today.
//   node scripts/verify.mjs <skill> [--full] [--keep]
//   node scripts/verify.mjs all [--full]
// For each skill with a tests/ folder it copies the tests to a temporary folder, installs the exact pinned packages,
// writes every code block from the skill into blocks/, and runs the npm scripts the tests define:
//   typecheck  type-checks blocks/ and the test files                (always)
//   live       key-free checks against real public services          (always, if defined)
//   build      builds a real project (e.g. next build)               (only with --full, if defined)
// A live check that can't reach a service exits with code 75, which is reported as "network", not as a failure.
// No API keys, wallets or funds are used anywhere.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { SKILLS, skills } from "./lib.mjs";
import { extract } from "./extract-blocks.mjs";

const args = process.argv.slice(2), full = args.includes("--full"), keep = args.includes("--keep");
const target = args.find((a) => !a.startsWith("--"));
if (!target) { console.error("Usage: node scripts/verify.mjs <skill|all> [--full] [--keep]"); process.exit(1); }
const NETWORK = 75;

const tested = skills().map((s) => s.dir).filter((d) => existsSync(join(SKILLS, d, "tests", "package.json")));
const list = target === "all" ? tested : [target];
for (const s of list) if (!tested.includes(s)) { console.error(`${s} has no tests/ folder. Skills with tests: ${tested.join(", ")}`); process.exit(1); }

const run = (cmd, argv, cwd) => {
  const t = Date.now(), r = spawnSync(cmd, argv, { cwd, encoding: "utf8", env: { ...process.env, CI: "1", NEXT_TELEMETRY_DISABLED: "1", DO_NOT_TRACK: "1" }, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, out: `${r.stdout || ""}${r.stderr || ""}`.trim(), secs: ((Date.now() - t) / 1000).toFixed(0) };
};
const tail = (s, n = 25) => s.split("\n").slice(-n).map((l) => `      ${l}`).join("\n");

const results = [];
for (const skill of list) {
  const work = mkdtempSync(join(tmpdir(), `verify-${skill}-`));
  cpSync(join(SKILLS, skill, "tests"), work, { recursive: true });
  const pkg = JSON.parse(readFileSync(join(work, "package.json"), "utf8")), scripts = pkg.scripts || {};
  const blocks = extract(skill, join(work, "blocks"));
  console.log(`\n▶ ${skill}: ${blocks.length} code blocks from the skill`);
  const steps = [["install", "npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"]]];
  for (const s of ["typecheck", "live", ...(full ? ["build"] : [])]) if (scripts[s]) steps.push([s, "npm", ["run", "--silent", s]]);
  const out = { skill, steps: [] };
  for (const [name, cmd, argv] of steps) {
    const r = run(cmd, argv, work), status = r.code === 0 ? "pass" : r.code === NETWORK ? "network" : "FAIL";
    out.steps.push({ name, status, secs: r.secs });
    console.log(`  ${status === "pass" ? "✓" : status === "network" ? "~" : "✗"} ${name} (${r.secs}s)${status === "pass" ? "" : `\n${tail(r.out)}`}`);
    if (status === "FAIL") break;
  }
  out.ok = !out.steps.some((s) => s.status === "FAIL");
  results.push(out);
  if (!keep) rmSync(work, { recursive: true, force: true });
  else console.log(`  kept: ${work}`);
}

const failed = results.filter((r) => !r.ok), net = results.filter((r) => r.ok && r.steps.some((s) => s.status === "network"));
console.log(`\n${results.length - failed.length}/${results.length} skills verified${full ? " (full, with builds)" : ""}${net.length ? `; ${net.length} couldn't reach a live service: ${net.map((r) => r.skill).join(", ")}` : ""}${failed.length ? `; FAILED: ${failed.map((r) => r.skill).join(", ")}` : ""}`);
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `| Skill | ${["install", "typecheck", "live", "build"].join(" | ")} |\n| --- | --- | --- | --- | --- |\n${results.map((r) => `| ${r.skill} | ${["install", "typecheck", "live", "build"].map((n) => r.steps.find((s) => s.name === n)?.status || "–").join(" | ")} |`).join("\n")}\n`, { flag: "a" });
process.exit(failed.length ? 1 : 0);
