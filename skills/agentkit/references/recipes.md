# AgentKit recipes

All code was type-checked on 2026-10-19 with @coinbase/agentkit@0.10.4, viem@2.38.3, zod@3.25.76 and the framework pins from quickstart.md. The official AgentKit docs pages on docs.cdp.coinbase.com are gone (404). Each recipe cites the GitHub README or source it follows. Source links point at the 0.10.4 release commit `433bdc2` because `main` is ahead of npm.

`SRC` below = `https://github.com/coinbase/agentkit/blob/433bdc262038eca2bea923d87dc26f8fb76337d9/typescript`

---

## 1. Scaffold with create-onchain-agent

**Goal:** a working Next.js chat app (LangChain or Vercel AI SDK) or an MCP server in one command.

```sh
npm create onchain-agent@0.5.7
```

The prompts it asks (tested): Project name → Framework (`Langchain`, `Vercel AI SDK`, `Model Context Protocol`) → Network family (EVM / SVM) → Network type (Mainnet / Testnet / **Custom Chain ID**) → Network (`base-sepolia` is the testnet default) → Wallet provider (`CDPSmartWallet` default, `CDPEvmWallet`, `Viem`, `Privy`).

Then for the Next.js templates:

```sh
cd onchain-agent
mv .env.local .env      # fill OPENAI_API_KEY, CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET
npm install
npm run dev             # http://localhost:3000
```

**Fix before `npm run build` / deploying to Vercel.** The generated Next.js 16 app fails `next build` with `Failed to collect page data for /api/agent ... TypeError: X is not a function` (GitHub issue #929). Mark AgentKit as a server external package in `next.config.js`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@coinbase/agentkit", "@coinbase/agentkit-langchain", "@coinbase/agentkit-vercel-ai-sdk"],
};

export default nextConfig;
```

Tested: without it the build fails, with it the build passes. The fix in the still-open PR #1024 (`@noble/*`, `@scure/*` only) was **not** enough for us: the build then failed with `r.PublicKey is not a constructor`.

Notes:
- Where the code is: `app/api/agent/prepare-agentkit.ts` (wallet + action providers), `app/api/agent/create-agent.ts` (LLM + agent), `app/api/agent/route.ts`.
- The Next template's `package.json` uses `"latest"` for the AgentKit packages and `^` ranges for the rest. Pin them once it works.
- Picking "Custom Chain ID" generates a `ViemWalletProvider` setup that reads `PRIVATE_KEY`, `CHAIN_ID`, `RPC_URL` (see recipe 7 for the sponsor chains).
- The CLI also installs an `agentkit` binary: `agentkit generate action-provider` (also `wallet-provider`, `prepare`, `create-agent`) for existing projects.

Source: https://github.com/coinbase/agentkit/tree/main/typescript/create-onchain-agent · https://www.npmjs.com/package/create-onchain-agent · issue https://github.com/coinbase/agentkit/issues/929 · PR https://github.com/coinbase/agentkit/pull/1024

---

## 2. Add action providers

**Goal:** choose which tools the agent gets, and call an action directly (no LLM) for scripts and tests.

```ts
import {
  AgentKit,
  CdpEvmWalletProvider,
  walletActionProvider,
  erc20ActionProvider,
  erc721ActionProvider,
  cdpApiActionProvider,
  cdpEvmWalletActionProvider,
  pythActionProvider,
  wethActionProvider,
  x402ActionProvider,
} from "@coinbase/agentkit";

const walletProvider = await CdpEvmWalletProvider.configureWithWallet({ networkId: "base-sepolia" });

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    walletActionProvider(), // get_wallet_details, native_transfer
    erc20ActionProvider(), // get_balance, transfer, approve, get_allowance, get_erc20_token_address
    erc721ActionProvider(), // mint, transfer, get_balance (NFTs)
    cdpApiActionProvider(), // request_faucet_funds
    cdpEvmWalletActionProvider(), // get_swap_price, swap, list/use_spend_permission (CDP EVM wallet only)
    pythActionProvider(), // fetch_price_feed, fetch_price
    wethActionProvider(), // wrap_eth (only on networks where AgentKit knows WETH)
    x402ActionProvider(), // pay for x402 APIs (Base and Solana networks only)
  ],
});

// Every action name is prefixed with the provider's class name:
console.log(agentkit.getActions().map((a) => a.name));
// e.g. WalletActionProvider_get_wallet_details, CdpApiActionProvider_request_faucet_funds

const details = agentkit.getActions().find((a) => a.name.endsWith("get_wallet_details"))!;
console.log(await details.invoke({}));
```

Notes:
- If you don't pass `actionProviders`, you get only `walletActionProvider()`.
- Providers that don't support the current network are dropped. `getActions()` logs `Warning: The following action providers are not supported on the current network...`. That is normal, e.g. `weth` on World Chain.
- In 0.10.4, `cdpApiActionProvider()` takes **no arguments**. Older README snippets pass `{ apiKeyId, apiKeySecret }`, which fails type-check. It reads keys from the CDP wallet provider, or from `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` env vars.
- 40+ providers ship (Across, Compound, Morpho, Moonwell, 0x, Sushi, Zora, OpenSea, Farcaster, Twitter, Superfluid, ENS-like Basenames, ...). Most are Base/Ethereum-only. Read each one's README before using it: `SRC/agentkit/src/action-providers/`.

Source: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#action-providers · `SRC/agentkit/src/agentkit.ts`

---

## 3. LangChain agent

**Goal:** a ReAct agent with memory that uses AgentKit actions as tools.

```ts
import "dotenv/config";
import { AgentKit, CdpEvmWalletProvider, walletActionProvider, cdpApiActionProvider } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

const walletProvider = await CdpEvmWalletProvider.configureWithWallet({ networkId: "base-sepolia" });
const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [walletActionProvider(), cdpApiActionProvider()],
});

const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
  tools: await getLangChainTools(agentkit),
  checkpointSaver: new MemorySaver(),
  prompt: "You are an onchain agent. Get wallet details before your first action.",
});

const config = { configurable: { thread_id: "user-123" } }; // same thread_id = same memory
const stream = await agent.stream(
  { messages: [new HumanMessage("What's my balance?")] },
  { ...config, streamMode: "values" },
);
for await (const state of stream) {
  const last = state.messages.at(-1);
  console.log(`[${last?.getType()}]`, last?.content); // "ai" = model, "tool" = action result
}
```

Install: `npm i @coinbase/agentkit-langchain@0.3.0 @langchain/core@0.3.80 @langchain/langgraph@0.4.10 @langchain/openai@0.6.17`.

Notes:
- `@coinbase/agentkit-langchain@0.3.0` (the latest on npm) is built on `@langchain/core` 0.3. With `@langchain/langgraph` 1.x you get `TS2322: Type 'StructuredTool<...>[]' is not assignable to type 'ToolNode<any> | (ServerTool | ClientTool)[]'` (tested).
- Any LangChain chat model works in place of `ChatOpenAI`, if its package is on `@langchain/core` 0.3.
- Older examples use `messageModifier`. LangGraph 0.4 calls it `prompt` (both still type-check).

Source: https://github.com/coinbase/agentkit/tree/main/typescript/framework-extensions/langchain · example https://github.com/coinbase/agentkit/tree/main/typescript/examples/langchain-cdp-chatbot

---

## 4. Vercel AI SDK

**Goal:** use AgentKit tools with `generateText` / `streamText` and serve them from a Next.js route.

```ts
import "dotenv/config";
import { AgentKit, CdpEvmWalletProvider, walletActionProvider, cdpApiActionProvider } from "@coinbase/agentkit";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const walletProvider = await CdpEvmWalletProvider.configureWithWallet({ networkId: "base-sepolia" }); // reads CDP_* env vars
const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [walletActionProvider(), cdpApiActionProvider()],
});

const { text } = await generateText({
  model: openai("gpt-4o-mini"),
  tools: getVercelAITools(agentkit),
  maxSteps: 10, // AI SDK 4: let the model call tools, then answer
  system: "You are an onchain agent on Base Sepolia.",
  prompt: "Request test ETH from the faucet, then tell me my balance.",
});
console.log(text);
```

Install: `npm i @coinbase/agentkit-vercel-ai-sdk@0.1.0 ai@4.3.19 @ai-sdk/openai@1.3.24`.

Next.js route (`app/api/agent/route.ts`), same pattern as the create-onchain-agent template. Build the agent once and reuse it, because each `configureWithWallet` without `address` makes a new wallet:

```ts
import { NextResponse } from "next/server";
import { generateText, type ToolSet } from "ai";
import { openai } from "@ai-sdk/openai";
import { AgentKit, CdpEvmWalletProvider, walletActionProvider } from "@coinbase/agentkit";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";

let tools: ToolSet | undefined;
async function getTools() {
  if (!tools) {
    const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
      networkId: "base-sepolia",
      address: process.env.ADDRESS as `0x${string}` | undefined,
    });
    tools = getVercelAITools(await AgentKit.from({ walletProvider, actionProviders: [walletActionProvider()] }));
  }
  return tools;
}

export async function POST(req: Request) {
  const { userMessage } = (await req.json()) as { userMessage: string };
  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    tools: await getTools(),
    maxSteps: 10,
    prompt: userMessage,
  });
  return NextResponse.json({ response: text });
}
```

Notes:
- `@coinbase/agentkit-vercel-ai-sdk@0.1.0` has the peer dependency `ai@^4.1.16`. With `ai@7`, `npm i` stops with `ERESOLVE`. Forcing it with `--legacy-peer-deps` then fails type-check (`'maxSteps' does not exist`). Stay on `ai@4`.
- Add the `serverExternalPackages` fix from recipe 1 before `next build`.

Source: https://github.com/coinbase/agentkit/tree/main/typescript/framework-extensions/vercel-ai-sdk · template `create-onchain-agent@0.5.7` `templates/next/app/api/agent/route.ts`

---

## 5. Custom action

**Goal:** expose your own contract call (or any function) as an agent tool.

**Option A: class + `@CreateAction` decorator** (the README way). Needs `"experimentalDecorators": true, "emitDecoratorMetadata": true` in tsconfig **and** compiling with `tsc`. tsx, esbuild, Next.js SWC and Bun don't emit decorator metadata, and it then fails at startup (errors.md #3).

```ts
import { z } from "zod"; // zod 3 (3.25.76)
import { ActionProvider, CreateAction, EvmWalletProvider, Network } from "@coinbase/agentkit";
import { encodeFunctionData, parseAbi } from "viem";

const COUNTER_ABI = parseAbi(["function increment()", "function number() view returns (uint256)"]);
const CounterSchema = z.object({
  contract: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Counter contract address"),
});

class CounterActionProvider extends ActionProvider<EvmWalletProvider> {
  constructor() {
    super("counter", []);
  }

  @CreateAction({
    name: "increment_counter",
    description: "Calls increment() on a Counter contract and returns the tx hash.",
    schema: CounterSchema,
  })
  async increment(walletProvider: EvmWalletProvider, args: z.infer<typeof CounterSchema>): Promise<string> {
    const hash = await walletProvider.sendTransaction({
      to: args.contract as `0x${string}`,
      data: encodeFunctionData({ abi: COUNTER_ABI, functionName: "increment" }),
    });
    await walletProvider.waitForTransactionReceipt(hash);
    return `Incremented. Tx: ${hash}`;
  }

  @CreateAction({
    name: "read_counter",
    description: "Reads number() from a Counter contract.",
    schema: CounterSchema,
  })
  async read(walletProvider: EvmWalletProvider, args: z.infer<typeof CounterSchema>): Promise<string> {
    const n = await walletProvider.readContract({
      address: args.contract as `0x${string}`,
      abi: COUNTER_ABI,
      functionName: "number",
    });
    return `Counter is ${n.toString()}`;
  }

  supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}

export const counterActionProvider = () => new CounterActionProvider();
// AgentKit.from({ walletProvider, actionProviders: [counterActionProvider(), ...] })
```

**Option B: `customActionProvider`, no decorators** (works under tsx, Next.js, Bun):

```ts
import { z } from "zod";
import { customActionProvider, EvmWalletProvider } from "@coinbase/agentkit";

export const greetProvider = customActionProvider<EvmWalletProvider>({
  name: "sign_greeting",
  description: "Signs a greeting message with the agent wallet.",
  schema: z.object({ name: z.string().describe("Who to greet") }),
  invoke: async (walletProvider: EvmWalletProvider, args: { name: string }) => {
    const sig = await walletProvider.signMessage(`gm ${args.name}`);
    return `Signed "gm ${args.name}": ${sig}`;
  },
});
```

Pass an array to `customActionProvider([...])` for several actions. For an action that needs no wallet, use `invoke: async (args) => ...`.

Notes:
- The action names become `CounterActionProvider_increment_counter` and `CustomActionProvider_sign_greeting`.
- Write clear `description` and `.describe()` texts, because the LLM reads them to decide when to call the tool.
- Return a string the model can read, including errors (`return "Error: ..."`). A thrown error ends the tool call.
- Tested: both options ran on World Chain Sepolia with a `ViemWalletProvider` (signing only, Option A compiled with tsc).

Source: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#creating-an-action-provider · `SRC/agentkit/src/action-providers/customActionProvider.ts` · `SRC/agentkit/src/action-providers/actionDecorator.ts`

---

## 6. Testnet funds (faucet)

**Goal:** fund the agent wallet for free on a testnet.

```ts
import "dotenv/config";
import { AgentKit, CdpEvmWalletProvider, cdpApiActionProvider, walletActionProvider } from "@coinbase/agentkit";

const walletProvider = await CdpEvmWalletProvider.configureWithWallet({ networkId: "base-sepolia" });
const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [cdpApiActionProvider(), walletActionProvider()],
});

const faucet = agentkit.getActions().find((a) => a.name.endsWith("request_faucet_funds"))!;
console.log(await faucet.invoke({ assetId: "eth" })); // or "usdc", "eurc", "cbbtc"
const details = agentkit.getActions().find((a) => a.name.endsWith("get_wallet_details"))!;
console.log(await details.invoke({}));
```

Or just tell the agent "get test ETH from the faucet".

Notes:
- The faucet action works **only** on `base-sepolia`, `ethereum-sepolia` (code) and `solana-devnet`. The action's own description tells the LLM only "base-sepolia or solana-devnet". On any other chain it returns `Faucet is only supported on base-sepolia or ethereum-sepolia evm networks.`
- CDP faucet limits per address per 24 h (from the faucet docs): ETH 1000 claims × 0.0001 ETH, USDC 10 × 1, EURC 10 × 1, cbBTC 100 × 0.0001. Check the current table: https://docs.cdp.coinbase.com/faucets/introduction/welcome
- With a non-CDP wallet (`ViemWalletProvider`) on Base Sepolia, the faucet still works if `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` are set. Otherwise: `Faucet requires CDP_API_KEY_ID and CDP_API_KEY_SECRET environment variables to be set.` (tested).
- No sponsor chain has a CDP faucet. Use that chain's own faucet and send funds to the agent's address.

Source: `SRC/agentkit/src/action-providers/cdp/cdpApiActionProvider.ts` · `SRC/agentkit/src/action-providers/cdp/faucetUtils.ts`

---

## 7. Any EVM chain with ViemWalletProvider

**Goal:** run the agent on a chain AgentKit doesn't list (all ETHGlobal Mumbai sponsor chains) with your own private key.

```ts
import "dotenv/config";
import { AgentKit, ViemWalletProvider, walletActionProvider, erc20ActionProvider } from "@coinbase/agentkit";
import { createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { worldchainSepolia, unichainSepolia, hederaTestnet } from "viem/chains";

// viem 2.38.3 (pinned by AgentKit 0.10.4) has no arcTestnet / zeroGTestnet / whitechainSepolia: define them.
// Declare multicall3, or the ERC-20 actions fail with "Could not fetch token details".
const multicall3 = { address: "0xcA11bde05977b3631167028862bE2a173976CA11" as const };

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } },
  contracts: { multicall3 },
  testnet: true,
});
export const zeroGTestnet = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc-testnet.0g.ai"] } },
  contracts: { multicall3 },
  testnet: true,
});
export const whitechainSepolia = defineChain({
  id: 1874,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WBT", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.whitechain.io"] } },
  contracts: { multicall3 },
  testnet: true,
});
// viem's hederaTestnet has no multicall3 entry
export const hederaTestnetWithMulticall = { ...hederaTestnet, contracts: { multicall3 } };

const client = createWalletClient({
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  chain: worldchainSepolia, // or unichainSepolia, arcTestnet, zeroGTestnet, whitechainSepolia, hederaTestnetWithMulticall
  transport: http(),
});
const walletProvider = new ViemWalletProvider(client);

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [walletActionProvider(), erc20ActionProvider()],
});
console.log(walletProvider.getNetwork(), agentkit.getActions().map((a) => a.name));
void unichainSepolia;
```

Then pass `agentkit` to `getLangChainTools` / `getVercelAITools` / `getMcpTools` as usual.

Notes:
- Tested 2026-10-19 on World Chain Sepolia (4801), Arc Testnet (5042002), 0G Galileo (16602), Whitechain Sepolia (1874), Hedera Testnet (296): `get_wallet_details` read the balance over the public RPC, and a custom signing action ran. ERC-20 `get_balance` of Arc's USDC (`0x3600000000000000000000000000000000000000`) worked **with** multicall3 and failed **without** it. multicall3 has code at `0xcA11...CA11` on all six sponsor testnets (checked with `eth_getCode`). No transactions were sent.
- `getNetwork()` returns `networkId: undefined` on these chains (only `chainId` is set). Providers keyed on `networkId` (weth, x402, most DeFi ones) are dropped. `walletActionProvider`, `erc20ActionProvider`, `erc721ActionProvider`, `pythActionProvider` and your custom actions stay.
- Keep `viem` at `2.38.3` in your project. With a newer viem, `new ViemWalletProvider(client)` fails type-check (errors.md #2).
- If `RPC_URL` is set in the environment, `ViemWalletProvider` reads through it instead of the chain's RPC (`new ViemWalletProvider(client, { rpcUrl })` overrides it). Don't leave a Base `RPC_URL` set while on World Chain.
- Use a fresh key holding only test funds. The key sits in your server env.

Source: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#viemwalletprovider · `create-onchain-agent@0.5.7` template `prepareAgentkit/agentkit/customEvm/viem/prepareAgentkit.ts` · `SRC/agentkit/src/wallet-providers/viemWalletProvider.ts` · issue https://github.com/coinbase/agentkit/issues/1533 (multicall3)

---

## 8. Python pointer

There is a Python AgentKit (`coinbase-agentkit` on PyPI, 0.7.4 as of 19 Oct 2026; scaffold with `pipx run create-onchain-agent`, needs Python 3.10+ and Poetry). Not tested here. Issue #1485 reports that a fresh `pip install coinbase-agentkit` fails on import (`No module named 'solana.rpc.api'`), worked around with `pip install "solana==0.36.1"`. Start from https://github.com/coinbase/agentkit/tree/main/python and check that issue: https://github.com/coinbase/agentkit/issues/1485
