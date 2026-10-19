---
name: namespace-53d629
description: "Namespace issues ENS subnames (alice.yourapp.eth): gasless offchain subnames through an API key, onchain L1/L2 subnames on Ethereum, Base or Optimism, plus resolution and React UI. Use when a hacker says Namespace, ENS subname, username.eth for users, claim a subname, mint L2 subname, offchain subname, @thenamespace/offchain-manager, mint-manager, ens-components, Resolvio, set ENS avatar/text/address records, or the ENS track."
license: MIT
metadata:
  category: "Identity & humans"
  website: "https://namespace.ninja"
  source: "tested"
  tested: "2026-10-19"
  packages: "@thenamespace/offchain-manager@1.0.13, @thenamespace/mint-manager@2.0.0, @thenamespace/indexer@1.0.2, @thenamespace/avatar@2.0.2, @thenamespace/ens-components@2.2.0, viem@2.57.7, wagmi@2.19.5"
---

# Namespace

Namespace lets the owner of an ENS name (say `yourapp.eth`) give out subnames like `alice.yourapp.eth`, with address, avatar and text records that any ENS-aware wallet or app can read.
Pick **offchain** subnames for gasless, instant names at signup (records live in Namespace's database and resolve through CCIP Read). Pick **onchain L2** (Base, Optimism) or **L1** subnames when the user must own the name as an NFT.
Skip it if you only need to *read* existing ENS names: plain viem `getEnsAddress` / `getEnsName` is enough.

**Namespace also publishes its own official skills** (https://github.com/thenamespace/skills), one per SDK, e.g. `npx skills add thenamespace/skills -s offchain-ens-subname-sdk`. Use them for SDK reference; this skill adds a tested hackathon quickstart, recipes and the gotchas found in testing. Full list: [references/mcp.md](references/mcp.md).

## Quickstart

Gasless offchain subname from a Node server (TypeScript, Node 22).

1. Get an ENS name you control. For testing, register one on Sepolia (https://sepolia.app.ens.domains).
2. In the Namespace App, Offchain section (https://app.namespace.ninja/offchain), connect the owner wallet, pick the name, open **Resolution**, click **Update resolver** then **Configure** (one-time, costs gas).
3. Same page, **API Keys** > **Create new key**, choose *Address based* or *Domain based*, copy it at once. Details: [references/quickstart.md](references/quickstart.md).
4. Install:
   ```sh
   npm i @thenamespace/offchain-manager@1.0.13 dotenv@17.4.2
   npm i -D tsx@4.23.15 typescript@7.0.2 @types/node@22
   ```
5. `.env` (server only, never in browser code): `NAMESPACE_API_KEY=<YOUR_NAMESPACE_API_KEY>` and `PARENT_NAME=<yourname.eth>`.
6. `src/quickstart.ts` (set `"type": "module"` in package.json):
   ```ts
   import 'dotenv/config';
   import { createOffchainClient, ChainName } from '@thenamespace/offchain-manager';

   const client = createOffchainClient({
     mode: 'sepolia', // 'mainnet' for a mainnet ENS name
     defaultApiKey: process.env.NAMESPACE_API_KEY!,
   });
   const parent = process.env.PARENT_NAME!;
   const label = process.argv[2] ?? 'alice';
   const owner = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // the user's wallet

   const { isAvailable } = await client.isSubnameAvailable(`${label}.${parent}`);
   if (!isAvailable) throw new Error('taken'); // createSubname would overwrite it

   await client.createSubname({
     label, parentName: parent, owner,
     addresses: [{ chain: ChainName.Ethereum, value: owner }],
     texts: [{ key: 'avatar', value: 'https://example.com/alice.png' }],
   });
   console.log(await client.getSingleSubname(`${label}.${parent}`));
   ```
7. Run `npx tsx src/quickstart.ts alice`. Check it resolves: https://sepolia.app.ens.domains/alice.yourname.eth, or viem ([recipe 6](references/recipes.md#6-resolve-any-name-with-viem)).

## Common tasks

- [Give every user a subname at signup (server API route)](references/recipes.md#1-give-every-user-a-subname-at-signup)
- [Set address, avatar, text records; upload an avatar image](references/recipes.md#2-set-or-change-records)
- [Find a user's name by wallet (owner / metadata filter)](references/recipes.md#3-find-names-by-owner-or-metadata)
- [Mint an onchain L2 subname with viem (Mint Manager)](references/recipes.md#4-mint-an-onchain-l1-or-l2-subname-with-viem)
- [Read minted L2 subnames (Indexer)](references/recipes.md#5-read-minted-l2-subnames-indexer)
- [Resolve any name with viem (offchain, L2, normal ENS)](references/recipes.md#6-resolve-any-name-with-viem)
- [Resolve profiles over HTTP with Resolvio (no key)](references/recipes.md#7-resolve-profiles-over-http-with-resolvio)
- [Drop-in React UI: ENS Components](references/recipes.md#8-drop-in-react-ui-ens-components)
- Errors and gotchas (several found in testing): [references/errors.md](references/errors.md)
- Sponsor chains: [references/chains.md](references/chains.md) · Docs MCP server and official skills: [references/mcp.md](references/mcp.md)

## Before you write more code

- For anything not covered here, read https://docs.namespace.ninja/llms.txt and open the linked page (add `.md` to any docs URL). Full corpus: https://docs.namespace.ninja/llms-full.txt.
- Check versions first: `npm view @thenamespace/offchain-manager version` and `npm view @thenamespace/mint-manager version`. Mint Manager 2.0.0 (Sep 2026) replaced the old flow with `checkName` + `prepareMint`; older blog posts show the old one.
- Keep API keys and private keys on the server. Use testnet (`mode: 'sepolia'`, `isTestnet: true`) while hacking.
- Some docs pages are behind the SDK (see errors.md). Type-check with `tsc`. When this skill and the official docs disagree, the docs win, unless the installed package's TypeScript types say otherwise.

## At ETHGlobal Mumbai

- Names live on Ethereum ENS (offchain or L1) or on Base / Optimism (L2). On sponsor chains, Namespace gives you **address records** a name points to, not the name itself: World Chain and Unichain are named in the SDK; the team says any EVM chain works through the default EVM address. Details and what is not confirmed: [references/chains.md](references/chains.md).
- May help with the ENS track (readable names for users, agents, payments), and with World, Uniswap Foundation or Hedera builds that want names for wallets. Check the rules yourself: https://ethglobal.com/events/mumbai/prizes
- Help: Namespace Builders on Telegram https://t.me/+OsziFgfuZz03NjEy (linked from the docs), docs https://docs.namespace.ninja

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or Namespace. Tested 2026-10-19 with @thenamespace/offchain-manager@1.0.13, @thenamespace/mint-manager@2.0.0, @thenamespace/indexer@1.0.2, @thenamespace/avatar@2.0.2, @thenamespace/ens-components@2.2.0, viem@2.57.7, wagmi@2.19.5.
