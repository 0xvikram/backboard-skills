---
name: thirdweb
description: "thirdweb TypeScript SDK v5 (`thirdweb` npm package): wallet connect UI, in-app wallets (email/Google/passkey login), contract reads and writes, deploys, custom chains and gas sponsorship (EIP-7702 / ERC-4337). Use when the user mentions thirdweb, ConnectButton, inAppWallet, createThirdwebClient, prepareContractCall, sendTransaction, defineChain, sponsorGas, smart accounts or gasless onboarding."
license: MIT
metadata:
  category: "Wallets & onboarding"
  website: "https://thirdweb.com"
  source: "tested"
  tested: "2026-10-19"
  packages: "thirdweb@5.122.0, next@16.4.2, react@19.3.0, @x402/core@2.28.0, @x402/evm@2.28.0, @x402/svm@2.28.0"
---

# thirdweb

One TypeScript SDK (`thirdweb`, v5) for the web3 parts of a hackathon app: a login/connect button that also gives users an
email or social wallet, typed contract reads and writes, contract deploys and sponsored gas, on any EVM chain.
Pick it when you want onboarding for people who have no wallet, plus contract calls, with little code.
Skip it for non-EVM chains, or if you already use wagmi/viem and only need raw calls (thirdweb has adapters, but adds weight).

## Quickstart

1. Make a project at https://thirdweb.com/team → **Projects** → create. Put `localhost` in allowed domains. Copy the **Client ID**; store the **Secret Key** safely (server-only). See [references/quickstart.md](references/quickstart.md).
2. Create an app and install pinned packages:
   ```bash
   npx create-next-app@16.4.2 my-app --ts --app --src-dir --use-npm --yes
   cd my-app
   npm i thirdweb@5.122.0
   # Next.js only, needed as of 2026-10-19 (see references/errors.md #1):
   npm i @x402/core@2.28.0 @x402/evm@2.28.0 @x402/svm@2.28.0
   ```
3. `.env.local`: `NEXT_PUBLIC_THIRDWEB_CLIENT_ID=<YOUR_CLIENT_ID>` (never put the secret key in a `NEXT_PUBLIC_` var).
4. `src/app/client.ts`:
   ```ts
   import { createThirdwebClient } from "thirdweb";
   const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
   if (!clientId) throw new Error("Set NEXT_PUBLIC_THIRDWEB_CLIENT_ID in .env.local");
   export const client = createThirdwebClient({ clientId });
   ```
5. Wrap the app: in `src/app/layout.tsx` import `ThirdwebProvider` from `"thirdweb/react"` and render `<ThirdwebProvider>{children}</ThirdwebProvider>` inside `<body>`.
6. `src/app/page.tsx`:
   ```tsx
   "use client";
   import { ConnectButton, useActiveAccount } from "thirdweb/react";
   import { inAppWallet, createWallet } from "thirdweb/wallets";
   import { baseSepolia } from "thirdweb/chains";
   import { client } from "./client";

   const wallets = [
     inAppWallet({ auth: { options: ["google", "email", "passkey"] } }),
     createWallet("io.metamask"),
   ];

   export default function Home() {
     const account = useActiveAccount();
     return (
       <main>
         <ConnectButton client={client} wallets={wallets} chain={baseSepolia} />
         <p>{account ? `Connected: ${account.address}` : "Not connected"}</p>
       </main>
     );
   }
   ```
7. `npm run dev` → open http://localhost:3000 (use `localhost` or https; wallet crypto fails on plain `http://` LAN IPs).

## Common tasks

- [Client setup (browser vs server)](references/recipes.md#1-client-setup)
- [ConnectButton + in-app wallets in React](references/recipes.md#2-connectbutton-and-in-app-wallets)
- [Read a contract](references/recipes.md#3-read-a-contract)
- [Write: prepareContractCall + sendTransaction](references/recipes.md#4-write-to-a-contract)
- [Deploy a contract](references/recipes.md#5-deploy-a-contract)
- [Custom chain with defineChain (World Chain, Unichain, Arc, 0G...)](references/recipes.md#6-custom-chains-with-definechain)
- [Gas sponsorship / account abstraction](references/recipes.md#7-gas-sponsorship-and-account-abstraction)
- [Errors and gotchas](references/errors.md)
- [Official MCP server](references/mcp.md)

## Before you write more code

- For anything not covered here, read the official AI docs index first: https://portal.thirdweb.com/llms.txt
  (full text: https://portal.thirdweb.com/llms-full.txt). Reference pages live at
  `https://portal.thirdweb.com/references/typescript/v5/<functionName>`.
- Check the installed version (`npm ls thirdweb`) and the latest (`npm view thirdweb version`). This skill was tested on 5.122.0.
- This is SDK **v5**. Old v4 code (`@thirdweb-dev/react`, `@thirdweb-dev/sdk`, `useContract`, `ThirdwebSDK`) does not work with it. Do not mix them.
- Pass `bigint` for uint values (`1n`, `toWei("0.1")`), not `number`.
- When this skill and the official docs disagree, the docs win.

## At ETHGlobal Mumbai

- Sponsor chains: World Chain, Unichain, Arc (testnet, built in as `arcTestnet`), 0G, Hedera and Whitechain all appear in
  thirdweb's chain list, so `defineChain(id)` works. Sponsored ERC-4337 gas is listed as enabled only on some of them. Details and sources: [references/chains.md](references/chains.md).
- thirdweb may help with tracks that need easy onboarding (email/social login, no seed phrase), gasless UX or quick contract
  deploys, for example consumer apps on Arc or World Chain. Read the real tracks and rules at https://ethglobal.com/events/mumbai/prizes.
  At the time of writing, thirdweb is not on that page as a sponsor.
- Help: official support at https://thirdweb.com/support, docs at https://portal.thirdweb.com, SDK issues at https://github.com/thirdweb-dev/js/issues.

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or thirdweb.
Tested 2026-10-19 with thirdweb@5.122.0, next@16.4.2, react@19.3.0 (plus vite@8.3.4 for the Vite check). See references for sources.
