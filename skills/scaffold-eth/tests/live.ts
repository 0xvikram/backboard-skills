// Key-free live checks with viem 2.53.1 (the version the create-eth@2.0.23 template pins), driven by the skill's own
// blocks: every chain and RPC the skill tells people to use must answer with the right chain ID.
// Exit 0 = all good, 1 = the skill is wrong somewhere, 75 = a service could not be reached (reported as "network").
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createPublicClient, erc20Abi, http, parseAbiItem, type Chain } from "viem";
import * as chains from "viem/chains";

const BLOCKS = fileURLToPath(new URL("./blocks", import.meta.url));
const blocks = readdirSync(BLOCKS).sort().map((f) => ({ file: f, text: readFileSync(join(BLOCKS, f), "utf8") }));
const find = (re: RegExp, what: string) => {
  const b = blocks.find((x) => re.test(x.text));
  if (!b) throw new Error(`no block with ${what}`);
  return b;
};

let failed = 0, network = 0;
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string) => { failed++; console.log(`  ✗ ${msg}`); };
const note = (msg: string) => console.log(`  · ${msg}`);
const isNetwork = (e: unknown) => {
  const s = `${(e as Error)?.name} ${(e as Error)?.message} ${(e as { details?: string })?.details ?? ""} ${(e as { status?: number })?.status ?? ""}`;
  return /HttpRequestError|TimeoutError|timed out|fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|socket|network|\b(429|5\d\d)\b|rate limit|Service Unavailable|Bad Gateway/i.test(s);
};
const short = (e: unknown) => ((e as { shortMessage?: string }).shortMessage || (e as Error).message || String(e)).split("\n")[0];
async function check(label: string, fn: () => Promise<string | void>) {
  try { const m = await fn(); ok(m ? `${label}: ${m}` : label); }
  catch (e) {
    if (isNetwork(e)) { network++; console.log(`  ~ ${label}: unreachable (${short(e)})`); }
    else bad(`${label}: ${short(e)}`);
  }
}
const client = (chain: Chain, url?: string) => createPublicClient({ chain, transport: http(url, { timeout: 20_000, retryCount: 2 }) });
const viemChain = (name: string) => {
  const c = (chains as Record<string, unknown>)[name] as Chain | undefined;
  if (!c?.id) throw new Error(`viem/chains has no export "${name}"`);
  return c;
};
async function expectChain(chain: Chain, url: string | undefined, expectedId: number) {
  const c = client(chain, url);
  const [id, block] = await Promise.all([c.getChainId(), c.getBlockNumber()]);
  if (id !== expectedId) throw new Error(`chain ID ${id}, expected ${expectedId}`);
  if (block <= 0n) throw new Error(`block number ${block}`);
  return `chainId ${id}, block ${block}`;
}

// 1. chains.md snippet: the six sponsor testnets with the Arc rpcOverride, exactly as scaffold.config.ts would use them.
const snippet = find(/^\s*targetNetworks:\s*\[/, "the targetNetworks snippet");
const targetNames = [...snippet.text.split("rpcOverrides")[0].matchAll(/chains\.(\w+)/g)].map((m) => m[1]);
const overrides = Object.fromEntries([...snippet.text.matchAll(/\[chains\.(\w+)\.id\]:\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));
// Chain IDs the skill documents next to each chain in recipe 4a (e.g. `chains.worldchainSepolia, // 4801`).
const config = find(/const scaffoldConfig\s*=/, "scaffold.config.ts");
const documented = Object.fromEntries([...config.text.matchAll(/chains\.(\w+),\s*\/\/\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
console.log(`sponsor testnets from ${snippet.file} (${targetNames.length}), IDs from ${config.file}:`);
if (targetNames.length !== 6) bad(`expected six sponsor testnets in ${snippet.file}, found ${targetNames.length}`);
for (const name of targetNames) {
  let chain: Chain;
  try { chain = viemChain(name); } catch (e) { bad(short(e)); continue; }
  if (documented[name] === undefined) bad(`${name}: no documented chain ID in ${config.file}`);
  else if (documented[name] !== chain.id) bad(`${name}: skill says ${documented[name]}, viem 2.53.1 says ${chain.id}`);
  const url = overrides[name] ?? chain.rpcUrls.default.http[0];
  await check(`${name} (${chain.id}) via ${url}${overrides[name] ? " [rpcOverride]" : ""}`, () => expectChain(chain, url, documented[name] ?? chain.id));
}

// The Arc override exists because viem 2.53.1's default Arc testnet RPC stopped answering (errors.md). Informational.
{
  const url = chains.arcTestnet.rpcUrls.default.http[0];
  try { await expectChain(chains.arcTestnet, url, chains.arcTestnet.id); note(`viem's default Arc testnet RPC ${url} answers again; the rpcOverride is now optional`); }
  catch (e) { note(`viem's default Arc testnet RPC ${url} still fails (${short(e)}), so the rpcOverride is still needed`); }
}

// 2. Recipe 4b: Arc mainnet via the skill's own defineChain block.
const custom = find(/defineChain\(/, "defineChain");
const mod = (await import(pathToFileURL(join(BLOCKS, custom.file)).href)) as Record<string, Chain>;
const arcMainnet = Object.values(mod).find((v) => v && typeof v === "object" && "id" in v);
if (!arcMainnet) bad(`${custom.file} exports no chain`);
else await check(`${custom.file} ${arcMainnet.name} (${arcMainnet.id}) via ${arcMainnet.rpcUrls.default.http[0]}`, () => expectChain(arcMainnet, undefined, 5042));

// 3. Recipe 4c: every Hardhat network URL answers with the chain ID of the viem chain of the same name.
const hh = find(/^\s*\w+:\s*\{\s*type:\s*"http"/m, "the Hardhat networks");
console.log(`Hardhat network URLs from ${hh.file}:`);
for (const [, name, url] of hh.text.matchAll(/(\w+):\s*\{\s*type:\s*"http",\s*url:\s*"([^"]+)"/g)) {
  let chain: Chain;
  try { chain = viemChain(name); } catch { bad(`${name}: Hardhat network name has no matching viem chain`); continue; }
  await check(`${name} via ${url}`, () => expectChain(chain, url, chain.id));
}

// 4. Recipe 6: the WETH predeploy external contract on World Chain Sepolia, and the 100-block eth_getLogs cap.
const ext = find(/const externalContracts\s*=/, "externalContracts");
const extChain = Number(ext.text.match(/^\s*(\d+):\s*\{/m)?.[1]);
const wethAddr = ext.text.match(/address:\s*"(0x[0-9a-fA-F]{40})"/)?.[1] as `0x${string}` | undefined;
const deployedOnBlock = BigInt(ext.text.match(/deployedOnBlock:\s*(\d+)/)?.[1] ?? "0");
console.log(`external contract from ${ext.file}:`);
if (extChain !== chains.worldchainSepolia.id || !wethAddr) bad(`${ext.file}: expected WETH on ${chains.worldchainSepolia.id}, got chain ${extChain}, address ${wethAddr}`);
else {
  const wc = client(chains.worldchainSepolia);
  await check(`WETH ${wethAddr} on ${extChain}`, async () => {
    const [symbol, decimals, supply, head] = await Promise.all([
      wc.readContract({ address: wethAddr, abi: erc20Abi, functionName: "symbol" }),
      wc.readContract({ address: wethAddr, abi: erc20Abi, functionName: "decimals" }),
      wc.readContract({ address: wethAddr, abi: erc20Abi, functionName: "totalSupply" }),
      wc.getBlockNumber(),
    ]);
    if (symbol !== "WETH" || decimals !== 18) throw new Error(`symbol ${symbol}, decimals ${decimals}`);
    if (deployedOnBlock > head) throw new Error(`deployedOnBlock ${deployedOnBlock} is in the future (head ${head})`);
    return `symbol ${symbol}, decimals ${decimals}, totalSupply ${supply}, deployedOnBlock ${deployedOnBlock} <= head ${head}`;
  });
  const frag = blocks.find((x) => /blocksBatchSize:\s*\d+/.test(x.text));
  const batch = BigInt(frag?.text.match(/blocksBatchSize:\s*(\d+)/)?.[1] ?? "100");
  const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
  await check(`eth_getLogs over ${batch} blocks (blocksBatchSize in ${frag?.file}) on the default World Chain Sepolia RPC`, async () => {
    const head = await wc.getBlockNumber();
    const logs = await wc.getLogs({ address: wethAddr, event: transfer, fromBlock: head - batch + 1n, toBlock: head });
    return `${logs.length} Transfer logs`;
  });
  try {
    const head = await wc.getBlockNumber();
    await wc.getLogs({ address: wethAddr, event: transfer, fromBlock: head - 499n, toBlock: head });
    note("a 500-block eth_getLogs range now works on World Chain Sepolia; the blocksBatchSize: 100 advice is no longer needed");
  } catch (e) { note(`a 500-block range (the hook's default) still fails: ${short(e)}`); }
}

// 5. Verification support claimed in chains.md / recipe 5 (public, key-free GETs).
async function getJson(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (r.status === 429 || r.status >= 500) throw Object.assign(new Error(`HTTP ${r.status}`), { name: "HttpRequestError" });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json() as Promise<unknown>;
}
await check("Sourcify supports all six sponsor testnets (4801, 1301, 5042002, 296, 16602, 1874)", async () => {
  const list = (await getJson("https://sourcify.dev/server/chains")) as { chainId: number; supported?: boolean }[];
  const ids = new Set(list.filter((c) => c.supported !== false).map((c) => Number(c.chainId)));
  const missing = [4801, 1301, 5042002, 296, 16602, 1874].filter((id) => !ids.has(id));
  if (missing.length) throw new Error(`missing ${missing.join(", ")}`);
});
await check("Etherscan V2 chainlist has 480, 4801, 130, 1301, 5042", async () => {
  const body = (await getJson("https://api.etherscan.io/v2/chainlist")) as { result?: { chainid: string }[] };
  const ids = new Set((body.result ?? []).map((c) => Number(c.chainid)));
  const missing = [480, 4801, 130, 1301, 5042].filter((id) => !ids.has(id));
  if (missing.length) throw new Error(`missing ${missing.join(", ")}`);
});

// 6. Informational: is the pinned create-eth still the latest?
try {
  const latest = ((await getJson("https://registry.npmjs.org/create-eth/latest")) as { version: string }).version;
  note(`create-eth latest on npm: ${latest} (the skill pins 2.0.23${latest === "2.0.23" ? ", up to date" : "; re-check the template before bumping"})`);
} catch { /* informational only */ }

console.log(`\nlive: ${failed} failed, ${network} unreachable`);
process.exit(failed ? 1 : network ? 75 : 0);
