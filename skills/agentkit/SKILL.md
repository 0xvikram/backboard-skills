---
name: agentkit
description: "Coinbase AgentKit gives an AI agent its own crypto wallet plus onchain tools (transfer, ERC-20, swap, faucet, price feeds) for LangChain, the Vercel AI SDK or an MCP server. Use when a hacker says AgentKit, @coinbase/agentkit, create-onchain-agent, onchain agent, AI agent wallet, CDP wallet for an agent, getLangChainTools, getVercelAITools, getMcpTools, action provider, request_faucet_funds, or wants an LLM agent that sends transactions."
license: MIT
metadata:
  category: "AI & agents"
  website: "https://docs.cdp.coinbase.com"
  source: "tested"
  tested: "2026-10-19"
  packages: "@coinbase/agentkit@0.10.4, @coinbase/agentkit-langchain@0.3.0, @coinbase/agentkit-vercel-ai-sdk@0.1.0, @coinbase/agentkit-model-context-protocol@0.2.0, create-onchain-agent@0.5.7, @langchain/core@0.3.80, @langchain/langgraph@0.4.10, @langchain/openai@0.6.17, ai@4.3.19, @ai-sdk/openai@1.3.24, @modelcontextprotocol/sdk@1.32.1, viem@2.38.3, zod@3.25.76"
---

# Coinbase AgentKit

AgentKit (TypeScript, from Coinbase Developer Platform) gives an LLM agent a wallet and a set of "actions" it can call as tools: check balance, send ETH or ERC-20, swap, faucet, Pyth prices, plus your own actions. Pick it for a server-side agent that does onchain things by itself.
Skip it if you only want Claude or Cursor to use *your* wallet (Coinbase now points to Wallet MCP / CDP MCP for that: https://docs.cdp.coinbase.com/ai-agents/overview), or for a browser dapp with user login (use a wallet SDK).
**Know this first:** the AgentKit pages were removed from docs.cdp.coinbase.com (old links 404, Oct 2026). The docs now live in the GitHub READMEs. The last npm release is 0.10.4 (Dec 2025); its plugins need the *older* LangChain 0.3, AI SDK 4 and zod 3. The pins below work together.

## Quickstart

1. Create keys in the CDP Portal: a **Secret API key** (https://portal.cdp.coinbase.com/api-keys/secret) and a **Wallet Secret** (https://portal.cdp.coinbase.com/wallets/non-custodial/security). You also need an OpenAI API key.
2. Install (Node 22+):
   ```sh
   npm init -y && npm pkg set type=module
   npm i @coinbase/agentkit@0.10.4 @coinbase/agentkit-langchain@0.3.0 @langchain/core@0.3.80 @langchain/langgraph@0.4.10 @langchain/openai@0.6.17 viem@2.38.3 zod@3.25.76 dotenv@17.2.3
   npm i -D tsx@4.23.15 typescript@5.9.3 @types/node@22
   ```
3. `.env`: `CDP_API_KEY_ID=<YOUR_CDP_API_KEY_ID>`, `CDP_API_KEY_SECRET=<YOUR_CDP_API_KEY_SECRET>`, `CDP_WALLET_SECRET=<YOUR_CDP_WALLET_SECRET>`, `OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>`. Later add `ADDRESS=<THE_PRINTED_ADDRESS>` to reuse the same wallet.
4. `agent.ts`:
   ```ts
   import "dotenv/config";
   import { AgentKit, CdpEvmWalletProvider, walletActionProvider, erc20ActionProvider, cdpApiActionProvider } from "@coinbase/agentkit";
   import { getLangChainTools } from "@coinbase/agentkit-langchain";
   import { createReactAgent } from "@langchain/langgraph/prebuilt";
   import { MemorySaver } from "@langchain/langgraph";
   import { ChatOpenAI } from "@langchain/openai";
   import { HumanMessage } from "@langchain/core/messages";

   const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
     networkId: "base-sepolia", // reads CDP_API_KEY_ID / CDP_API_KEY_SECRET / CDP_WALLET_SECRET
     address: process.env.ADDRESS as `0x${string}` | undefined, // omit: a new wallet is created
   });
   const agentkit = await AgentKit.from({
     walletProvider,
     actionProviders: [walletActionProvider(), erc20ActionProvider(), cdpApiActionProvider()],
   });
   const agent = createReactAgent({
     llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
     tools: await getLangChainTools(agentkit),
     checkpointSaver: new MemorySaver(),
     prompt: "You are an onchain agent on Base Sepolia. Get wallet details before your first action.",
   });
   console.log("Wallet:", walletProvider.getAddress());
   const res = await agent.invoke(
     { messages: [new HumanMessage("Get test ETH from the faucet, then tell me my balance.")] },
     { configurable: { thread_id: "demo" } },
   );
   console.log(res.messages.at(-1)?.content);
   ```
5. Run: `npx tsx agent.ts`. The agent calls `CdpApiActionProvider_request_faucet_funds` and `WalletActionProvider_get_wallet_details`.
6. Want a ready-made Next.js chat UI or an MCP server instead? `npm create onchain-agent@0.5.7` (see recipe 1; its Next.js build needs a one-line config fix).

Full walkthrough: [references/quickstart.md](references/quickstart.md).

## Common tasks

- [Scaffold a project with create-onchain-agent](references/recipes.md#1-scaffold-with-create-onchain-agent) (Next.js + LangChain or Vercel AI SDK, or MCP)
- [Pick and add action providers; call an action without an LLM](references/recipes.md#2-add-action-providers)
- [LangChain agent with memory (chat loop)](references/recipes.md#3-langchain-agent)
- [Vercel AI SDK: generateText + Next.js route](references/recipes.md#4-vercel-ai-sdk)
- [Custom action (your contract as a tool)](references/recipes.md#5-custom-action)
- [Testnet funds with the faucet action](references/recipes.md#6-testnet-funds-faucet)
- [Sponsor chains / any EVM chain with ViemWalletProvider](references/recipes.md#7-any-evm-chain-with-viemwalletprovider)
- [Python version (pointer only)](references/recipes.md#8-python-pointer)
- AgentKit as an MCP server for Claude Code / Cursor, plus the CDP docs MCP: [references/mcp.md](references/mcp.md)
- Errors and gotchas: [references/errors.md](references/errors.md) · Chains: [references/chains.md](references/chains.md)

## Before you write more code

- AgentKit docs now live on GitHub: https://github.com/coinbase/agentkit and the package README https://github.com/coinbase/agentkit/tree/main/typescript/agentkit (lists every action provider). `main` is ahead of npm (0.11.0, LangChain 1 / AI SDK 6 / zod 4, not published as of 19 Oct 2026), so if you read code on `main`, check it against what you installed. The 0.10.4 README ships inside `node_modules/@coinbase/agentkit/README.md`.
- For CDP keys, wallets and faucets: https://docs.cdp.coinbase.com/llms.txt (open the linked `.md` pages).
- Check versions first: `npm view @coinbase/agentkit version` and `npm view @coinbase/agentkit-langchain peerDependencies dependencies`. If a newer release has come out, the pins here may be outdated.
- Type-check with `tsc`. Some README snippets do not compile on 0.10.4 (errors.md #4). When this skill and the official docs disagree, the docs win, unless the installed package's types say otherwise.

## At ETHGlobal Mumbai

- AgentKit's own network list (Base, Ethereum, Arbitrum, Optimism, Polygon, Solana) has **none** of the sponsor chains. World Chain, Unichain, Hedera, Arc, 0G and Whitechain work only through `ViemWalletProvider` with your own private key; tested 19 Oct 2026 (reads + signing, no transactions). CDP server wallets and the faucet do not work there. Details: [references/chains.md](references/chains.md); deeper chain facts: `npx skills add 0xvikram/backboard-skills --skill sponsor-chains`.
- AgentKit may help with tracks that want an AI agent acting onchain, e.g. 0G, Arc, Hedera, World or Uniswap Foundation, on their chains via the viem route. Check the rules yourself: https://ethglobal.com/events/mumbai/prizes
- Help: CDP Discord https://discord.gg/CDP (linked from the AgentKit repo), issues https://github.com/coinbase/agentkit/issues

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or Coinbase. Tested 2026-10-19 with @coinbase/agentkit@0.10.4, @coinbase/agentkit-langchain@0.3.0, @coinbase/agentkit-vercel-ai-sdk@0.1.0, @coinbase/agentkit-model-context-protocol@0.2.0, create-onchain-agent@0.5.7, viem@2.38.3, zod@3.25.76.
