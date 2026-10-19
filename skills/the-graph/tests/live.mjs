// Key-free live checks against The Graph's public endpoints. Exit 75 = network problem, 1 = real failure.
//  1. Gateway error shapes the skill relies on ("errors come back with HTTP 200"): no key, malformed key, unknown key.
//  2. The skill's own query blocks, run for real with a well-formed fake key against a public subgraph:
//     each must reach the gateway and surface "auth error: API key not found" through its error path.
//  3. Subgraph MCP endpoint (references/mcp.md): /sse answers 200 with text/event-stream.
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { all, isMapping } from "./blocks-lib.mjs";

const NETWORK = 75;
const SUBGRAPH_ID = "5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV"; // Uniswap v3 (Ethereum), used in The Graph docs
const FAKE_KEY = "0".repeat(32);
const GATEWAY = `https://gateway.thegraph.com/api/subgraphs/id/${SUBGRAPH_ID}`;
let failed = 0;
const ok = (m) => console.log(`  ✓ ${m}`), bad = (m) => { failed++; console.error(`  ✗ ${m}`); };
const net = (e) => { console.error(`network: ${e?.cause?.code || e?.message || e}`); process.exit(NETWORK); };

async function post(headers) {
  try {
    const res = await fetch(GATEWAY, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ query: "{ _meta { block { number } } }" }), signal: AbortSignal.timeout(20000) });
    if (res.status >= 500 || res.status === 429) net(`HTTP ${res.status}`);
    return { status: res.status, json: await res.json() };
  } catch (e) { net(e); }
}

console.log("Gateway error shapes");
for (const [label, headers, expected] of [
  ["no key", {}, "missing authorization header"],
  ["malformed key", { Authorization: "Bearer notarealkey" }, "malformed API key"],
  ["unknown key", { Authorization: `Bearer ${FAKE_KEY}` }, "API key not found"],
]) {
  const { status, json } = await post(headers);
  const msg = json?.errors?.[0]?.message || "";
  status === 200 && msg.includes(expected) ? ok(`${label}: HTTP 200, errors[0].message = "${msg}"`) : bad(`${label}: expected HTTP 200 + "${expected}", got HTTP ${status} ${JSON.stringify(json).slice(0, 200)}`);
}

console.log("Skill query blocks against the gateway (fake key)");
const env = { ...process.env, GRAPH_API_KEY: FAKE_KEY, SUBGRAPH_ID };
Object.assign(process.env, { GRAPH_API_KEY: FAKE_KEY, SUBGRAPH_ID });
const app = all().filter((b) => !isMapping(b) && b.file.endsWith(".ts"));
for (const b of app) {
  if (!b.code.includes("gateway.thegraph.com")) continue;
  const exports = [...b.code.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  if (!exports.length) {
    // A script: run it, it must fail with the gateway's auth error.
    const r = spawnSync("npx", ["tsx", b.path], { env, encoding: "utf8", timeout: 60000 });
    const out = `${r.stdout}${r.stderr}`;
    if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|fetch failed/.test(out)) net(out.slice(0, 200));
    r.status !== 0 && out.includes("API key not found") ? ok(`${b.file}: surfaced "API key not found"`) : bad(`${b.file}: expected a thrown "API key not found", got exit ${r.status}: ${out.slice(-300)}`);
    continue;
  }
  const { tsImport } = await import("tsx/esm/api");
  const mod = await tsImport(pathToFileURL(b.path).href, import.meta.url);
  for (const name of exports) {
    try {
      const arg = name === "transfersTo" ? "0x0000000000000000000000000000000000000001" : undefined;
      const out = await mod[name](arg);
      if (out instanceof Response) {
        const body = await out.json();
        out.status === 502 && JSON.stringify(body).includes("API key not found") ? ok(`${b.file} ${name}(): 502 with the gateway error`) : bad(`${b.file} ${name}(): expected 502 + auth error, got ${out.status} ${JSON.stringify(body).slice(0, 200)}`);
      } else bad(`${b.file} ${name}(): expected an auth error, got data`);
    } catch (e) {
      if (/fetch failed|ENOTFOUND|ETIMEDOUT/.test(String(e?.message))) net(e);
      String(e?.message).includes("API key not found") ? ok(`${b.file} ${name}(): threw "API key not found"`) : bad(`${b.file} ${name}(): unexpected error ${e?.message}`);
    }
  }
}

console.log("Subgraph MCP endpoint");
try {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 20000);
  const res = await fetch("https://subgraphs.mcp.thegraph.com/sse", { signal: ctrl.signal });
  clearTimeout(t);
  if (res.status >= 500) net(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") || "";
  res.status === 200 && type.includes("text/event-stream") ? ok(`/sse: 200 ${type}`) : bad(`/sse: expected 200 text/event-stream, got ${res.status} ${type}`);
  ctrl.abort();
} catch (e) { if (e.name !== "AbortError") net(e); }

if (failed) { console.error(`${failed} live check(s) failed`); process.exit(1); }
console.log("live: all checks passed");
process.exit(0);
