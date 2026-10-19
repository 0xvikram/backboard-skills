// Key-free live checks for the alchemy skill. Run after prep.mjs: npx tsx live.ts
// 1. Sponsor-chain reads: the skill's NETWORKS map (recipes.md §1) against each chain's PUBLIC RPC, with viem and ethers.
// 2. The skill's own scripts run against real Alchemy endpoints with a fake key: each must fail with the documented message.
// 3. The webhook receiver (recipes.md §6) runs locally: a correctly signed body is accepted, bad/missing signatures are not.
// Exit 0 = pass, 1 = real mismatch, 75 = only network/service trouble.
import { spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { createPublicClient, http } from "viem";
import { generatePrivateKey } from "viem/accounts";
import { AlchemyProvider, JsonRpcProvider, Network } from "ethers";
import { NETWORKS } from "./blocks/networks.js";

const TIMEOUT = 30_000;
const fails: string[] = [], netFails: string[] = [];
const NET_RE = /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|timed? ?out|socket hang up|HTTP 5\d\d|HTTP 429|status: 5\d\d|Status: 429|Too Many Requests|Bad Gateway|Service Unavailable|exceeded its compute units/i;
const expect = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg); };
const withTimeout = <T,>(p: Promise<T>) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timed out")), TIMEOUT))]);

async function check(name: string, fn: () => Promise<string>) {
  try { console.log(`  ok   ${name}: ${await withTimeout(fn())}`); }
  catch (e) {
    const msg = String((e as Error).message ?? e), first = msg.split("\n")[0];
    if (NET_RE.test(msg) && !(e as { real?: boolean }).real) { netFails.push(name); console.log(`  net  ${name}: ${first}`); }
    else { fails.push(name); console.log(`  FAIL ${name}: ${first}`); }
  }
}

// Find a skill block by its first-line comment ("// portfolio.ts — ...") or by a snippet of its text.
const files = readdirSync("blocks");
const block = (test: (text: string) => boolean, label: string) => {
  const f = files.find((f) => /^(SKILL|quickstart|recipes)-\d+\.ts$/.test(f) && test(readFileSync(`blocks/${f}`, "utf8")));
  if (!f) throw Object.assign(new Error(`no block for ${label} in the skill`), { real: true });
  return `blocks/${f}`;
};
const byHeader = (name: string) => block((t) => t.startsWith(`// ${name}`), name);

// Run a skill block with tsx and the given env; resolve with combined output and exit code.
function runBlock(file: string, env: Record<string, string>, args: string[] = []) {
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    const p = spawn(process.execPath, ["--import", "tsx", file, ...args], { env: { ...process.env, ...env } });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    const t = setTimeout(() => p.kill("SIGKILL"), TIMEOUT - 2000);
    p.on("close", (code) => { clearTimeout(t); resolve({ code, out }); });
  });
}
// The script must fail (not exit 0) and its output must contain `want`. Network trouble in the output -> "net".
async function expectFailure(file: string, env: Record<string, string>, want: RegExp) {
  const { code, out } = await runBlock(file, env);
  if (want.test(out)) { expect(code !== 0 || /\b401\b/.test(out), `exited ${code} with the right message`); return out.match(want)![0]; }
  if (NET_RE.test(out)) throw new Error(out.trim().split("\n").slice(-3).join(" | "));
  throw Object.assign(new Error(`expected ${want}, got: ${out.trim().split("\n").slice(-4).join(" | ")}`), { real: true });
}

// ── 1. Sponsor-chain reads over public RPCs ────────────────────────────────────────────────────────────────────────
console.log("Sponsor chains (recipes.md §1 NETWORKS, public RPCs, viem + ethers):");
const expectedIds: Record<string, number> = {
  "worldchain-mainnet": 480, "worldchain-sepolia": 4801, "unichain-mainnet": 130,
  "unichain-sepolia": 1301, "arc-mainnet": 5042, "arc-testnet": 5042002,
};
for (const [slug, chain] of Object.entries(NETWORKS)) {
  await check(slug, async () => {
    const url = chain.rpcUrls.default.http[0];
    const client = createPublicClient({ chain, transport: http(url, { retryCount: 2 }) });
    const [id, blockNum] = await Promise.all([client.getChainId(), client.getBlockNumber()]);
    expect(chain.id === expectedIds[slug], `viem chain id ${chain.id}, expected ${expectedIds[slug]}`);
    expect(id === chain.id, `RPC chainId ${id} != viem definition ${chain.id}`);
    await client.getBalance({ address: "0x4200000000000000000000000000000000000006" });
    const provider = new JsonRpcProvider(url, Network.from(chain.id), { staticNetwork: true });
    const ethersBlock = await provider.getBlockNumber();
    provider.destroy();
    expect(blockNum > 0n && ethersBlock > 0, `blocks ${blockNum}/${ethersBlock}`);
    return `chainId ${id}, block ${blockNum} (viem) / ${ethersBlock} (ethers) via ${url}`;
  });
}
Object.keys(expectedIds).forEach((s) => { if (!(s in NETWORKS)) { fails.push(`NETWORKS missing ${s}`); console.log(`  FAIL NETWORKS has no ${s}`); } });

// ── 2. Documented errors (errors.md) ───────────────────────────────────────────────────────────────────────────────
console.log("Documented errors, against real Alchemy endpoints with a fake key:");
const fake = { ALCHEMY_API_KEY: "invalidkey" };
await check("quickstart (viem) with a bad key -> Must be authenticated! (#1)", async () =>
  expectFailure(block((t) => t.includes("createPublicClient") && t.includes("worldchain-mainnet.g.alchemy.com/v2/"), "quickstart"), fake, /Must be authenticated!/));
await check("token-balances.ts with a bad key -> HTTP 401 (#1)", async () =>
  expectFailure(byHeader("token-balances.ts"), fake, /alchemy_getTokenBalances failed \(HTTP 401\): Must be authenticated!/));
await check("transfers.ts with a bad key -> HTTP 401 (#1)", async () =>
  expectFailure(byHeader("transfers.ts"), fake, /alchemy_getAssetTransfers failed \(HTTP 401\): Must be authenticated!/));
await check("nfts.ts with a bad key -> HTTP 401 (#1)", async () =>
  expectFailure(byHeader("nfts.ts"), fake, /getNFTsForOwner HTTP 401: .*Must be authenticated!/));
await check("portfolio.ts with a bad key -> HTTP 401 (#1)", async () =>
  expectFailure(byHeader("portfolio.ts"), fake, /Portfolio API HTTP 401: .*Must be authenticated!/));
await check("webhook-create.ts with a bad token -> 401 AuthError (#9)", async () =>
  expectFailure(byHeader("webhook-create.ts"), { ALCHEMY_WEBHOOK_AUTH_TOKEN: "invalidtoken" }, /401 .*Unauthenticated request\..*AuthError/s));
await check("sponsored.ts with a bad key -> Must be authenticated! (#1, #10)", async () =>
  expectFailure(byHeader("sponsored.ts"), { ...fake, PRIVATE_KEY: generatePrivateKey(), ALCHEMY_POLICY_ID: randomUUID() }, /Must be authenticated!/));
await check("sponsored.ts with a non-UUID policy -> Must be a valid UUID string (#10)", async () =>
  expectFailure(byHeader("sponsored.ts"), { ...fake, PRIVATE_KEY: generatePrivateKey(), ALCHEMY_POLICY_ID: "my-policy" }, /Must be a valid UUID string/));
await check("public World Chain URL rejects enhanced APIs (#3)", async () => {
  const res = await fetch("https://worldchain-mainnet.g.alchemy.com/public", {
    method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(TIMEOUT),
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "alchemy_getTokenBalances", params: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "erc20"] }),
  });
  if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!/Only core evm requests are allowed/.test(text)) throw Object.assign(new Error(`got HTTP ${res.status}: ${text.slice(0, 200)}`), { real: true });
  return "Only core evm requests are allowed.";
});
await check("ethers AlchemyProvider has no World Chain preset (#4)", async () => {
  let msg = "";
  try { new AlchemyProvider(480, "invalidkey"); } catch (e) { msg = (e as Error).message; }
  if (!/unsupported network/.test(msg)) throw Object.assign(new Error(`AlchemyProvider(480) did not throw "unsupported network" (got: ${msg || "no error"}); errors.md #4 is out of date`), { real: true });
  return "unsupported network";
});

// ── 3. Webhook receiver, local ─────────────────────────────────────────────────────────────────────────────────────
console.log("Webhook receiver (recipes.md §6), run locally:");
await check("webhook-server.ts signature checks", async () => {
  const port = await new Promise<number>((r) => { const s = createServer().listen(0, () => { const p = (s.address() as { port: number }).port; s.close(() => r(p)); }); });
  const key = "whsec_test";
  const p = spawn(process.execPath, ["--import", "tsx", byHeader("webhook-server.ts")], { env: { ...process.env, ALCHEMY_WEBHOOK_SIGNING_KEY: key, PORT: String(port) } });
  let log = "";
  p.stdout.on("data", (d) => (log += d)); p.stderr.on("data", (d) => (log += d));
  try {
    for (let i = 0; i < 100 && !log.includes("listening"); i++) await new Promise((r) => setTimeout(r, 200));
    expect(log.includes("listening"), `server did not start: ${log.slice(-300)}`);
    const url = `http://127.0.0.1:${port}/alchemy-webhook`;
    const body = JSON.stringify({
      webhookId: "wh_test", id: "whevt_test", createdAt: new Date().toISOString(), type: "ADDRESS_ACTIVITY",
      event: { network: "WORLDCHAIN_MAINNET", activity: [{ fromAddress: "0x1", toAddress: "0x2", value: 1.5, asset: "ETH", category: "external", hash: "0xabc", blockNum: "0x10" }] },
    });
    const sig = createHmac("sha256", key).update(body, "utf8").digest("hex");
    const post = (headers: Record<string, string>, b = body) => fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: b }).then((r) => r.status);
    const results = {
      signed: await post({ "x-alchemy-signature": sig }),
      badSig: await post({ "x-alchemy-signature": "00".repeat(32) }),
      noSig: await post({}),
      reserialized: await post({ "x-alchemy-signature": sig }, JSON.stringify(JSON.parse(body), null, 2)),
      get: (await fetch(url)).status,
    };
    const want = { signed: 200, badSig: 401, noSig: 401, reserialized: 401, get: 404 };
    expect(JSON.stringify(results) === JSON.stringify(want), `got ${JSON.stringify(results)}, want ${JSON.stringify(want)}`);
    expect(log.includes("WORLDCHAIN_MAINNET external ETH 1.5 0x1 -> 0x2 0xabc"), `event not logged: ${log.slice(-300)}`);
    return "signed 200, bad 401, missing 401, re-serialized body 401, GET 404, event parsed";
  } catch (e) { throw Object.assign(e as Error, { real: true }); }
  finally { p.kill(); }
});

console.log(`\n${fails.length} failed, ${netFails.length} unreachable`);
process.exit(fails.length ? 1 : netFails.length ? 75 : 0);
