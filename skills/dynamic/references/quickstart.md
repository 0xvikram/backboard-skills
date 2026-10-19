# Dynamic quickstart (React SDK + DynamicWidget)

Based on the React SDK quickstart: https://www.dynamic.xyz/docs/react/reference/quickstart (tested 2026-10-19 with `@dynamic-labs/sdk-react-core@5.12.0`).

The docs label this SDK "legacy". They still say to use it when you want `DynamicContextProvider`, `DynamicWidget`, or the React SDK with wagmi. New headless apps should use the JavaScript SDK instead: https://www.dynamic.xyz/docs/javascript/reference/react-quickstart

## 1. Dashboard setup (about 5 minutes)

1. Sign up at https://console.dynamic.xyz. You get a **Sandbox** and a **Live** environment. Use Sandbox for the hackathon. Live has its own checklist: https://www.dynamic.xyz/docs/get-started/go-live-checklist
2. **Environment ID**: Developers > API & SDK Keys, at https://console.dynamic.xyz/dashboard/developer/api. It is a public ID that ships in your frontend, not a secret. Never put the API token from that page in frontend code.
3. **Allowed origins (CORS)**: Settings > Security, at https://console.dynamic.xyz/dashboard/settings/security. Add `http://localhost:5173`, plus your deploy URL (for example `https://my-app.vercel.app`). Include the exact port. If you skip this, the browser blocks every SDK request ([source](https://www.dynamic.xyz/docs/platform/dashboard/security)).
4. **Sign-in methods**: Log in & User Profile, at https://console.dynamic.xyz/dashboard/log-in-user-profile. Turn on Email, the social providers you want (each one may need its own OAuth app, see https://www.dynamic.xyz/docs/platform/social-providers/overview), and wallet login.
5. **Chains**: Chains & Networks, at https://console.dynamic.xyz/dashboard/chains-and-networks. Turn on EVM and the networks you need (for example Base Sepolia). For chains that aren't listed, see recipe 6.
6. **Embedded wallets**: Wallets > Embedded Wallets, at https://console.dynamic.xyz/dashboard/embedded-wallets/dynamic. Turn it on and leave **Create on Sign up** on, so every email or social user gets a wallet ([source](https://www.dynamic.xyz/docs/react/wallets/embedded-wallets/mpc/creating-wallets)).

## 2. Project

Use Vite 5. The official quickstart says: "Do not use `npm create vite@latest`, it installs Vite 8 which is incompatible with the Dynamic SDK."

```bash
npm create vite@5 my-app -- --template react-ts
cd my-app
npm i @dynamic-labs/sdk-react-core@5.12.0 @dynamic-labs/ethereum@5.12.0 viem@2.57.7
```

Requirements: Node 18+, React 18 or 19 (peer range `>=18 <20`), TypeScript 5.x.

## 3. Env

`.env.local` (Vite exposes only variables prefixed with `VITE_`):

```bash
VITE_DYNAMIC_ENVIRONMENT_ID=<YOUR_ENVIRONMENT_ID>
```

## 4. vite.config.ts

The SDK expects the Node globals `process` and `global`. This is the fix from the official quickstart. The docs say not to use `@esbuild-plugins/node-globals-polyfill` with Vite 5.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    global: 'globalThis',
  },
});
```

## 5. Code

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DynamicContextProvider
      settings={{
        environmentId: import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID,
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      <App />
    </DynamicContextProvider>
  </StrictMode>,
);
```

```tsx
// src/App.tsx
import { DynamicWidget, useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';

export default function App() {
  const isLoggedIn = useIsLoggedIn();
  const { primaryWallet, user, handleLogOut } = useDynamicContext();

  return (
    <div>
      <DynamicWidget />
      {isLoggedIn && primaryWallet && (
        <div>
          <p>Address: {primaryWallet.address}</p>
          <p>Chain family: {primaryWallet.chain}</p>
          <p>Email: {user?.email ?? '-'}</p>
          <button onClick={() => handleLogOut()}>Log out</button>
        </div>
      )}
    </div>
  );
}
```

`EthereumWalletConnectors` covers every EVM chain (L2s too) and Dynamic embedded wallets ([source](https://www.dynamic.xyz/docs/react/chains/enabling-chains)). For Solana, add `@dynamic-labs/solana@5.12.0` and `SolanaWalletConnectors`.

## 6. Run

```bash
npm run dev     # http://localhost:5173
npm run build   # production build; expect a large-chunk warning, it is harmless
```

Click the button, sign in with email (you get an OTP), and the widget shows your new embedded wallet address.

## Useful hooks

| Hook | What it gives you | Docs |
| - | - | - |
| `useDynamicContext()` | `primaryWallet`, `user`, `handleLogOut`, `setShowAuthFlow` | https://www.dynamic.xyz/docs/react/reference/hooks/usedynamiccontext |
| `useIsLoggedIn()` | `boolean`, true only once the user is fully signed in | https://www.dynamic.xyz/docs/react/reference/hooks/login-user-management/useisloggedin |
| `useUserWallets()` | every wallet linked to the user | https://www.dynamic.xyz/docs/react/reference/hooks/wallets/useuserwallets |
| `useSwitchNetwork()` | `switchNetwork({ wallet, network: chainId })` | https://www.dynamic.xyz/docs/react/reference/hooks/useswitchnetwork |
| `useDynamicWaas()` | embedded-wallet helpers | https://www.dynamic.xyz/docs/react/reference/hooks/embedded-wallets/usedynamicwaas |

To run code after login, use `settings.events.onAuthSuccess` ([source](https://www.dynamic.xyz/docs/react/reference/events/onauthsuccess)).
