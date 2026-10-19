// Key-free live checks for the quicknode skill. Run: npx tsx live.ts
// The skill's own scripts (from blocks/) are run as-is, with the env vars pointed at public RPCs or at QuickNode's public
// docs-demo endpoints (the ones QuickNode publishes in its docs pages), so no QuickNode account or key is needed.
// Exit 0 = pass, 1 = real mismatch, 75 = only network/service trouble.
import { spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { worldchain, worldchainSepolia, unichain, unichainSepolia, hedera, hederaTestnet, arc, arcTestnet, zeroGMainnet, zeroGTestnet } from "viem/chains";

const TIMEOUT = 40_000;
const fails: string[] = [], netFails: string[] = [];
const NET_RE = /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|timed? ?out|socket hang up|HTTP request failed|Status: (429|5\d\d)|\b(502|503|504)\b|Too Many Requests|rate limit|limited to|-32010|SocketClosedError|WebSocket/i;
class Real extends Error {}
const expect = (cond: boolean, msg: string) => { if (!cond) throw new Real(msg); };

async function check(name: string, fn: () => Promise<string>) {
  try { console.log(`  ok   ${name}: ${await fn()}`); }
  catch (e) {
    const msg = String((e as Error).message ?? e), first = msg.split("\n")[0].slice(0, 300);
    if (!(e instanceof Real) && NET_RE.test(msg)) { netFails.push(name); console.log(`  net  ${name}: ${first}`); }
    else { fails.push(name); console.log(`  FAIL ${name}: ${first}`); }
  }
}

const files = readdirSync("blocks").filter((f) => f.endsWith(".ts"));
const block = (label: string, test: (t: string) => boolean, prefix = "") => {
  const f = files.find((f) => f.startsWith(prefix) && test(readFileSync(`blocks/${f}`, "utf8")));
  if (!f) throw new Real(`no block for ${label} in the skill`);
  return `blocks/${f}`;
};

// Run a skill block with tsx (in-process loader, so kill() stops it) and the given env.
function run(file: string, env: Record<string, string>, opts: { preload?: string; waitFor?: RegExp } = {}) {
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    const args = ["--import", "tsx", ...(opts.preload ? ["--import", pathToFileURL(opts.preload).href] : []), file];
    const p = spawn(process.execPath, args, { env: { ...process.env, ...env } });
    let out = "";
    const onData = (d: Buffer) => { out += d; if (opts.waitFor?.test(out)) p.kill(); };
    p.stdout.on("data", onData); p.stderr.on("data", onData);
    const t = setTimeout(() => { out += "\n[timed out]"; p.kill("SIGKILL"); }, TIMEOUT);
    p.on("close", (code) => { clearTimeout(t); resolve({ code, out }); });
  });
}
// Run a block that must succeed; network trouble in its output -> "net".
async function runOk(file: string, env: Record<string, string>, opts?: { preload?: string; waitFor?: RegExp }) {
  const r = await run(file, env, opts);
  if (r.code !== 0 && !(opts?.waitFor && opts.waitFor.test(r.out))) {
    const tail = r.out.trim().split("\n").slice(-4).join(" | ");
    if (NET_RE.test(r.out)) throw new Error(tail);
    throw new Real(`exit ${r.code}: ${tail}`);
  }
  return r.out;
}

const PUBLIC_WC_SEPOLIA = "https://worldchain-sepolia.g.alchemy.com/public";
const PUBLIC_WC = worldchain.rpcUrls.default.http[0];
const WETH = "0x4200000000000000000000000000000000000006";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const demo = (n: string) => `https://docs-demo.${n}.quiknode.pro/`;

// ── 1. Quickstarts on a public World Chain Sepolia RPC ─────────────────────────────────────────────────────────────
console.log("Quickstarts (QUICKNODE_RPC_URL = public World Chain Sepolia RPC):");
await check("SKILL.md quickstart (viem)", async () => {
  const out = await runOk(block("SKILL quickstart", (t) => t.includes("worldchainSepolia"), "SKILL-"), { QUICKNODE_RPC_URL: PUBLIC_WC_SEPOLIA });
  expect(/chainId: 4801/.test(out) && /wethBalance: '[\d.]+'/.test(out), `unexpected output: ${out.trim()}`);
  return out.trim().replace(/\s+/g, " ");
});
await check("quickstart.md ethers", async () => {
  const out = await runOk(block("ethers quickstart", (t) => t.includes("JsonRpcProvider"), "quickstart-"), { QUICKNODE_RPC_URL: PUBLIC_WC_SEPOLIA });
  expect(/block: \d+/.test(out) && /balance: '[\d.]+'/.test(out), `unexpected output: ${out.trim()}`);
  return out.trim().replace(/\s+/g, " ");
});

// ── 2. Sponsor chains (recipes.md multi-chain client) ──────────────────────────────────────────────────────────────
const chains = { QN_WORLDCHAIN_URL: worldchain, QN_WORLDCHAIN_SEPOLIA_URL: worldchainSepolia, QN_UNICHAIN_URL: unichain,
  QN_UNICHAIN_SEPOLIA_URL: unichainSepolia, QN_HEDERA_URL: hedera, QN_HEDERA_TESTNET_URL: hederaTestnet, QN_ARC_URL: arc,
  QN_ARC_TESTNET_URL: arcTestnet, QN_0G_URL: zeroGMainnet, QN_0G_GALILEO_URL: zeroGTestnet };
const wantIds: Record<string, number> = { "worldchain-mainnet": 480, "worldchain-sepolia": 4801, "unichain-mainnet": 130, "unichain-sepolia": 1301,
  "hedera-mainnet": 295, "hedera-testnet": 296, "arc-mainnet": 5042, "arc-testnet": 5042002, "0g-mainnet": 16661, "0g-galileo": 16602 };
const multichain = block("multi-chain client", (t) => t.includes("const networks: Record<string"));
// The script prints "<name> chainId <id> expected <id> block <n>" for every env var that is set.
function checkChainLines(out: string, names: string[]) {
  for (const n of names) {
    const m = new RegExp(`^${n} chainId (\\d+) expected (\\d+) block (\\d+)n?$`, "m").exec(out);
    expect(!!m, `no line for ${n} in output: ${out.trim().slice(-300)}`);
    expect(Number(m![1]) === wantIds[n] && Number(m![2]) === wantIds[n], `${n}: chainId ${m![1]}, viem expects ${m![2]}, skill says ${wantIds[n]}`);
  }
  return names.map((n) => `${n}=${wantIds[n]}`).join(", ");
}
console.log("Sponsor chains (recipes.md §1, run as-is):");
await check("all 10 networks on their public RPCs", async () => {
  const env = Object.fromEntries(Object.entries(chains).map(([k, c]) => [k, c.rpcUrls.default.http[0]]));
  return checkChainLines(await runOk(multichain, env), Object.keys(wantIds));
});
await check("QuickNode-hosted docs-demo endpoints (URL format)", async () => {
  const env = { QN_WORLDCHAIN_URL: demo("worldchain-mainnet"), QN_UNICHAIN_URL: demo("unichain-mainnet"),
    QN_HEDERA_TESTNET_URL: demo("hedera-testnet"), QN_ARC_URL: demo("arc-mainnet"), QN_0G_URL: demo("0g-mainnet") };
  const clean = Object.fromEntries(Object.keys(chains).map((k) => [k, ""]));
  return checkChainLines(await runOk(multichain, { ...clean, ...env }), ["worldchain-mainnet", "unichain-mainnet", "hedera-testnet", "arc-mainnet", "0g-mainnet"]);
});

// ── 3. Other read recipes ───────────────────────────────────────────────────────────────────────────────────────────
console.log("Read recipes (run as-is on public RPCs):");
await check("chunked eth_getLogs, World Chain", async () => {
  const out = await runOk(block("getLogs", (t) => t.includes("getTransferLogs")), { QUICKNODE_RPC_URL: PUBLIC_WC });
  expect(/WETH Transfer logs in last 50 blocks: \d+/.test(out), `unexpected output: ${out.trim().slice(-300)}`);
  return out.match(/WETH Transfer logs in last 50 blocks: \d+/)![0];
});
await check("Multicall3 token balances, World Chain", async () => {
  const out = await runOk(block("multicall", (t) => t.includes("client.multicall(")), { QUICKNODE_RPC_URL: PUBLIC_WC });
  expect(/^WETH [\d.]+$/m.test(out) && /^USDC [\d.]+$/m.test(out), `expected WETH and USDC lines, got: ${out.trim()}`);
  return out.trim().replace(/\n/g, ", ");
});
await check("Hedera Mirror Node path (public mirror node)", async () => {
  const out = await runOk(block("mirror node", (t) => t.includes("Mirror Node")), { QN_HEDERA_TESTNET_URL: "https://testnet.mirrornode.hedera.com" });
  expect(/^0\.0\.2 0x0{38}02 balance \(tinybars\): \d+/m.test(out), `unexpected output: ${out.trim()}`);
  return out.trim();
});
await check("Hedera Mirror Node path on QuickNode docs-demo", async () => {
  const out = await runOk(block("mirror node", (t) => t.includes("Mirror Node")), { QN_HEDERA_TESTNET_URL: demo("hedera-testnet") });
  expect(/^0\.0\.2 /m.test(out), `unexpected output: ${out.trim()}`);
  return out.trim();
});
await check("Unichain Flashblocks (pending block), Unichain Sepolia", async () => {
  const out = await runOk(block("flashblocks", (t) => t.includes("Flashblocks")), { QUICKNODE_RPC_URL: unichainSepolia.rpcUrls.default.http[0] });
  const l = /latest (\d+)n? txs/.exec(out), p = /pending \(flashblock\) (\d+)n? txs/.exec(out);
  expect(!!l && !!p && BigInt(p[1]) >= BigInt(l[1]), `unexpected output: ${out.trim()}`);
  return out.trim().replace(/\n/g, ", ");
});
await check("WebSocket watchBlocks, Unichain (docs-demo wss)", async () => {
  const out = await runOk(block("websocket", (t) => t.includes("webSocket(")), { QUICKNODE_WSS_URL: "wss://docs-demo.unichain-mainnet.quiknode.pro/" },
    { waitFor: /(block \d+n? txs \d+[\s\S]*){2}/ });
  const n = (out.match(/^block \d+n? txs \d+$/gm) ?? []).length;
  if (n < 2) throw new Error(`WebSocket: saw ${n} blocks: ${out.trim().slice(-200)}`); // no blocks = connectivity, not a code bug
  return `${n} new blocks received`;
});

// ── 4. Streams filter + REST payloads (requests to api.quicknode.com are stubbed, never sent) ─────────────────────────
console.log("Streams / Webhooks REST scripts (api.quicknode.com stubbed):");
const stubbed = (out: string, path: string) => {
  const line = out.split("\n").find((l) => l.startsWith("STUB POST https://api.quicknode.com" + path));
  expect(!!line, `no POST to ${path}: ${out.trim().slice(-300)}`);
  return JSON.parse(line!.slice(line!.indexOf("{"))) as Record<string, any>;
};
await check("create-stream request + filter on real Unichain logs", async () => {
  const out = await runOk(block("create stream", (t) => t.includes("streams/rest/v1/streams")),
    { QN_API_KEY: "stub", WEBHOOK_URL: "https://example.com/webhook", TOKEN_ADDRESS: WETH }, { preload: "fetch-stub.mjs" });
  const body = stubbed(out, "/streams/rest/v1/streams");
  expect(body.network === "unichain-sepolia" && body.dataset === "logs" && body.destination === "webhook", `body: ${JSON.stringify(body).slice(0, 200)}`);
  const src = Buffer.from(body.filter_function, "base64").toString("utf8");
  const main = new Function(`${src}\nreturn main;`)() as (s: { data: unknown }) => { transfers: { tx: string; block: number; from: string; to: string }[] } | null;
  // Real logs from the last 20 Unichain mainnet blocks, wrapped like the "logs" dataset ({ data: [[...logs]] })
  const rpc = async (method: string, params: unknown[]) => {
    const r = await fetch(unichain.rpcUrls.default.http[0], { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return ((await r.json()) as { result: any }).result;
  };
  const latest = Number(await rpc("eth_blockNumber", []));
  const logs = await rpc("eth_getLogs", [{ fromBlock: "0x" + (latest - 19).toString(16), toBlock: "0x" + latest.toString(16) }]) as { address: string; topics: string[] }[];
  const want = logs.filter((l) => l.address.toLowerCase() === WETH.toLowerCase() && l.topics[0] === TRANSFER).length;
  const got = main({ data: [logs] });
  expect((got?.transfers.length ?? 0) === want, `filter returned ${got?.transfers.length ?? 0} transfers, expected ${want}`);
  if (got) expect(/^0x[0-9a-f]{40}$/.test(got.transfers[0].from) && got.transfers[0].block > 0, `bad transfer shape ${JSON.stringify(got.transfers[0])}`);
  expect(main({ data: [[]] }) === null, "filter should return null for an empty payload");
  return `${logs.length} logs -> ${want} WETH transfers matched; empty payload -> null`;
});
await check("webhook-from-template request", async () => {
  const out = await runOk(block("webhook template", (t) => t.includes("webhooks/template/evmWalletFilter")),
    { QN_API_KEY: "stub", WEBHOOK_URL: "https://example.com/webhook", WALLET: WETH }, { preload: "fetch-stub.mjs" });
  const body = stubbed(out, "/webhooks/rest/v1/webhooks/template/evmWalletFilter");
  expect(body.network === "worldchain-sepolia" && body.templateArgs?.wallets?.[0] === WETH && body.destination_attributes?.url, `body: ${JSON.stringify(body)}`);
  return "POST body has network, templateArgs.wallets, destination_attributes.url";
});

// ── 5. Webhook / Stream signature check (local server) ────────────────────────────────────────────────────────────
console.log("Signature verification server (recipes.md), run locally:");
await check("verify-webhook server", async () => {
  const port = await new Promise<number>((r) => { const s = createServer().listen(0, () => { const p = (s.address() as { port: number }).port; s.close(() => r(p)); }); });
  const secret = "qnsec_" + randomBytes(8).toString("hex");
  const file = block("signature server", (t) => t.includes("verifyQuickNodeSignature"));
  const p = spawn(process.execPath, ["--import", "tsx", file], { env: { ...process.env, QN_SECURITY_TOKEN: secret, PORT: String(port) } });
  let log = "";
  p.stdout.on("data", (d) => (log += d)); p.stderr.on("data", (d) => (log += d));
  try {
    for (let i = 0; i < 100 && !log.includes("listening"); i++) await new Promise((r) => setTimeout(r, 200));
    expect(log.includes("listening"), `server did not start: ${log.slice(-300)}`);
    const url = `http://127.0.0.1:${port}/webhook`;
    const payload = JSON.stringify({ data: [[{ address: WETH, topics: [TRANSFER] }]], metadata: { network: "unichain-sepolia" } });
    // Sign as QuickNode's docs describe: HMAC-SHA256(secret, nonce + timestamp + payload), hex
    const sign = (s: string, body: string, nonce: string, ts: string) => createHmac("sha256", s).update(nonce + ts + body).digest("hex");
    const nonce = randomBytes(16).toString("hex"), ts = String(Math.floor(Date.now() / 1000)), sig = sign(secret, payload, nonce, ts);
    const post = (body: Uint8Array<ArrayBuffer> | string, headers: Record<string, string>) =>
      fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body }).then((r) => r.status);
    const h = { "x-qn-nonce": nonce, "x-qn-timestamp": ts, "x-qn-signature": sig };
    const results = {
      valid: await post(payload, h),
      validGzip: await post(new Uint8Array(gzipSync(payload)), { ...h, "content-encoding": "gzip" }),
      tampered: await post(payload.replace("unichain", "worldchain"), h),
      wrongSecret: await post(payload, { ...h, "x-qn-signature": sign("other", payload, nonce, ts) }),
      shortSig: await post(payload, { ...h, "x-qn-signature": "abcd" }),
      missingHeaders: await post(payload, {}),
      get: (await fetch(url)).status,
    };
    const want = { valid: 200, validGzip: 200, tampered: 401, wrongSecret: 401, shortSig: 401, missingHeaders: 400, get: 404 };
    expect(JSON.stringify(results) === JSON.stringify(want), `got ${JSON.stringify(results)}, want ${JSON.stringify(want)}`);
    expect(log.includes("verified payload, top-level keys: [ 'data', 'metadata' ]"), `payload not logged: ${log.slice(-300)}`);
    return "valid 200, gzip 200, tampered 401, wrong secret 401, short signature 401, missing headers 400, GET 404";
  } catch (e) { throw e instanceof Real ? e : new Real(String((e as Error).message)); }
  finally { p.kill(); }
});

console.log(`\n${fails.length} failed, ${netFails.length} unreachable`);
process.exit(fails.length ? 1 : netFails.length ? 75 : 0);
