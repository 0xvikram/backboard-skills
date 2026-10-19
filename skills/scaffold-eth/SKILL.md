---
name: scaffold-eth
description: "Scaffold-ETH 2 (create-eth) is a full-stack EVM dapp starter: Solidity (Hardhat or Foundry) plus a Next.js, wagmi, viem and RainbowKit frontend with typed contract hooks. Use when a hacker says scaffold-eth, SE-2, create-eth, yarn chain, yarn deploy, Debug Contracts, useScaffoldReadContract, useScaffoldWriteContract, scaffold.config.ts, targetNetworks, or wants a contract plus frontend on World Chain, Unichain, Arc, Hedera, 0G or Whitechain fast."
license: MIT
metadata:
  category: "Dev infra & RPC"
  website: "https://scaffoldeth.io"
  source: "tested"
  tested: "2026-10-19"
  packages: "create-eth@2.0.23 (template pins viem@2.53.1, wagmi@2.19.5, next@16.2.12, hardhat@3.19.0, hardhat-deploy@2.0.30)"
---

# Scaffold-ETH 2

Scaffold-ETH 2 (SE-2) gives you a monorepo with a contracts package (`packages/hardhat` or `packages/foundry`) and a Next.js app (`packages/nextjs`). `yarn deploy` writes your ABIs and addresses to `deployedContracts.ts`, so the frontend hooks know every contract name and function with full types. A Debug Contracts page lets you call every function without writing UI.
Pick it when you need a contract and a working UI within hours on any EVM chain. Skip it for a backend-only bot or a non-EVM chain, or if you already have a frontend (use plain viem/wagmi instead).

## Quickstart

1. Needs Node >= 22.10 (the scaffold's `engines` field; the docs still say 20.18.3), Yarn (any version; the project ships Yarn 4.13 itself) and Git. For the Foundry flavour, install Foundry >= 1.4.0 first ([getfoundry.sh](https://getfoundry.sh/introduction/installation)).
2. Create the project without prompts (tested):
   ```bash
   npx create-eth@2.0.23 my-dapp -s hardhat     # or -s foundry
   cd my-dapp
   ```
   This installs everything (about 7 minutes on a fresh machine).
3. Terminal 1: `yarn chain` (local Hardhat node or Anvil on `127.0.0.1:8545`).
4. Terminal 2: `yarn deploy` (deploys `YourContract` and regenerates `packages/nextjs/contracts/deployedContracts.ts`).
5. Terminal 3: `yarn start`, then open http://localhost:3000/debug to call every contract function from the browser. A burner wallet connects on its own (or pick **Connect Wallet → Burner Wallet**); use the faucet button in the header to get local ETH (the burner only appears while `hardhat` is your only target network).
6. No keys are needed locally. For live apps put your own keys in `packages/nextjs/.env.local` (`NEXT_PUBLIC_ALCHEMY_API_KEY=<YOUR_KEY>`, `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<YOUR_ID>`) and `packages/hardhat/.env` (`ALCHEMY_API_KEY`, `ETHERSCAN_API_KEY`).
7. Smallest custom page, `packages/nextjs/app/greet/page.tsx` (tested, type-checks and renders live data):
   ```tsx
   "use client";
   import type { NextPage } from "next";
   import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

   const Greet: NextPage = () => {
     const { data: greeting } = useScaffoldReadContract({ contractName: "YourContract", functionName: "greeting" });
     const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "YourContract" });
     return (
       <div className="flex flex-col items-center gap-4 pt-10">
         <p>Greeting: {greeting}</p>
         <button
           className="btn btn-primary"
           disabled={isMining}
           onClick={() => writeContractAsync({ functionName: "setGreeting", args: ["gm Mumbai"] }).catch(console.error)}
         >
           Set greeting
         </button>
       </div>
     );
   };
   export default Greet;
   ```
8. Open http://localhost:3000/greet. Before you ship, run `yarn next:check-types` and `yarn next:build`.

Full setup with every file to touch: [references/quickstart.md](references/quickstart.md).

## Common tasks

- [Pick Hardhat or Foundry and create the project](references/recipes.md#1-create-the-project-hardhat-or-foundry)
- [Local chain, deploy, Debug Contracts page](references/recipes.md#2-local-chain-deploy-and-the-debug-contracts-page)
- [Read, write and event history hooks](references/recipes.md#3-scaffold-hooks-read-write-event-history)
- [Add a sponsor chain to `scaffold.config.ts` (and to Hardhat/Foundry)](references/recipes.md#4-add-a-sponsor-chain-as-a-target-network)
- [Deploy to a testnet with the deployer account and verify](references/recipes.md#5-deploy-to-a-testnet-and-verify)
- [Use a contract you did not deploy (external contracts)](references/recipes.md#6-external-contracts-on-a-sponsor-chain)
- [Extensions worth using at a hackathon (`create-eth -e`)](references/recipes.md#7-extensions-create-eth--e)
- [Deploy the frontend to Vercel](references/recipes.md#8-deploy-the-frontend-to-vercel)
- [Errors and gotchas](references/errors.md)
- [Sponsor chains: IDs, viem names, RPCs, verification](references/chains.md)

## Before you write more code

- Read the docs index for anything not covered here: https://docs.scaffoldeth.io/llms.txt. Every page is also served as Markdown (add `.md`, for example https://docs.scaffoldeth.io/hooks/useScaffoldReadContract.md).
- Inside a scaffolded project, read `AGENTS.md` at the root and `.agents/skills/<name>/SKILL.md` (ERC-721, SIWE, Ponder, subgraph, x402, EIP-5792, OpenZeppelin, Drizzle+Neon). The project also ships a Context7 MCP config (`.mcp.json`); there is no official Scaffold-ETH MCP server.
- The template changes often. In create-eth 2.0.23 the Hardhat flavour is Hardhat 3 + hardhat-deploy 2 (rocketh), and `scaffold.config.ts` uses `burnerWalletMode` and `rpcOverrides`. Some docs pages still show older field names. Check `npm view create-eth version` and read the generated files.
- Hook types come from `targetNetworks[0]` in `scaffold.config.ts`. If types look wrong, check that first.
- **When this skill and the official docs disagree, the docs win** (except where errors.md shows the docs are behind the current template).

## At ETHGlobal Mumbai

- Sponsor chains: works with any EVM chain. viem 2.53.1 (pinned by the template) has `worldchainSepolia`, `unichainSepolia`, `arcTestnet`, `hederaTestnet`, `zeroGTestnet` (16602) and `whitechainSepolia` (1874). Arc testnet needs an RPC override and Arc mainnet a `defineChain`. All six testnets answered read calls from both the Next.js app and Hardhat on 2026-10-19. Details: [references/chains.md](references/chains.md). For deeper chain facts (faucets, quirks): `npx skills add 0xvikram/backboard-skills --skill sponsor-chains`.
- May help with tracks that need a deployed contract plus a UI on World, Uniswap Foundation (Unichain), Arc, Hedera, 0G or Whitechain, and with ENS (the `Address` component resolves ENS names). Check the tracks and rules yourself: https://ethglobal.com/events/mumbai/prizes
- Help: the BuidlGuidl Telegram linked as "Support" on https://scaffoldeth.io (https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA), and GitHub issues at https://github.com/scaffold-eth/scaffold-eth-2/issues.

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or Scaffold-ETH / BuidlGuidl. Tested 2026-10-19 with create-eth@2.0.23 (Hardhat flavour; template viem@2.53.1, wagmi@2.19.5, next@16.2.12, hardhat@3.19.0, hardhat-deploy@2.0.30).
