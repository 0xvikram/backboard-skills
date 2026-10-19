---
name: dynamic
description: "Dynamic (dynamic.xyz) wallet login for React: DynamicWidget sign-in with email, social or wallets, embedded MPC wallets, wagmi, sending transactions, custom EVM networks (World Chain, Unichain, Arc), and server-side JWT checks. Use when the user mentions Dynamic, DynamicContextProvider, DynamicWidget, environmentId, embedded wallets, wallet login, or onboarding users to a dapp."
license: MIT
metadata:
  category: "Wallets & onboarding"
  website: "https://dynamic.xyz"
  source: "tested"
  tested: "2026-10-19"
  packages: "@dynamic-labs/sdk-react-core@5.12.0, @dynamic-labs/ethereum@5.12.0, @dynamic-labs/ethereum-core@5.12.0, @dynamic-labs/wagmi-connector@5.12.0, @dynamic-labs/sdk-api-core@0.104.0, viem@2.57.7, wagmi@2.19.5, @tanstack/react-query@5.104.4, react@18.3.1, vite@5.4.21, jsonwebtoken@9.0.3, jwks-rsa@4.1.0"
---

# Dynamic

Dynamic gives a React app a ready-made login modal (`DynamicWidget`): email OTP, social logins, passkeys and external wallets, plus an embedded MPC wallet made for each user. Pick it when you want users signed in with a wallet in minutes, without writing auth UI.

This skill uses the **React SDK** (`@dynamic-labs/sdk-react-core`), the one with `DynamicWidget` and wagmi support. Dynamic now calls it "legacy" and recommends its headless **JavaScript SDK** (`@dynamic-labs-sdk/*`) for new apps. That SDK has no built-in UI, so you write every login screen yourself. For a 36-hour hackathon the widget is faster. If you want the headless SDK, follow https://www.dynamic.xyz/docs/javascript/reference/react-quickstart and don't use this skill's code.

## Quickstart

1. Sign up at https://console.dynamic.xyz and copy the **Environment ID** from https://console.dynamic.xyz/dashboard/developer/api (use the Sandbox environment while building).
2. In the dashboard, add `http://localhost:5173` under Security > Allowed CORS Origins, turn on the sign-in methods you want (email, Google, wallets), and turn on Embedded Wallets with "Create on Sign up". See [quickstart.md](references/quickstart.md).
3. Scaffold with **Vite 5**. Dynamic's quickstart says `vite@latest` (Vite 8) does not work with the SDK:
   ```bash
   npm create vite@5 my-app -- --template react-ts && cd my-app
   npm i @dynamic-labs/sdk-react-core@5.12.0 @dynamic-labs/ethereum@5.12.0 viem@2.57.7
   ```
4. Add Node globals to `vite.config.ts`, or the page breaks with `process is not defined`:
   ```ts
   export default defineConfig({ plugins: [react()], define: { 'process.env': {}, global: 'globalThis' } });
   ```
5. Put `VITE_DYNAMIC_ENVIRONMENT_ID=<YOUR_ENVIRONMENT_ID>` in `.env.local`.
6. Wrap the app and add the widget:
   ```tsx
   // src/main.tsx
   import { createRoot } from 'react-dom/client';
   import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
   import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
   import App from './App';

   createRoot(document.getElementById('root')!).render(
     <DynamicContextProvider
       settings={{
         environmentId: import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID,
         walletConnectors: [EthereumWalletConnectors],
       }}
     >
       <App />
     </DynamicContextProvider>,
   );
   ```
   ```tsx
   // src/App.tsx
   import { DynamicWidget, useDynamicContext } from '@dynamic-labs/sdk-react-core';

   export default function App() {
     const { primaryWallet, user } = useDynamicContext();
     return (
       <div>
         <DynamicWidget />
         {primaryWallet && <p>{user?.email} {primaryWallet.address}</p>}
       </div>
     );
   }
   ```
7. Run `npm run dev` and open http://localhost:5173. Sign in, and you get an address. `primaryWallet.chain` is the chain family (`'EVM'`), not a chain ID. Use `await primaryWallet.getNetwork()` for the ID.

## Common tasks

All in [references/recipes.md](references/recipes.md):

- [Login options: email, social, wallets](references/recipes.md#1-login-with-email-social-or-wallets)
- [Embedded wallets](references/recipes.md#2-embedded-wallets)
- [Send a transaction (viem)](references/recipes.md#3-send-a-transaction-with-viem)
- [Sign a message](references/recipes.md#4-sign-a-message)
- [wagmi integration + contract writes](references/recipes.md#5-wagmi-integration)
- [Add a custom EVM network (World Chain, Unichain...)](references/recipes.md#6-add-a-custom-evm-network)
- [Verify the JWT on your server](references/recipes.md#7-verify-the-dynamic-jwt-on-your-server)
- [Next.js App Router](references/recipes.md#8-nextjs-app-router)

Errors and fixes: [references/errors.md](references/errors.md). Docs MCP for your editor: [references/mcp.md](references/mcp.md).

## Before you write more code

- For anything not covered here, read the docs index https://www.dynamic.xyz/docs/llms.txt, then the React SDK index https://www.dynamic.xyz/docs/react/llms.txt. Any page loads as markdown if you add `.md` to its URL.
- Better: add the docs MCP (`claude mcp add --transport http dynamic https://www.dynamic.xyz/docs/mcp`) and search it.
- Check versions before installing: `npm view @dynamic-labs/sdk-react-core version`. All `@dynamic-labs/*` packages must be on the **same version**, or the SDK logs a version-mismatch error.
- `@dynamic-labs/wagmi-connector@5.12.0` declares `wagmi ^2.14.11`. Use wagmi v2. Some Dynamic docs pages still show wagmi v1 hooks (`usePrepareContractWrite`), which no longer exist.
- When this skill and the official docs disagree, the docs win.

## At ETHGlobal Mumbai

- Sponsor chains: World Chain and Unichain work as EVM networks (Dynamic lists both by chain ID). Arc has native embedded-wallet and gas-sponsorship support. Hedera, 0G and Whitechain are not named in Dynamic's docs and need the custom-network route. Details and sources: [references/chains.md](references/chains.md).
- Dynamic may help with prize tracks that need easy onboarding, embedded wallets, or consumer apps on a sponsor chain. Check the tracks and their rules at https://ethglobal.com/events/mumbai/prizes.
- Help: Dynamic's official Slack, https://dynamic.xyz/slack (`#bug-report` for bugs), and support at https://www.dynamic.xyz/talk-to-us. To check whether a bug is yours or theirs, try it on https://demo.dynamic.xyz.

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or Dynamic. Tested 2026-10-19 with @dynamic-labs/sdk-react-core@5.12.0, @dynamic-labs/ethereum@5.12.0, @dynamic-labs/wagmi-connector@5.12.0, viem@2.57.7, wagmi@2.19.5, @tanstack/react-query@5.104.4, react@18.3.1, vite@5.4.21, jsonwebtoken@9.0.3, jwks-rsa@4.1.0.
