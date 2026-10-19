---
name: reown
description: "Reown AppKit (formerly WalletConnect Web3Modal): a connect-wallet modal for React, Next.js and Vite with the wagmi adapter, plus email/social login, network switching, custom chains (World Chain, Unichain, Hedera, Arc, 0G, Whitechain) and Sign In With X. Use when the user mentions Reown, AppKit, WalletConnect, Web3Modal, projectId, createAppKit, appkit-button, connect wallet, or wallet login."
license: MIT
metadata:
  category: "Wallets & onboarding"
  website: "https://reown.com"
  source: "tested"
  tested: "2026-10-19"
  packages: "@reown/appkit@1.8.24, @reown/appkit-adapter-wagmi@1.8.24, @reown/appkit-siwx@1.8.24, wagmi@2.19.5, @wagmi/core@2.22.1, @wagmi/connectors@6.2.0, viem@2.57.7, @tanstack/react-query@5.104.4, react@19.3.1, next@16.4.2, vite@8.3.4, @vitejs/plugin-react@6.1.2, typescript@5.9.3"
---

# Reown AppKit

Reown AppKit is the WalletConnect team's connect modal. You get one `<AppKitButton />` that connects 500+ wallets (browser extension, mobile QR, deep link) and, if you turn it on, email and social login. You then use normal **wagmi** hooks to read, sign and send. Pick it when you want a wallet modal that works with almost every wallet, on any EVM chain, in about 10 minutes.

Pick something else if you want each user to get an app-owned embedded wallet with server-side control. Look at Privy or Dynamic for that. AppKit's email login creates a wallet that the user owns and that works in any app using AppKit.

## Quickstart

1. Get a free **projectId**: sign in at https://dashboard.reown.com, create a project, and copy the Project ID. The Starter plan is free (500 MAU, 2.5M RPC calls). localhost and `*.vercel.app` work without adding a domain. Details: [quickstart.md](references/quickstart.md).
2. Scaffold and install. Keep every `@reown/*` package on the **same version**. Pin `@wagmi/core` and `@wagmi/connectors` too, or npm pulls wagmi v3 copies and type-checking breaks ([errors.md #1](references/errors.md)):
   ```bash
   npm create vite@latest my-app -- --template react-ts && cd my-app
   npm i @reown/appkit@1.8.24 @reown/appkit-adapter-wagmi@1.8.24 wagmi@2.19.5 @wagmi/core@2.22.1 @wagmi/connectors@6.2.0 viem@2.57.7 @tanstack/react-query@5.104.4
   ```
3. Put `VITE_PROJECT_ID=<YOUR_PROJECT_ID>` in `.env.local`.
4. Config: `src/config.ts`
   ```ts
   import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
   import { sepolia, baseSepolia, type AppKitNetwork } from '@reown/appkit/networks'

   export const projectId = import.meta.env.VITE_PROJECT_ID as string
   if (!projectId) throw new Error('VITE_PROJECT_ID is not set')

   // The annotation is required: networks must be a non-empty tuple
   export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [sepolia, baseSepolia]

   export const wagmiAdapter = new WagmiAdapter({ projectId, networks })
   ```
5. Call `createAppKit` once, outside components, and wrap the app: `src/main.tsx`
   ```tsx
   import { createRoot } from 'react-dom/client'
   import { createAppKit } from '@reown/appkit/react'
   import { WagmiProvider } from 'wagmi'
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
   import { projectId, networks, wagmiAdapter } from './config'
   import App from './App'

   const queryClient = new QueryClient()
   createAppKit({
     adapters: [wagmiAdapter], projectId, networks,
     metadata: { name: 'My Hack', description: 'ETHGlobal Mumbai', url: 'http://localhost:5173', icons: [] },
   })

   createRoot(document.getElementById('root')!).render(
     <WagmiProvider config={wagmiAdapter.wagmiConfig}>
       <QueryClientProvider client={queryClient}><App /></QueryClientProvider>
     </WagmiProvider>,
   )
   ```
6. Add the button and read the account: `src/App.tsx`
   ```tsx
   import { AppKitButton, useAppKitAccount } from '@reown/appkit/react'

   export default function App() {
     const { address, isConnected } = useAppKitAccount()
     return (<main><AppKitButton />{isConnected && <p>{address}</p>}</main>)
   }
   ```
7. `npm run dev` and open http://localhost:5173. For Next.js (SSR + cookies) see [recipes.md#2](references/recipes.md#2-nextjs-app-router-with-ssr-and-cookies). Next 16 needs one config line.

## Common tasks

All in [references/recipes.md](references/recipes.md):

- [Read account, sign a message, send a transaction](references/recipes.md#1-read-account-sign-a-message-send-a-transaction)
- [Next.js App Router with SSR and cookies](references/recipes.md#2-nextjs-app-router-with-ssr-and-cookies)
- [Your own buttons: open views, switch network, disconnect](references/recipes.md#3-your-own-buttons-open-views-switch-network-disconnect)
- [Sponsor chains + your own RPC](references/recipes.md#4-sponsor-chains-and-your-own-rpc)
- [A chain that is not exported (defineChain)](references/recipes.md#5-a-chain-that-is-not-exported-definechain)
- [Email and social login](references/recipes.md#6-email-and-social-login)
- [Sign In With X (SIWX) + verifying signatures on your server](references/recipes.md#7-sign-in-with-x-siwx)
- [Contract read and write](references/recipes.md#8-contract-read-and-write)

Errors and fixes: [references/errors.md](references/errors.md). Docs MCP: [references/mcp.md](references/mcp.md).

## Before you write more code

- For anything not covered here, read the docs index https://docs.reown.com/llms.txt. Every page also loads as markdown if you add `.md` to its URL (e.g. https://docs.reown.com/appkit/react/core/hooks.md). Reown also publishes its own agent skill: `npx skills add https://github.com/reown-com/skills --skill appkit`.
- Check versions first: `npm view @reown/appkit version`, and use that same number for every `@reown/*` package.
- AppKit 1.8.x needs **wagmi v2**. The docs say `wagmi@2.x`. wagmi 3 support is a separate beta (`@reown/*@2.0.0-wagmi-3.0`), not covered here.
- Settings in the Reown dashboard **override** `features.email`, `features.socials`, swaps, onramp and SIWX in your code ([errors.md #4](references/errors.md)).
- A few doc snippets are out of date: the `customRpcUrls` string form, untyped `networks` arrays, and `useAppKitSIWX` imported from `@reown/appkit/react`. The correct forms are in this skill and were type-checked.
- When this skill and the official docs disagree, the docs win.

## At ETHGlobal Mumbai

- Sponsor chains: World Chain, Unichain, Hedera, Arc, 0G and Whitechain are all exported from `@reown/appkit/networks`. Use `zeroGTestnet` (16602) for 0G Galileo, not `zeroG`. Only Unichain is served by Reown's own RPC, and email/social wallets may not transact on the other five. Details: [references/chains.md](references/chains.md). For deeper chain facts: `npx skills add 0xvikram/backboard-skills --skill sponsor-chains`.
- AppKit may help with tracks that need wallet connection or onboarding on a sponsor chain (for example World, Uniswap Foundation, Hedera, Arc, 0G, Whitechain). Read the tracks and their rules at https://ethglobal.com/events/mumbai/prizes.
- For a World Mini App inside World App, use World's MiniKit, not AppKit. AppKit fits a normal web app on World Chain.
- Help: the chat bubble in https://dashboard.reown.com (AI bot on the free plan), GitHub issues at https://github.com/reown-com/appkit/issues, status at https://status.reown.com.

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or Reown. Tested 2026-10-19 with @reown/appkit@1.8.24, @reown/appkit-adapter-wagmi@1.8.24, @reown/appkit-siwx@1.8.24, wagmi@2.19.5, @wagmi/core@2.22.1, @wagmi/connectors@6.2.0, viem@2.57.7, @tanstack/react-query@5.104.4, react@19.3.1, next@16.4.2, vite@8.3.4 (also 7.3.7), typescript@5.9.3 (also 7.0.2).
