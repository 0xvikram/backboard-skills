# Privy quickstart (Next.js App Router, full)

Based on: https://docs.privy.io/basics/react/setup, https://docs.privy.io/basics/react/quickstart, https://docs.privy.io/basics/get-started/dashboard/create-new-app, https://docs.privy.io/basics/troubleshooting/react-frameworks (NextJS tab). Tested 2026-10-19 (see the versions below).

## 1. Dashboard (about 3 minutes)

1. Sign in at https://dashboard.privy.io and create an app. Privy recommends one app per environment (dev, prod).
2. Open **Configuration > App settings > Basics**. Copy:
   - **App ID**: public, goes in the browser. It is 25 characters.
   - **App secret**: server only. Privy does not store it; if you lose it, you must make a new one.
3. Open the **Authentication** (login methods) page and turn on **Email**. Turn on **Google** under socials if you want it. In development you can use Privy's default OAuth credentials (https://docs.privy.io/basics/get-started/dashboard/configure-login-methods).
4. Optional, for demos: **User management > Authentication > Advanced > Enable test accounts** gives you a `test-XXXX@privy.io` email and a fixed OTP. Normal emails are rate limited to 5 OTP requests per 5 minutes (https://docs.privy.io/recipes/using-test-accounts).
5. Before you deploy: **Configuration > App settings > Domains**, add your `https://` origin under Allowed Origins (https://docs.privy.io/recipes/react/allowed-domains).

## 2. Install

```sh
npx create-next-app@16.4.2 my-app --ts --app
cd my-app
npm i @privy-io/react-auth@3.50.0 viem@2.57.5
```

For the server check (step 6): `npm i @privy-io/node@0.36.0`.

## 3. Env

`.env.local`:

```sh
NEXT_PUBLIC_PRIVY_APP_ID=<YOUR_PRIVY_APP_ID>
PRIVY_APP_ID=<YOUR_PRIVY_APP_ID>
PRIVY_APP_SECRET=<YOUR_PRIVY_APP_SECRET>
# optional: the verification key from Configuration > App settings, avoids a network fetch
PRIVY_VERIFICATION_KEY=<YOUR_PRIVY_VERIFICATION_KEY>
```

Never prefix the secret with `NEXT_PUBLIC_`.

## 4. Provider

`PrivyProvider` is a client-only React context, so it goes in a `'use client'` file. Render it once, near the root.

`app/providers.tsx`:

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
        // Creates a wallet for users who log in through the Privy modal and have none
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

`app/layout.tsx`:

```tsx
import Providers from './providers';

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## 5. Page: login, wallet, send

`app/page.tsx`:

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
      <p>User: {user?.id}</p>
      <p>Wallet: {embedded?.address ?? 'creating...'}</p>
      <button
        disabled={!embedded}
        onClick={async () => {
          const {hash} = await sendTransaction(
            {to: '0x0000000000000000000000000000000000000000', value: 1n, chainId: 4801},
            {address: embedded!.address}
          );
          alert(hash);
        }}
      >
        Send 1 wei
      </button>
      <button onClick={logout}>Log out</button>
    </div>
  );
}
```

Notes:
- Wait for `ready` from `usePrivy` before reading state (https://docs.privy.io/basics/react/setup#waiting-for-privy-to-be-ready). `useWallets()` also returns `ready`.
- `sendTransaction` shows a Privy confirm modal and returns `{hash}` (https://docs.privy.io/wallets/using-wallets/ethereum/send-a-transaction). `chainId` must be in `supportedChains`. 4801 is World Chain Sepolia.
- The new wallet has no gas. Get World Chain Sepolia test ETH first (see [chains.md](chains.md)), or turn on gas sponsorship and pass `{sponsor: true}` (https://docs.privy.io/wallets/gas-and-asset-management/gas/overview).

## 6. Run

```sh
npm run dev
# open http://localhost:3000, click "Log in", enter your email and the code
```

Embedded wallets need a secure context: `http://localhost` works, but any deployed URL must be `https://`.

To check the user on your server, add the route in [recipes.md #6](recipes.md#6-verify-the-user-on-your-server).

## Plain React (Vite) instead of Next.js

Same provider, rendered in `main.tsx` without `'use client'`. If you see `process is not defined` or Solana peer-dependency build errors, follow the Vite tab at https://docs.privy.io/basics/troubleshooting/react-frameworks.

Official starters: https://github.com/privy-io/examples/tree/main/privy-next-starter and https://github.com/privy-io/examples/tree/main/privy-react-starter
