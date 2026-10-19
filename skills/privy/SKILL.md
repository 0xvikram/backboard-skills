---
name: privy
description: "Privy gives your app email/social/wallet login plus embedded wallets for every user, in React/Next.js with a Node server SDK. Use when a hacker says Privy, PrivyProvider, usePrivy, embedded wallet, email or Google login for a dapp, social login wallet, @privy-io/react-auth, @privy-io/wagmi, verify Privy access token, or wants World Chain / Unichain wallets without MetaMask."
license: MIT
metadata:
  category: "Wallets & onboarding"
  website: "https://privy.io"
  source: "tested"
  tested: "2026-10-19"
  packages: "@privy-io/react-auth@3.50.0, @privy-io/node@0.36.0, @privy-io/wagmi@4.0.19, wagmi@3.7.7, viem@2.57.5, @tanstack/react-query@5.104.4, next@16.4.2, react@19.3.1"
---

# Privy

Privy logs users in with email, SMS, Google/Twitter/Discord, passkeys or an external wallet, and gives each user an embedded EVM (or Solana) wallet with no seed phrase. Pick it when your users are not crypto-native and you want "log in with email, get a wallet" in a React or Next.js app.
Skip it for a pure backend bot, or when every user already has MetaMask and you only need a connect button (plain wagmi or RainbowKit is lighter).

## Quickstart

1. Create an app at https://dashboard.privy.io. Copy the **App ID** (and **App secret** for your server) from Configuration > App settings > Basics. Enable Email (and Google) under the Authentication / login methods page.
2. Install (Next.js App Router):
   ```sh
   npm i @privy-io/react-auth@3.50.0 viem@2.57.5
   ```
3. `.env.local`: `NEXT_PUBLIC_PRIVY_APP_ID=<YOUR_PRIVY_APP_ID>` (the real ID is 25 characters; a fake or empty value crashes `next build`).
4. `app/providers.tsx`, and wrap `{children}` with `<Providers>` in `app/layout.tsx`:
   ```tsx
   'use client';
   import {PrivyProvider} from '@privy-io/react-auth';
   import {worldchainSepolia, unichainSepolia} from 'viem/chains';

   export default function Providers({children}: {children: React.ReactNode}) {
     return (
       <PrivyProvider
         appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
         config={{
           loginMethods: ['email', 'google', 'wallet'],
           embeddedWallets: {ethereum: {createOnLogin: 'users-without-wallets'}},
           defaultChain: worldchainSepolia,
           supportedChains: [worldchainSepolia, unichainSepolia]
         }}
       >
         {children}
       </PrivyProvider>
     );
   }
   ```
5. `app/page.tsx`: log in with the Privy modal, read the embedded wallet, send a transaction:
   ```tsx
   'use client';
   import {usePrivy, useWallets, useSendTransaction} from '@privy-io/react-auth';

   export default function Home() {
     const {ready, authenticated, user, login, logout} = usePrivy();
     const {wallets} = useWallets();
     const {sendTransaction} = useSendTransaction();
     if (!ready) return <p>Loading...</p>;
     if (!authenticated) return <button onClick={login}>Log in</button>;
     const embedded = wallets.find((w) => w.walletClientType === 'privy');
     return (
       <div>
         <p>{user?.id} / {embedded?.address ?? 'creating wallet...'}</p>
         <button disabled={!embedded} onClick={async () => {
           const {hash} = await sendTransaction(
             {to: '0x0000000000000000000000000000000000000000', value: 1n, chainId: 4801},
             {address: embedded!.address});
           alert(hash);
         }}>Send 1 wei</button>
         <button onClick={logout}>Log out</button>
       </div>
     );
   }
   ```
6. `npm run dev`, open http://localhost:3000, log in with your email. Fund the wallet with World Chain Sepolia test ETH before sending.

Full walkthrough: [references/quickstart.md](references/quickstart.md).

## Common tasks

- [Custom email OTP login form (whitelabel)](references/recipes.md#1-custom-email-otp-login-whitelabel) + creating the wallet yourself
- [Google / social login button](references/recipes.md#2-google-or-other-social-login-button)
- [Send ETH or an ERC-20 from the embedded wallet](references/recipes.md#3-send-eth-or-an-erc-20-from-the-embedded-wallet)
- [Use viem with a Privy wallet](references/recipes.md#4-use-viem-with-a-privy-wallet)
- [Use wagmi hooks with Privy](references/recipes.md#5-use-wagmi-hooks-with-privy)
- [Verify the user on your server (access token)](references/recipes.md#6-verify-the-user-on-your-server)
- [Add World Chain / Unichain or any custom chain](references/recipes.md#7-add-world-chain-unichain-or-any-custom-chain)
- [World mini app login with the World wallet (SIWE)](references/recipes.md#8-world-mini-app-login-siwe-through-world-app)
- Errors and gotchas: [references/errors.md](references/errors.md)
- Chain support: [references/chains.md](references/chains.md) · Docs MCP server: [references/mcp.md](references/mcp.md)

## Before you write more code

- For anything not covered here, read the index https://docs.privy.io/llms.txt and open the linked `.md` page (React: https://docs.privy.io/basics/react/setup.md). Privy also runs a docs MCP server ([references/mcp.md](references/mcp.md)).
- Check versions first: `npm view @privy-io/react-auth version`. Privy ships often (3.48 to 3.50 in one week, Oct 2026).
- Use `@privy-io/node` on the server. `@privy-io/server-auth` is deprecated on npm.
- Some doc snippets are behind the SDK types (see errors.md #1 and #2). Type-check with `tsc`. When this skill and the official docs disagree, the docs win, unless the installed package's TypeScript types say otherwise.

## At ETHGlobal Mumbai

- Sponsor chains: World Chain and Unichain work as normal EVM chains, mainnet and Sepolia testnets, both in `viem/chains`. Details and sources: [references/chains.md](references/chains.md).
- Privy may help with the World and Uniswap Foundation (Unichain) tracks (consumer onboarding, mini apps, payments) and with any track that needs non-crypto users to sign in. Check the rules yourself: https://ethglobal.com/events/mumbai/prizes
- Help: Privy support Slack https://privy.io/slack (linked from the docs), docs https://docs.privy.io

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or Privy. Tested 2026-10-19 with @privy-io/react-auth@3.50.0, @privy-io/node@0.36.0, @privy-io/wagmi@4.0.19, wagmi@3.7.7, viem@2.57.5, next@16.4.2.
