// Key-free live checks for the envio skill. Exit 75 = network problem, 1 = real failure.
//  1. HyperSync /height (no token) on the four sponsor chains chains.md lists as HyperSync, by chain ID and by name.
//  2. @envio-dev/hypersync-client getHeight() with no real token (arc-testnet; the block below covers unichain).
//  3. The recipes.md HyperSync block, run for real (placeholder token address -> Unichain USDC, fake token): getHeight
//     must work and get() must fail fast (maxNumRetries: 1) with errors.md #1 "Your token is malformed".
//  4. Docs MCP https://docs.envio.dev/mcp (references/mcp.md): tools/list with no key has docs_search + docs_fetch.
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { HypersyncClient } from "@envio-dev/hypersync-client";

const NETWORK = 75;
let failed = 0;
const ok = (m) => console.log(`  ✓ ${m}`), bad = (m) => { failed++; console.error(`  ✗ ${m}`); };
const net = (e) => { console.error(`network: ${e?.cause?.code || e?.message || e}`); process.exit(NETWORK); };
const isNet = (s) => /fetch failed|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|UND_ERR|error sending request|dns error|timed out/i.test(String(s));

const CHAINS = [ // chains.md: HyperSync built in
  { id: 130, name: "unichain" },
  { id: 480, name: "worldchain" },
  { id: 5042, name: "arc" },
  { id: 5042002, name: "arc-testnet" },
];

console.log("HyperSync /height (no token)");
for (const c of CHAINS) {
  const heights = [];
  for (const sub of [c.id, c.name]) {
    let res;
    try { res = await fetch(`https://${sub}.hypersync.xyz/height`, { signal: AbortSignal.timeout(20000) }); } catch (e) { net(e); }
    if (res.status >= 500 || res.status === 429) net(`HTTP ${res.status} from ${sub}.hypersync.xyz`);
    const j = await res.json().catch(() => null);
    Number.isInteger(j?.height) && j.height > 0 ? heights.push(j.height) : bad(`${sub}.hypersync.xyz/height: HTTP ${res.status} ${JSON.stringify(j)}`);
  }
  if (heights.length === 2) Math.abs(heights[0] - heights[1]) < 5000 ? ok(`${c.id} / ${c.name}: height ${heights[0]} / ${heights[1]} (same chain)`) : bad(`${c.id} and ${c.name} heights differ a lot: ${heights.join(" vs ")}; the name may point to another chain`);
}

console.log("hypersync-client getHeight() without a token");
// One chain only: tokenless HyperSync requests get slow when many are sent in a row (seen while writing these tests).
{
  const c = CHAINS[3];
  let h, err;
  for (let attempt = 0; attempt < 2 && h === undefined; attempt++) {
    try { h = await new HypersyncClient({ url: `https://${c.name}.hypersync.xyz`, apiToken: "", maxNumRetries: 1, httpReqTimeoutMillis: 20000 }).getHeight(); }
    catch (e) { err = e; }
  }
  if (h === undefined) { if (isNet(err?.message)) net(err); bad(`${c.name}: getHeight threw ${String(err?.message).slice(0, 200)}`); }
  else h > 0 ? ok(`${c.name}: ${h}`) : bad(`${c.name}: getHeight returned ${h}`);
}

console.log("recipes.md HyperSync block, fake token");
const block = readdirSync("blocks").sort().map((f) => ({ f, code: readFileSync(`blocks/${f}`, "utf8") })).find((b) => b.code.includes("@envio-dev/hypersync-client"));
if (!block) bad("no HyperSync client block found");
else {
  mkdirSync("live-tmp", { recursive: true });
  writeFileSync("live-tmp/transfers.ts", block.code.replace("<TOKEN_ADDRESS>", "0x078D782b760474a361dDA0AF3839290b0EF57AD6")); // USDC on Unichain
  let r, out, secs;
  for (let attempt = 0; attempt < 2; attempt++) { // one retry if the block's own getHeight() times out
    const t = Date.now();
    r = spawnSync(process.execPath, ["node_modules/.bin/tsx", "live-tmp/transfers.ts"], { encoding: "utf8", timeout: 120000, env: { ...process.env, ENVIO_API_TOKEN: "not-a-real-token" } });
    out = `${r.stdout}${r.stderr}`; secs = ((Date.now() - t) / 1000).toFixed(0);
    if (out.includes("Your token is malformed") || !isNet(out)) break;
  }
  if (!out.includes("401") && isNet(out)) net(out.slice(0, 300));
  r.status !== 0 && out.includes("Your token is malformed") ? ok(`${block.f}: reached HyperSync, failed with "Your token is malformed" in ${secs}s (maxNumRetries: 1)`) : bad(`${block.f}: expected a 401 "Your token is malformed", got exit ${r.status} after ${secs}s: ${out.slice(-400)}`);
}

console.log("Docs MCP https://docs.envio.dev/mcp");
async function mcp(body, session) {
  let res;
  try {
    res = await fetch("https://docs.envio.dev/mcp", { method: "POST", signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(session ? { "mcp-session-id": session } : {}) }, body: JSON.stringify(body) });
  } catch (e) { net(e); }
  if (res.status >= 500 || res.status === 429) net(`HTTP ${res.status}`);
  const text = await res.text();
  const json = text.trimStart().startsWith("{") ? JSON.parse(text) : JSON.parse(text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5)).pop() || "null");
  return { status: res.status, json, session: res.headers.get("mcp-session-id") };
}
const init = await mcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "backboard-verify", version: "1" } } });
init.status === 200 && init.json?.result ? ok(`initialize: ${JSON.stringify(init.json.result.serverInfo || {})}`) : bad(`initialize: HTTP ${init.status} ${JSON.stringify(init.json).slice(0, 200)}`);
const list = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, init.session);
const tools = (list.json?.result?.tools || []).map((t) => t.name);
["docs_search", "docs_fetch"].every((n) => tools.includes(n)) ? ok(`tools/list: ${tools.join(", ")}`) : bad(`tools/list: expected docs_search + docs_fetch, got ${JSON.stringify(tools)}`);

if (failed) { console.error(`${failed} live check(s) failed`); process.exit(1); }
console.log("live: all checks passed");
process.exit(0);
