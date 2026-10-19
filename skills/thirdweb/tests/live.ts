// Key-free live checks for the thirdweb skill. Run: npx tsx live.ts
// - thirdweb@5.122.0 readContract / eth_blockNumber against the sponsor chains' public RPCs (defineChain({ id, rpc }))
// - eth_chainId of every public RPC listed in references/chains.md
// - built-in chain data the skill relies on (arcTestnet id, defineChain(id) RPC edge URL)
// - thirdweb's chain services API: the 4337 account-abstraction flag per chain, as tabled in references/chains.md
// Exit 0 = all good, 1 = a real mismatch, 75 = only network/service trouble (DNS, timeout, 5xx, rate limit).
import { createThirdwebClient, defineChain, getContract, readContract } from "thirdweb";
import { arcTestnet, getRpcUrlForChain } from "thirdweb/chains";
import { eth_blockNumber, getRpcClient } from "thirdweb/rpc";

const client = createThirdwebClient({ clientId: "placeholder-client-id" }); // no thirdweb service is called for reads below
const TIMEOUT = 20_000;
const fails: string[] = [], netFails: string[] = [];
const ok = (m: string) => console.log(`  ok   ${m}`);
const isNetwork = (e: unknown) =>
  /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|timed? ?out|aborted|socket|network|\b429\b|\b5\d\d\b|rate limit|Too Many Requests|Bad Gateway|Service Unavailable/i
    .test(String((e as Error)?.message ?? e) + String((e as { cause?: unknown })?.cause ?? ""));
const withTimeout = <T,>(p: Promise<T>) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timed out")), TIMEOUT))]);

async function check(name: string, fn: () => Promise<string>) {
  try { ok(`${name}: ${await withTimeout(fn())}`); }
  catch (e) {
    const msg = (e as Error).message?.split("\n")[0];
    if (isNetwork(e)) { netFails.push(name); console.log(`  net  ${name}: ${msg}`); }
    else { fails.push(name); console.log(`  FAIL ${name}: ${msg}`); }
  }
}
const expect = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg); };

async function rpc(url: string, method: string, params: unknown[] = []) {
  const res = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as { result?: string; error?: { message: string } };
  if (j.error) throw new Error(`RPC error: ${j.error.message}`);
  return j.result!;
}

// 1. USDC reads through the SDK (recipes.md #3 and chains.md "RPC read OK")
const usdcReads = [
  { name: "Base Sepolia", id: 84532, rpc: "https://sepolia.base.org", usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
  { name: "World Chain", id: 480, rpc: "https://worldchain-mainnet.g.alchemy.com/public", usdc: "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1" },
  { name: "Unichain", id: 130, rpc: "https://mainnet.unichain.org", usdc: "0x078D782b760474a361dDA0AF3839290b0EF57AD6" },
  { name: "Arc Testnet", id: 5042002, rpc: "https://rpc.testnet.arc.io", usdc: "0x3600000000000000000000000000000000000000" },
];
console.log("USDC reads via thirdweb readContract:");
for (const t of usdcReads) {
  await check(t.name, async () => {
    const chain = defineChain({ id: t.id, rpc: t.rpc });
    const block = await eth_blockNumber(getRpcClient({ client, chain }));
    const contract = getContract({ client, chain, address: t.usdc });
    const [symbol, decimals] = await Promise.all([
      readContract({ contract, method: "function symbol() view returns (string)", params: [] }),
      readContract({ contract, method: "function decimals() view returns (uint8)", params: [] }),
    ]);
    expect(block > 0n, `block number ${block}`);
    expect(symbol === "USDC" && decimals === 6, `expected USDC/6, got ${symbol}/${decimals}`);
    return `block ${block}, ${symbol} ${decimals} decimals`;
  });
}

// 2. Block number through the SDK on chains without a USDC check
console.log("Block numbers via thirdweb eth_blockNumber:");
for (const [name, id, url] of [
  ["0G Galileo", 16602, "https://evmrpc-testnet.0g.ai"],
  ["Hedera Testnet", 296, "https://testnet.hashio.io/api"],
  ["Whitechain Testnet (2625)", 2625, "https://rpc-testnet.whitechain.io"],
] as const) {
  await check(name, async () => {
    const block = await eth_blockNumber(getRpcClient({ client, chain: defineChain({ id, rpc: url }) }));
    expect(block > 0n, `block number ${block}`);
    return `block ${block}`;
  });
}

// 3. eth_chainId of every public RPC in chains.md
console.log("eth_chainId of the public RPCs in chains.md:");
for (const [id, url] of [
  [480, "https://worldchain-mainnet.g.alchemy.com/public"], [4801, "https://worldchain-sepolia.g.alchemy.com/public"],
  [130, "https://mainnet.unichain.org"], [1301, "https://sepolia.unichain.org"], [5042002, "https://rpc.testnet.arc.io"],
  [16661, "https://evmrpc.0g.ai"], [16602, "https://evmrpc-testnet.0g.ai"], [295, "https://mainnet.hashio.io/api"],
  [296, "https://testnet.hashio.io/api"], [1875, "https://rpc.whitechain.io"], [1874, "https://rpc.testnet.whitechain.io"],
  [2625, "https://rpc-testnet.whitechain.io"],
] as const) {
  await check(`${id} ${url}`, async () => {
    const got = Number(await rpc(url, "eth_chainId"));
    expect(got === id, `chainId ${got}, expected ${id}`);
    return `chainId ${got}`;
  });
}

// 4. Built-in chain data (recipes.md #6)
console.log("Built-in chain data:");
await check("arcTestnet built in", async () => { expect(arcTestnet.id === 5042002, `arcTestnet.id = ${arcTestnet.id}`); return "id 5042002"; });
await check("defineChain(480) uses the RPC edge", async () => {
  const url = getRpcUrlForChain({ client, chain: defineChain(480) });
  expect(url === "https://480.rpc.thirdweb.com/placeholder-client-id", `got ${url}`);
  return url;
});

// 5. thirdweb chain services: the "4337 AA" column of chains.md
console.log("thirdweb chain services (account-abstraction flag):");
const aa: Record<number, boolean | null> = {
  480: true, 4801: true, 130: false, 1301: false, 5042002: true, 16661: false, 16602: false,
  295: false, 296: false, 1875: false, 2625: false, 1874: null, // null = not in thirdweb's chain list
};
for (const [idStr, want] of Object.entries(aa)) {
  const id = Number(idStr);
  await check(`services ${id}`, async () => {
    const res = await fetch(`https://api.thirdweb.com/v1/chains/${id}/services`, { signal: AbortSignal.timeout(TIMEOUT) });
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as { error: string | null; data?: { services: { service: string; enabled: boolean }[] } };
    if (want === null) { expect(!j.data, `chain ${id} is now in thirdweb's chain list; update chains.md`); return "not in thirdweb's list (as documented)"; }
    const flag = j.data?.services.find((s) => s.service === "account-abstraction")?.enabled;
    expect(flag === want, `account-abstraction is ${flag}, chains.md says ${want ? "enabled" : "disabled"}`);
    return `account-abstraction ${flag ? "enabled" : "disabled"}`;
  });
}

console.log(`\n${fails.length} failed, ${netFails.length} unreachable`);
process.exit(fails.length ? 1 : netFails.length ? 75 : 0);
