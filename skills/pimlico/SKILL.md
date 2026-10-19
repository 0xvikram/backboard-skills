---
name: pimlico
description: "Pimlico is ERC-4337 account abstraction infra (bundler + paymaster) used with permissionless.js and viem. Use when a hacker wants a smart account (Safe, Simple, Kernel), gasless or sponsored transactions, batched calls, paying gas in USDC (ERC-20 paymaster), a Pimlico API key, or AA on World Chain, Unichain or Arc."
license: MIT
metadata:
  category: "Wallets & onboarding"
  website: "https://pimlico.io"
  source: "tested"
  tested: "2026-10-19"
  packages: "permissionless@0.5.0, viem@2.57.7, dotenv@17.2.3"
---

# Pimlico

Pimlico runs ERC-4337 bundlers and paymasters on many EVM chains. With `permissionless.js` + `viem` you get a smart account for each user, send gasless (sponsored) transactions, batch several calls into one, or let users pay gas in USDC.
Pick it when users should not need native gas, or you want "approve + action" in one click. Skip it if a plain EOA wallet and normal transactions are enough, or if the chain is not on Pimlico's [supported chains](https://docs.pimlico.io/guides/supported-chains) list.

## Quickstart

1. Get an API key: [dashboard.pimlico.io](https://dashboard.pimlico.io/) > **API Keys** > **Create API key** ([guide](https://docs.pimlico.io/guides/create-api-key)). Testnet sponsorship is free.
2. Install (Node 20+, tested on Node 24; ESM project):
   ```bash
   npm init -y && npm pkg set type=module
   npm i --save-exact permissionless@0.5.0 viem@2.57.7 dotenv@17.2.3
   npm i -D tsx
   ```
3. Make a throwaway owner key, then fill `.env`:
   ```bash
   node --input-type=module -e "import { generatePrivateKey } from 'viem/accounts'; console.log(generatePrivateKey())"
   ```
   ```bash
   PIMLICO_API_KEY=<YOUR_API_KEY>
   PRIVATE_KEY=<TEST_OWNER_KEY>   # the key printed above; test funds only
   ```
4. `index.ts` (Safe account on Sepolia, gas paid by Pimlico):
   ```ts
   import "dotenv/config"
   import { createSmartAccountClient } from "permissionless"
   import { toSafeSmartAccount } from "permissionless/accounts"
   import { createPimlicoClient } from "permissionless/clients/pimlico"
   import { createPublicClient, http, type Hex } from "viem"
   import { entryPoint07Address } from "viem/account-abstraction"
   import { privateKeyToAccount } from "viem/accounts"
   import { sepolia } from "viem/chains"

   const pimlicoUrl = `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
   const publicClient = createPublicClient({ chain: sepolia, transport: http() })
   const pimlicoClient = createPimlicoClient({
     transport: http(pimlicoUrl),
     entryPoint: { address: entryPoint07Address, version: "0.7" },
   })
   const account = await toSafeSmartAccount({
     client: publicClient,
     owners: [privateKeyToAccount(process.env.PRIVATE_KEY as Hex)],
     entryPoint: { address: entryPoint07Address, version: "0.7" },
     version: "1.4.1",
   })
   const smartAccountClient = createSmartAccountClient({
     account,
     chain: sepolia,
     bundlerTransport: http(pimlicoUrl),
     paymaster: pimlicoClient, // sponsors gas
     userOperation: {
       estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
     },
   })
   const txHash = await smartAccountClient.sendTransaction({
     to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", value: 0n, data: "0x1234",
   })
   console.log(account.address, txHash)
   ```
5. Run: `npx tsx index.ts`. The first transaction also deploys the account (it is counterfactual until then).
6. Full version with explanations and a testnet explorer link: [references/quickstart.md](references/quickstart.md).

## Common tasks

- [Pick an account: Safe, Simple or Kernel](references/recipes.md#1-pick-a-smart-account-safe-simple-kernel)
- [Sponsored (gasless) transaction](references/recipes.md#2-sponsored-gasless-transaction)
- [Batch calls (approve + action in one op)](references/recipes.md#3-batch-several-calls)
- [Pay gas in USDC (ERC-20 paymaster)](references/recipes.md#4-pay-gas-in-usdc-erc-20-paymaster)
- [World Chain / Unichain / Arc testnets](references/recipes.md#5-world-chain-unichain-arc-testnets)
- [Limit spend with a sponsorship policy](references/recipes.md#6-limit-sponsorship-with-a-policy)
- [User's browser wallet as the owner](references/recipes.md#7-browser-wallet-as-the-owner)
- [Errors and fixes (AA21, AA25, 0x000 address, timeouts)](references/errors.md)
- [Pimlico CLI as an MCP server](references/mcp.md)

## Before you write more code

- For anything not covered here, read Pimlico's AI docs index first: https://docs.pimlico.io/llms.txt (every page also exists as `.md`, e.g. https://docs.pimlico.io/guides/tutorials/tutorial-1.md).
- permissionless.js reference: https://docs.pimlico.io/references/permissionless . viem account abstraction: https://viem.sh/account-abstraction
- Check versions: `npm view permissionless version` and `npm view viem version`. permissionless needs viem `^2.44.4` (peer dependency of 0.5.0). Do not copy v0.1 examples (`ENTRYPOINT_ADDRESS_V07`, `bundlerClient.sendUserOperation({ userOperation })`, `sponsorUserOperation` middleware) — that API is old.
- Check the per-chain account table before choosing Kernel: https://docs.pimlico.io/guides/supported-chains
- When this skill and the official docs disagree, the docs win.

## At ETHGlobal Mumbai

- Sponsor chains: World Chain, Unichain and Arc (mainnet + testnet) are on Pimlico's supported list. Hedera, 0G and Whitechain are not listed. Details, chain IDs and account limits: [references/chains.md](references/chains.md).
- May help with: tracks that reward smooth onboarding, gasless UX or smart accounts, and sponsor-chain tracks on World Chain, Unichain or Arc. Check the real list: https://ethglobal.com/events/mumbai/prizes
- Help: Pimlico Telegram https://t.me/pimlicoHQ (linked from their docs), support@pimlico.io.

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or Pimlico. Tested 2026-10-19 with permissionless@0.5.0, viem@2.57.7, dotenv@17.2.3.
