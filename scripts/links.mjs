// Checks that every web link in the skills still loads. Run: node scripts/links.mjs
// Prints the broken ones and exits 1 when any are broken. Sites that refuse scripts (401/403/429) count as "blocked",
// not broken, because they load in a browser.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { SKILLS } from "./lib.mjs";

const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith(".md") ? [p] : []; });
const urls = new Set();
for (const f of files(SKILLS)) for (const [u] of readFileSync(f, "utf8").matchAll(/https?:\/\/[^\s)'"`<>\]]+/g)) urls.add(u.replace(/[.,;:]+$/, ""));

const BLOCKED = new Set([401, 403, 429]);
async function check(u) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(u, { method, redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "user-agent": "Mozilla/5.0 (backboard-skills link check)" } });
      if (r.ok) return "ok";
      if (BLOCKED.has(r.status)) return "blocked";
      if (method === "GET") return `HTTP ${r.status}`;
    } catch (e) { if (method === "GET") return e.name === "TimeoutError" ? "timed out" : "unreachable"; }
  }
}

const list = [...urls].sort(), broken = [];
let blocked = 0;
for (let i = 0; i < list.length; i += 8) {
  const out = await Promise.all(list.slice(i, i + 8).map(async (u) => [u, await check(u)]));
  for (const [u, r] of out) { if (r === "blocked") blocked++; else if (r !== "ok") broken.push(`${r}  ${u}`); }
}
console.log(`${list.length} links: ${list.length - broken.length - blocked} ok, ${blocked} blocked scripts (fine in a browser), ${broken.length} broken`);
if (broken.length) { console.log(broken.map((b) => `  - ${b}`).join("\n")); process.exit(1); }
