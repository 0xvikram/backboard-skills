---
name: quicknode
description: "QuickNode is hosted RPC (HTTP + WebSocket) plus Streams, Webhooks and a testnet faucet for World Chain, Unichain, Hedera, Arc, 0G and 80+ other chains. Use this skill when you need a QuickNode endpoint URL, viem/ethers on QuickNode, eth_subscribe/WebSockets, Streams or Webhooks to your server (with X-QN-Signature HMAC checks), eth_getLogs limits, the QuickNode faucet, or free-plan credit and rate-limit errors."
license: MIT
metadata:
  category: "Dev infra & RPC"
  website: "https://quicknode.com"
  source: "tested"
  tested: "2026-10-19"
  packages: "viem@2.57.7, ethers@6.17.0, @quicknode/sdk@3.8.2"
---

# QuickNode

QuickNode gives you a private RPC endpoint (HTTP and WSS) per chain, plus push products: **Streams** (every block, filtered by your JS, sent to a webhook/S3/Postgres) and **Webhooks** (no-code templates such as "wallet activity"). Pick it when you need a reliable RPC with WebSockets for a sponsor chain, or want onchain events pushed to your backend without writing an indexer.
Do not pick it for heavy historical log scans on the free plan (`eth_getLogs` is capped at 5 blocks per call), or if a public RPC is enough for your demo.

## Quickstart

1. Sign up at https://www.quicknode.com/signup, open [Endpoints](https://dashboard.quicknode.com/endpoints), click **Create Endpoint**, pick the chain (for example **World Chain**), click **Continue**, pick the network (Mainnet or Sepolia/Testnet). ([World Chain quickstart](https://www.quicknode.com/docs/worldchain/quickstart))
2. Copy the **HTTP Provider** URL. It looks like `https://<name>.worldchain-sepolia.quiknode.pro/<token>/`. The token in the path is the secret. ([URL format](https://www.quicknode.com/guides/quicknode-products/how-to-use-multichain-endpoint))
3. Install: `npm i viem@2.57.7` and `npm i -D tsx`. Add `"type": "module"` to `package.json`.
4. `.env` (never commit it; never ship the URL to a browser unless you lock it down in the endpoint's Security tab):
   ```
   QUICKNODE_RPC_URL=https://<name>.worldchain-sepolia.quiknode.pro/<token>/
   ```
5. `index.ts`:
   ```ts
   import { createPublicClient, http, formatEther } from "viem";
   import { worldchainSepolia } from "viem/chains";

   const url = process.env.QUICKNODE_RPC_URL;
   if (!url) throw new Error("Set QUICKNODE_RPC_URL");

   const client = createPublicClient({ chain: worldchainSepolia, transport: http(url) });

   const [chainId, block, balance] = await Promise.all([
     client.getChainId(),
     client.getBlockNumber(),
     client.getBalance({ address: "0x4200000000000000000000000000000000000006" }),
   ]);
   console.log({ chainId, block, wethBalance: formatEther(balance) });
   ```
6. Run: `npx tsx --env-file=.env index.ts` (Node 20.6+). You should see `chainId: 4801`.
7. The free plan has **one endpoint**. Turn on **Multichain** on it to get a URL for every other chain with the same name and token ([guide](https://www.quicknode.com/guides/quicknode-products/how-to-use-multichain-endpoint)).

Full setup (ethers, WSS, API keys, faucet): [references/quickstart.md](references/quickstart.md).

## Common tasks

- [One endpoint, all sponsor chains, viem and ethers](references/recipes.md#1-one-endpoint-for-every-sponsor-chain-viem-and-ethers)
- [WebSockets: new blocks and contract events (eth_subscribe)](references/recipes.md#2-websockets-new-blocks-and-contract-events)
- [Webhooks: get a POST when a wallet moves funds](references/recipes.md#3-webhooks-get-a-post-when-a-wallet-is-active)
- [Verify X-QN-Signature on Streams and Webhooks payloads](references/recipes.md#4-verify-the-x-qn-signature-hmac)
- [Streams: token transfers to your webhook with a JS filter](references/recipes.md#5-streams-token-transfers-to-your-webhook)
- [eth_getLogs on the free plan (5-block chunks)](references/recipes.md#6-eth_getlogs-on-the-free-plan)
- [Token balances on sponsor chains, and Marketplace add-ons](references/recipes.md#7-token-balances-and-marketplace-add-ons)
- [Hedera Mirror Node REST and Unichain Flashblocks on QuickNode](references/recipes.md#8-chain-extras-hedera-mirror-node-and-unichain-flashblocks)
- [Errors, rate limits and credit gotchas](references/errors.md)
- [MCP server for Claude Code / Cursor](references/mcp.md)

## Free plan limits (check https://www.quicknode.com/pricing.md)

- 10M API credits, 15 requests/second, 1 endpoint, 1 active Stream, 1 active Webhook. The pricing page calls it a "Free trial" that "includes 1 month free", so sign up close to the event.
- `eth_getLogs`: max **5 blocks** per call on the free plan, 10,000 on paid plans ([source](https://www.quicknode.com/docs/worldchain/eth_getLogs)).
- Streams bill **per block processed**, even when your filter returns `null`. Webhooks bill 30 credits per delivered payload ([Streams billing](https://www.quicknode.com/docs/streams/billing), [Webhooks pricing](https://www.quicknode.com/docs/webhooks#pricing)).
- Admin API, trace/debug methods, JWT and referrer rules need the Build plan or higher.

## Before you write more code

- Read the docs index first: https://www.quicknode.com/llms.txt and https://www.quicknode.com/docs/llms.txt. Every docs page is Markdown if you add `.md` to its URL. Per-chain indexes: `https://www.quicknode.com/docs/<chain>/llms.txt` (`worldchain`, `unichain`, `hedera`, `arc`, `0g`).
- Use viem or ethers for RPC. **Do not copy `const { Core } = require('@quicknode/sdk')` from the chain quickstarts.** `@quicknode/sdk` v3 has no `Core`. It is now a client for the Admin, Streams, Webhooks, KV and SQL APIs ([SDK docs](https://www.quicknode.com/docs/sdk)). See [errors](references/errors.md#1-core-is-not-exported-by-quicknodesdk).
- Check versions first: `npm view viem version`, `npm view @quicknode/sdk version`.
- QuickNode also ships its own agent plugin (`/plugin marketplace add quicknode/agent-plugins`) ([docs](https://www.quicknode.com/docs/build-with-ai/build-web3-plugin)).
- **When this skill and the official docs disagree, the docs win.**

## At ETHGlobal Mumbai

- Sponsor chains: **World Chain, Unichain, Hedera, Arc and 0G** are supported (mainnet + testnet, HTTP + WSS, Streams, Webhooks). **Whitechain is not listed.** Chain IDs, URL slugs and sources: [references/chains.md](references/chains.md). For deeper chain facts: `npx skills add 0xvikram/backboard-skills --skill sponsor-chains`.
- May help with the World, Uniswap Foundation (Unichain), Hedera, Arc and 0G tracks, for example as the RPC, event feed or wallet-activity backend. Read the tracks and their rules yourself: https://ethglobal.com/events/mumbai/prizes
- Faucet: https://faucet.quicknode.com/drip. Of the sponsor chains, only **Unichain Sepolia** is listed (one claim per 12 hours per network).
- Help: QuickNode [Discord](https://discord.gg/quicknode), [support ticket](https://portal.usepylon.com/quicknode/forms/submit-a-support-ticket) (ticket support starts on the Build plan), [status page](https://status.quicknode.com).

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or QuickNode. Tested 2026-10-19 with viem@2.57.7, ethers@6.17.0, @quicknode/sdk@3.8.2.
