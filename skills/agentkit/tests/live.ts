// Live checks for the agentkit skill: the ViemWalletProvider route (recipes.md "other chains") on the sponsor testnets,
// plus the three framework adapters. No CDP/OpenAI keys, no funds, no transactions. Run by `npm run live`, which
// compiles this file and the skill's blocks with tsc (the decorator recipe needs emitDecoratorMetadata, which tsx lacks)
// and loads block-analytics.mjs first so AgentKit's analytics calls are answered locally, never sent to Coinbase.
//   1. the skill's recipe-9 block runs as written (throwaway PRIVATE_KEY) and its chain definitions are reused
//   2. per chain: RPC chain id; multicall3 code; AgentKit.from with wallet + erc20 + the skill's custom providers
//      (customActionProvider block and the @CreateAction decorator class); get_wallet_details reads the address and
//      balance over the public RPC; the custom signing action signs; the decorator actions are registered
//   3. Arc Testnet: ERC-20 get_balance of USDC 0x3600...0000 works with multicall3 (errors.md #9)
//   4. getLangChainTools / getVercelAITools / getMcpTools produce one tool per action; MCP toolHandler runs
//      get_wallet_details
//   5. the analytics stub caught AgentKit's analytics requests
// Exit 0 = pass, 1 = real failure, 75 = an RPC could not be reached.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AgentKit, ViemWalletProvider, erc20ActionProvider, walletActionProvider } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { getMcpTools } from "@coinbase/agentkit-model-context-protocol";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { createPublicClient, createWalletClient, http, type Chain } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { unichainSepolia, worldchainSepolia } from "viem/chains";

const NETWORK = 75;
const NET_RE = /HttpRequestError|TimeoutError|fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|UND_ERR|socket|took too long|rate.?limit|too many requests|\b429\b|\b50[0-4]\b/i;
const isNetwork = (e: unknown): boolean => {
  const x = e as any;
  if (NET_RE.test(`${x?.name} ${x?.code} ${x?.shortMessage} ${x?.message} ${x?.details} ${x?.status}`)) return true;
  return x?.cause ? isNetwork(x.cause) : false;
};
const failures: string[] = [];
let networkProblems = 0;
const check = async (label: string, fn: () => Promise<string> | string): Promise<boolean> => {
  try { console.log(`  ok   ${label}: ${await fn()}`); return true; }
  catch (e: any) {
    const msg = String(e?.shortMessage ?? e?.message ?? e).split("\n")[0];
    if (isNetwork(e)) { networkProblems++; console.log(`  net  ${label}: ${msg}`); }
    else { failures.push(label); console.log(`  FAIL ${label}: ${msg}`); }
    return false;
  }
};
const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };
// AgentKit actions return error text instead of throwing; turn that back into an error (network-classified if it is one)
const ok = (out: string, what: string) => {
  if (/^Error|Could not|Failed/i.test(out)) throw Object.assign(new Error(`${what}: ${out.slice(0, 200)}`), NET_RE.test(out) ? { name: "HttpRequestError" } : {});
  return out;
};

// Find a skill block (compiled into build/blocks/) by what it contains, so renumbering the skill doesn't break this.
const blocksDir = fileURLToPath(new URL("./blocks/", import.meta.url));
const findBlock = (...needles: string[]) => {
  const f = readdirSync(blocksDir).find((n) => n.endsWith(".js") && needles.every((s) => readFileSync(blocksDir + n, "utf8").includes(s)));
  if (!f) throw new Error(`no block in the skill contains ${needles.join(" + ")}`);
  return new URL(`./blocks/${f}`, import.meta.url).href;
};

console.log("Skill blocks");
let defs: any = {}, greetProvider: any, counterActionProvider: any;
await check("recipe 9 (ViemWalletProvider on other chains) runs as written", async () => {
  process.env.PRIVATE_KEY = generatePrivateKey(); // throwaway, never funded
  defs = await import(findBlock("new ViemWalletProvider", "defineChain"));
  assert(defs.arcTestnet && defs.zeroGTestnet && defs.whitechainSepolia && defs.hederaTestnetWithMulticall, "chain exports missing");
  return "ran; exports arcTestnet, zeroGTestnet, whitechainSepolia, hederaTestnetWithMulticall";
});
await check("custom action blocks load", async () => {
  ({ greetProvider } = await import(findBlock("customActionProvider", "sign_greeting")));
  ({ counterActionProvider } = await import(findBlock("CreateAction", "increment_counter")));
  assert(greetProvider && counterActionProvider, "exports missing");
  return "greetProvider, counterActionProvider";
});

const chains: Chain[] = [worldchainSepolia, unichainSepolia, defs.arcTestnet, defs.zeroGTestnet, defs.whitechainSepolia, defs.hederaTestnetWithMulticall].filter(Boolean);
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const ARC_USDC = "0x3600000000000000000000000000000000000000";

for (const chain of chains) {
  console.log(`${chain.name} (${chain.id})`);
  const rpc = createPublicClient({ chain, transport: http(undefined, { timeout: 30_000, retryCount: 2 }) });
  const reachable = await check("RPC chain id + multicall3", async () => {
    const id = await rpc.getChainId();
    assert(id === chain.id, `RPC says ${id}, chain object says ${chain.id}`);
    const code = await rpc.getCode({ address: MULTICALL3 });
    assert(code && code !== "0x", "no multicall3 code");
    return `${id}, multicall3 deployed`;
  });
  if (!reachable) continue;

  const account = privateKeyToAccount(generatePrivateKey());
  const walletProvider = new ViemWalletProvider(createWalletClient({ account, chain, transport: http(undefined, { timeout: 30_000, retryCount: 2 }) }));
  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders: [walletActionProvider(), erc20ActionProvider(), greetProvider, counterActionProvider()],
  });
  const actions = agentkit.getActions();
  const act = (suffix: string) => { const a = actions.find((x) => x.name.endsWith(suffix)); assert(a, `no action *${suffix}`); return a!; };

  await check("get_wallet_details", async () => {
    const out = ok(await act("get_wallet_details").invoke({}), "get_wallet_details");
    assert(out.includes(account.address), `address missing in: ${out.slice(0, 200)}`);
    assert(/Native Balance: 0\b/.test(out), `expected zero native balance in: ${out.slice(0, 300)}`);
    return `${account.address}, balance 0`;
  });
  await check("custom signing action (customActionProvider)", async () => {
    const out = ok(await act("sign_greeting").invoke({ name: "mumbai" }), "sign_greeting");
    assert(/Signed "gm mumbai": 0x[0-9a-f]{130}/.test(out), out.slice(0, 120));
    return "signed";
  });
  await check("decorator actions registered", () => {
    act("increment_counter"); act("read_counter");
    return `${actions.length} actions`;
  });
  if (chain.id === 5042002) {
    await check("ERC-20 get_balance of Arc USDC (multicall3)", async () => {
      const out = ok(await act("get_balance").invoke({ tokenAddress: ARC_USDC }), "get_balance");
      assert(/is 0\b/.test(out), out.slice(0, 200));
      return out.slice(0, 100);
    });
  }
  if (chain.id === worldchainSepolia.id) {
    await check("adapters: LangChain / Vercel AI SDK / MCP tools", async () => {
      const lc = await getLangChainTools(agentkit);
      const va = getVercelAITools(agentkit);
      const mcp = await getMcpTools(agentkit);
      const n = actions.length;
      assert(lc.length === n && Object.keys(va).length === n && mcp.tools.length === n, `actions ${n}, langchain ${lc.length}, vercel ${Object.keys(va).length}, mcp ${mcp.tools.length}`);
      const name = mcp.tools.find((t) => t.name.endsWith("get_wallet_details"))!.name;
      const res = JSON.stringify(await mcp.toolHandler(name, {}));
      assert(res.includes(account.address), `MCP toolHandler result: ${res.slice(0, 200)}`);
      return `${n} tools each; MCP ${name} returned the wallet`;
    });
  }
}

await check("analytics stub caught AgentKit's analytics calls", () => {
  const n = (globalThis as any).__analyticsBlocked as number | undefined ?? -1;
  assert(n >= 0, "block-analytics.mjs was not loaded");
  assert(n > 0, "no analytics calls intercepted: AgentKit may now send them another way; check before running again");
  return `${n} requests answered locally, none sent`;
});

if (failures.length) { console.log(`\n${failures.length} live check(s) failed: ${failures.join(", ")}`); process.exit(1); }
if (networkProblems) { console.log(`\n${networkProblems} check(s) could not reach a service`); process.exit(NETWORK); }
console.log("\nall live checks passed");
process.exit(0);
