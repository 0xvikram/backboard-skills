---
name: safe
description: "Safe (Safe{Wallet}, formerly Gnosis Safe) is the standard multisig smart account, with the Safe{Core} SDK (Protocol Kit, API Kit, Relay Kit). Use when a hacker wants a multisig or treasury, to create/deploy a Safe or predict its address, propose/confirm/execute multisig transactions, batch calls, a Safe ERC-4337 smart account with sponsored gas (Safe4337Pack), or a dApp that runs as a Safe App."
license: MIT
metadata:
  category: "Wallets & onboarding"
  website: "https://safe.global"
  source: "tested"
  tested: "2026-10-19"
  packages: "@safe-global/protocol-kit@8.0.8, @safe-global/api-kit@5.0.4, @safe-global/relay-kit@6.1.2, @safe-global/types-kit@4.0.1, viem@2.57.7, dotenv@17.2.3, @safe-global/safe-apps-sdk@9.1.0, @safe-global/safe-apps-provider@0.18.6, wagmi@3.7.7"
---

# Safe

Safe is a smart contract account owned by one or more keys with an M-of-N threshold. The Safe{Core} SDK lets you deploy Safes, build and sign Safe transactions, share them between owners through the Safe Transaction Service, and run a Safe as an ERC-4337 account.
Pick it for team treasuries, DAO or agent wallets that need human approval, "N owners must agree" flows, or batching calls. Skip it if one EOA is enough. For gasless single-owner onboarding only, a plain 4337 SDK (see the `pimlico` skill) is less code.

## Quickstart

1. Node 20+ (the SDK declares `engines: node >=20`). ESM project:
   ```bash
   npm init -y && npm pkg set type=module
   npm i --save-exact @safe-global/protocol-kit@8.0.8 @safe-global/api-kit@5.0.4 @safe-global/types-kit@4.0.1 viem@2.57.7 dotenv@17.2.3
   npm i -D tsx
   ```
2. Make a throwaway test key and put it in `.env` (test funds only):
   ```bash
   node --input-type=module -e "import { generatePrivateKey } from 'viem/accounts'; console.log(generatePrivateKey())"
   ```
   ```bash
   PRIVATE_KEY=<TEST_OWNER_KEY>
   SAFE_API_KEY=<YOUR_SAFE_API_KEY>   # only needed for API Kit (recipes 2 and 7)
   ```
3. `index.ts`: predict a 1-of-1 Safe on Sepolia and deploy it with `DEPLOY=1`:
   ```ts
   import "dotenv/config"
   import Safe from "@safe-global/protocol-kit"
   import { createPublicClient, http } from "viem"
   import { privateKeyToAccount } from "viem/accounts"
   import { sepolia } from "viem/chains"

   const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`
   const RPC_URL = sepolia.rpcUrls.default.http[0]
   const owner = privateKeyToAccount(PRIVATE_KEY)

   const protocolKit = await Safe.init({
     provider: RPC_URL,
     signer: PRIVATE_KEY,
     predictedSafe: { safeAccountConfig: { owners: [owner.address], threshold: 1 } },
   })
   const safeAddress = await protocolKit.getAddress()
   console.log("Safe address:", safeAddress, "deployed:", await protocolKit.isSafeDeployed())

   if (process.env.DEPLOY === "1" && !(await protocolKit.isSafeDeployed())) {
     const deployTx = await protocolKit.createSafeDeploymentTransaction()
     const wallet = await protocolKit.getSafeProvider().getExternalSigner()
     const hash = await wallet!.sendTransaction({
       to: deployTx.to as `0x${string}`,
       value: BigInt(deployTx.value),
       data: deployTx.data as `0x${string}`,
       chain: sepolia,
     })
     await createPublicClient({ chain: sepolia, transport: http(RPC_URL) }).waitForTransactionReceipt({ hash })
     const safe = await protocolKit.connect({ safeAddress })
     console.log("Deployed. Owners:", await safe.getOwners())
   }
   ```
4. Run `npx tsx index.ts` (prints the address, no gas needed). Fund the owner with Sepolia ETH, then `DEPLOY=1 npx tsx index.ts`.
5. Open the Safe at https://app.safe.global (choose Sepolia) to see it in the UI.
6. Full version, API key steps and a 2-of-3 setup: [references/quickstart.md](references/quickstart.md).

## Common tasks

- [Create a multisig and predict its address on many chains](references/recipes.md#1-create-a-multisig-and-predict-its-address)
- [Propose, confirm and execute a multisig tx (Protocol Kit + API Kit)](references/recipes.md#2-propose-confirm-execute-with-the-transaction-service)
- [Collect signatures without the Transaction Service](references/recipes.md#3-sign-and-execute-without-the-transaction-service)
- [Batch several calls into one Safe transaction](references/recipes.md#4-batch-calls)
- [Safe as an ERC-4337 smart account, sponsored gas (Safe4337Pack)](references/recipes.md#5-safe-as-a-4337-smart-account-with-sponsored-gas)
- [Run your dApp as a Safe App (Safe Apps SDK, wagmi `safe()`)](references/recipes.md#6-your-dapp-as-a-safe-app)
- [Read Safes, owners, queue and history](references/recipes.md#7-read-safes-and-history-from-the-transaction-service)
- [Errors and fixes](references/errors.md)

## Before you write more code

- Read the Safe docs AI index first: https://docs.safe.global/llms.txt (site index: https://safe.global/llms.txt). SDK guides: https://docs.safe.global/sdk/overview . Reference: https://docs.safe.global/reference-sdk-protocol-kit/overview
- Check versions: `npm view @safe-global/protocol-kit version` (and api-kit, relay-kit). Protocol Kit 8 / API Kit 5 / Relay Kit 6 changed types (bigint `chainId`, `0x${string}` addresses). Some doc snippets are older and do not type-check; see [references/errors.md](references/errors.md).
- Is my chain supported? Contracts: https://github.com/safe-global/safe-deployments . Transaction Service and UI: https://docs.safe.global/advanced/smart-account-supported-networks
- Old packages: `@safe-global/safe-core-sdk`, `safe-ethers-lib`, `ethers` adapters and `EthersAdapter` are from v1-v3. Gelato `GelatoRelayPack` is deprecated (relay-kit 6.1.0).
- When this skill and the official docs disagree, the docs win.

## At ETHGlobal Mumbai

- Sponsor chains (checked live 2026-10-19): World Chain, Unichain, Arc, 0G mainnet and Whitechain Sepolia have Safe 1.4.1 contracts **and** the Transaction Service. World Chain Sepolia and Unichain Sepolia have contracts but no Transaction Service. Hedera has Safe 1.3.0 only. 0G Galileo testnet and the old Whitechain L1 do not work with the SDK. Details: [references/chains.md](references/chains.md). For RPCs, faucets and chain IDs use the `sponsor-chains` skill.
- May help with: tracks about treasuries, DAOs, agents that need human approval, or smart-account UX, and sponsor tracks on World, Uniswap Foundation (Unichain), Arc, 0G or Whitechain. Check the real list: https://ethglobal.com/events/mumbai/prizes
- Help: SDK and contract questions on Ethereum Stack Exchange tag `safe-core` (https://ethereum.stackexchange.com/questions/tagged/safe-core), bugs on https://github.com/safe-global, wallet questions at https://help.safe.global (all from https://docs.safe.global/support).

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or Safe. Tested 2026-10-19 with @safe-global/protocol-kit@8.0.8, @safe-global/api-kit@5.0.4, @safe-global/relay-kit@6.1.2, @safe-global/types-kit@4.0.1, viem@2.57.7, dotenv@17.2.3, @safe-global/safe-apps-sdk@9.1.0, @safe-global/safe-apps-provider@0.18.6, wagmi@3.7.7.
