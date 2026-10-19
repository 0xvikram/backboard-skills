---
name: alchemy
description: "Alchemy is RPC and data-API infrastructure for EVM chains (World Chain, Unichain, Arc, Base, Ethereum and more). Use this skill when you need an Alchemy API key or RPC URL, viem/ethers on Alchemy, token balances, NFTs by owner, transfer/activity history (alchemy_getAssetTransfers), Address Activity webhooks, or gas sponsorship with Alchemy Wallet APIs."
license: MIT
metadata:
  category: "Dev infra & RPC"
  website: "https://alchemy.com"
  source: "tested"
  tested: "2026-10-19"
  packages: "viem@2.57.7, ethers@6.17.0, @alchemy/wallet-apis@5.3.0"
---

# Alchemy

Alchemy gives you RPC endpoints plus extra "enhanced" APIs (token balances, NFTs, transfer history, webhooks, gas sponsorship) over plain HTTP. Pick it when you want one API key for reads, indexing-style queries and push notifications without running your own indexer.
Do not pick it for custom event indexing across many contracts (use a real indexer), or if a public RPC is enough for your demo.

**Do not install `alchemy-sdk`.** Alchemy's own docs call it deprecated ([source](https://www.alchemy.com/docs/data-apis-with-cursor)). Account Kit is deprecated too ([source](https://www.alchemy.com/docs/wallets/account-kit-deprecated)). Use viem (or ethers) plus plain JSON-RPC/REST, and `@alchemy/wallet-apis` for smart wallets and gas sponsorship.

## Quickstart

1. Sign up at https://dashboard.alchemy.com/signup. New accounts get a default app. Otherwise go to **Apps → Create new app**, tick the chains you need (for example World Chain, Unichain, Arc), and copy the **API key** at the top right of the app page ([guide](https://www.alchemy.com/docs/create-an-api-key)).
2. The RPC URL is `https://<network>.g.alchemy.com/v2/<YOUR_API_KEY>`, for example `worldchain-mainnet`, `worldchain-sepolia`, `unichain-mainnet`, `unichain-sepolia`, `arc-mainnet` or `arc-testnet` ([all chains](https://www.alchemy.com/docs/reference/node-supported-chains)).
3. Install: `npm i viem@2.57.7` (and `npm i -D tsx` to run TypeScript).
4. Put the key in `.env` (never commit it, never ship it to the browser):
   ```
   ALCHEMY_API_KEY=<YOUR_API_KEY>
   ```
5. `index.ts`:
   ```ts
   import { createPublicClient, http, formatEther } from "viem";
   import { worldchain } from "viem/chains";

   const key = process.env.ALCHEMY_API_KEY;
   if (!key) throw new Error("Set ALCHEMY_API_KEY");

   const client = createPublicClient({
     chain: worldchain,
     transport: http(`https://worldchain-mainnet.g.alchemy.com/v2/${key}`),
   });

   const block = await client.getBlockNumber();
   const balance = await client.getBalance({ address: "0x4200000000000000000000000000000000000006" });
   console.log("World Chain block:", block, "balance:", formatEther(balance));
   ```
6. Run: `npx tsx --env-file=.env index.ts` (Node 20.6+). Add `"type": "module"` to `package.json` for top-level `await`.
7. Seeing `Must be authenticated!` means the key is wrong or missing. See [errors](references/errors.md).

Full setup, including Unichain/Arc and ethers: [references/quickstart.md](references/quickstart.md).

## Common tasks

- [RPC URL per network, viem and ethers clients](references/recipes.md#1-rpc-url-per-network-viem-and-ethers)
- [ERC-20 balances and metadata on one chain](references/recipes.md#2-erc-20-balances-on-one-chain)
- [Balances across several chains in one call (Portfolio API)](references/recipes.md#3-balances-across-chains-portfolio-api)
- [NFTs owned by a wallet](references/recipes.md#4-nfts-owned-by-a-wallet)
- [Transfer and activity history for an address](references/recipes.md#5-transfer-history-activity-feed)
- [Webhooks: get notified when an address sends or receives](references/recipes.md#6-address-activity-webhook)
- [Gas-sponsored transactions with Wallet APIs](references/recipes.md#7-gas-sponsored-transactions-wallet-apis)
- [Errors and gotchas](references/errors.md)
- [MCP server for Claude Code / Cursor](references/mcp.md)

## Before you write more code

- For anything not covered here, read the docs index first: https://www.alchemy.com/docs/llms.txt (sections: [chains](https://www.alchemy.com/docs/chains/llms.txt), [data](https://www.alchemy.com/docs/data/llms.txt), [wallets](https://www.alchemy.com/docs/wallets/llms.txt)). Any docs page can be fetched as Markdown by adding `.md` to its URL.
- Which API works on which chain changes often. Check https://dashboard.alchemy.com/chains before you rely on an enhanced API for World Chain, Unichain or Arc.
- Check versions before installing: `npm view viem version`, `npm view @alchemy/wallet-apis version`.
- Alchemy also publishes its own agent skills (`npx skills add alchemyplatform/skills`) and a CLI ([docs](https://www.alchemy.com/docs/alchemy-agent-skills)).
- **When this skill and the official docs disagree, the docs win.**

## At ETHGlobal Mumbai

- Sponsor chains: **World Chain, Unichain and Arc** are supported (mainnet and testnet RPC, webhooks, Wallet APIs gas sponsorship). Hedera, 0G and Whitechain are not listed. Details and sources: [references/chains.md](references/chains.md).
- May help with prize tracks that build on World Chain, Unichain or Arc (wallet dashboards, payment notifications, gasless onboarding). Check the tracks and their rules yourself: https://ethglobal.com/events/mumbai/prizes
- Help: support@alchemy.com or a ticket in the Alchemy Dashboard ([source](https://www.alchemy.com/docs/reference/world-chain-api-faq)). Alchemy's docs also point to its [Discord](https://discord.com/channels/735965332958871634/1115787488838033538) for tickets.
- Free tier limits (check [pricing](https://www.alchemy.com/docs/reference/pricing-plans)): 300 compute units per second, 5 webhooks, gas sponsorship free on testnets only.

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or Alchemy. Tested 2026-10-19 with viem@2.57.7, ethers@6.17.0, @alchemy/wallet-apis@5.3.0.
