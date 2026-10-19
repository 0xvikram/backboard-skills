// Key-free live checks for the goldsky skill. Exit 75 = network problem, 1 = real failure.
//  1. Docs MCP server (references/mcp.md): MCP initialize + tools/list over streamable HTTP, no auth -> the 3 tools.
//  2. Subgraph endpoint error shapes from errors.md: 404 "Subgraph not found" (docs sample), 401 "Missing authorization
//     header" (private, no key), 404 "API token not found" (private, fake key), all as { statusCode, message }.
//  3. The skill's query blocks, run for real against those endpoints: each must surface the message via its error path.
//  4. The webhook receiver block, run on a local port: 405 for GET, 401 without the secret, 200 with it, retries de-duplicated.
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";

const NETWORK = 75;
let failed = 0;
const ok = (m) => console.log(`  ✓ ${m}`), bad = (m) => { failed++; console.error(`  ✗ ${m}`); };
const net = (e) => { console.error(`network: ${e?.cause?.code || e?.message || e}`); process.exit(NETWORK); };
const isNet = (s) => /fetch failed|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|UND_ERR/.test(String(s));

// --- 1. MCP
console.log("Docs MCP server https://docs.goldsky.com/mcp");
async function mcp(body, session) {
  let res;
  try {
    res = await fetch("https://docs.goldsky.com/mcp", { method: "POST", signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(session ? { "mcp-session-id": session } : {}) },
      body: JSON.stringify(body) });
  } catch (e) { net(e); }
  if (res.status >= 500 || res.status === 429) net(`HTTP ${res.status}`);
  const text = await res.text();
  const json = text.trimStart().startsWith("{") ? JSON.parse(text) : JSON.parse(text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5)).pop() || "null");
  return { status: res.status, json, session: res.headers.get("mcp-session-id") };
}
const init = await mcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "backboard-verify", version: "1" } } });
init.status === 200 && init.json?.result?.serverInfo ? ok(`initialize: ${init.json.result.serverInfo.name} ${init.json.result.serverInfo.version}`) : bad(`initialize: HTTP ${init.status} ${JSON.stringify(init.json).slice(0, 200)}`);
const list = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, init.session);
const tools = (list.json?.result?.tools || []).map((t) => t.name);
const expected = ["search_goldsky", "query_docs_filesystem_goldsky", "submit_feedback"];
expected.every((t) => tools.includes(t)) ? ok(`tools/list: ${tools.join(", ")}`) : bad(`tools/list: expected ${expected.join(", ")}, got ${JSON.stringify(tools)}`);

// --- 2. Endpoint error shapes
const PROJECT = "project_cl8ylkiw00krx0hvza0qw17vn"; // the docs' sample project
const PUBLIC = `https://api.goldsky.com/api/public/${PROJECT}/subgraphs/uniswap-v3-base/prod/gn`;
const PRIVATE = `https://api.goldsky.com/api/private/${PROJECT}/subgraphs/uniswap-v3-base/prod/gn`;
const cases = [
  { label: "docs sample (sunset)", url: PUBLIC, token: undefined, status: 404, msg: "Subgraph not found" },
  { label: "private, no key", url: PRIVATE, token: undefined, status: 401, msg: "Missing authorization header" },
  { label: "private, fake key", url: PRIVATE, token: "fake_goldsky_token", status: 404, msg: "API token not found" },
];
console.log("Subgraph endpoint error shapes");
for (const c of cases) {
  let res;
  try { res = await fetch(c.url, { method: "POST", signal: AbortSignal.timeout(20000), headers: { "Content-Type": "application/json", ...(c.token ? { Authorization: `Bearer ${c.token}` } : {}) }, body: JSON.stringify({ query: "{ _meta { block { number } } }" }) }); } catch (e) { net(e); }
  if (res.status >= 500 || res.status === 429) net(`HTTP ${res.status}`);
  const json = await res.json().catch(() => null);
  res.status === c.status && json?.statusCode === c.status && String(json?.message).includes(c.msg) ? ok(`${c.label}: ${res.status} { statusCode, message: "${c.msg}..." }`) : bad(`${c.label}: expected ${c.status} "${c.msg}", got ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
}

// --- 3. Skill query blocks against those endpoints
console.log("Skill query blocks (error paths)");
const blocks = readdirSync("blocks").sort().map((f) => ({ f, path: `blocks/${f}`, code: readFileSync(`blocks/${f}`, "utf8") }));
const queryBlocks = blocks.filter((b) => b.code.includes("GOLDSKY_SUBGRAPH_URL") && !b.code.includes("createServer"));
if (queryBlocks.length < 3) bad(`expected at least 3 query blocks, found ${queryBlocks.length}`);
for (const b of queryBlocks) {
  const usesToken = b.code.includes("GOLDSKY_API_TOKEN");
  for (const c of cases.filter((c) => usesToken || !c.token)) {
    const env = { ...process.env, GOLDSKY_SUBGRAPH_URL: c.url, ...(c.token ? { GOLDSKY_API_TOKEN: c.token } : {}) };
    if (!c.token) delete env.GOLDSKY_API_TOKEN;
    const fn = b.code.match(/export async function (allTransfersTo)/)?.[1];
    let out, code;
    if (fn) {
      // A library function: import it with the env set, call it, expect a thrown error.
      Object.assign(process.env, env);
      const { tsImport } = await import("tsx/esm/api");
      const mod = await tsImport(`${pathToFileURL(b.path).href}?case=${encodeURIComponent(c.label)}`, import.meta.url);
      try { await mod[fn]("0x0000000000000000000000000000000000000001"); out = "no error"; code = 0; } catch (e) { out = String(e?.message); code = 1; }
    } else {
      const r = spawnSync("npx", ["tsx", b.path], { env, encoding: "utf8", timeout: 60000 });
      out = `${r.stdout}${r.stderr}`; code = r.status;
    }
    if (isNet(out)) net(out.slice(0, 200));
    code !== 0 && out.includes(c.msg) ? ok(`${b.f} [${c.label}]: surfaced "${c.msg}"`) : bad(`${b.f} [${c.label}]: expected a failure with "${c.msg}", got exit ${code}: ${out.slice(-300)}`);
  }
}

// --- 4. Webhook receiver (local)
console.log("Webhook receiver block (localhost)");
const hook = blocks.find((b) => b.code.includes("goldsky-webhook-secret"));
if (!hook) bad("webhook block not found");
else {
  const port = await new Promise((r) => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
  const SECRET = "whs_test_secret";
  const child = spawn("npx", ["tsx", hook.path], { env: { ...process.env, PORT: String(port), GOLDSKY_WEBHOOK_SECRET: SECRET }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (d) => (log += d)); child.stderr.on("data", (d) => (log += d));
  const t0 = Date.now();
  while (!log.includes("listening") && Date.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 200));
  const base = `http://127.0.0.1:${port}/`;
  const payload = { op: "INSERT", data_source: "counter", entity: "transfer", webhook_name: "t", id: "evt-1", data: { old: null, new: { id: "0xabc-1", vid: 7, block_range: "[100,)" } }, delivery_info: { max_retries: 10, current_retry: 0 } };
  const post = (headers) => fetch(base, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(payload) }).then((r) => r.status);
  try {
    const g = await fetch(base).then((r) => r.status);
    g === 405 ? ok("GET -> 405") : bad(`GET -> ${g}, expected 405`);
    const s1 = await post({});
    s1 === 401 ? ok("POST without secret -> 401") : bad(`POST without secret -> ${s1}, expected 401`);
    const s2 = await post({ "goldsky-webhook-secret": SECRET }), s3 = await post({ "goldsky-webhook-secret": SECRET });
    s2 === 200 && s3 === 200 ? ok("POST with secret -> 200 (twice)") : bad(`POST with secret -> ${s2}/${s3}, expected 200`);
    await new Promise((r) => setTimeout(r, 300));
    const logged = log.split("\n").filter((l) => l.startsWith("INSERT transfer 0xabc-1")).length;
    logged === 1 ? ok("same event id logged once (retry de-duplicated)") : bad(`event logged ${logged} times, expected 1. Log: ${log}`);
  } catch (e) { bad(`webhook server: ${e.message}. Log: ${log}`); }
  child.kill();
}

if (failed) { console.error(`${failed} live check(s) failed`); process.exit(1); }
console.log("live: all checks passed");
process.exit(0);
