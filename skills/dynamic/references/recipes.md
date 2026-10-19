# Dynamic recipes (React SDK 5.12.0)

Every recipe assumes the setup in [quickstart.md](quickstart.md): `DynamicContextProvider` with `EthereumWalletConnectors`, Vite 5, and the `define` polyfill. Every snippet was type-checked and built with `vite build` against the pinned versions on 2026-10-19.

---

## 1. Login with email, social or wallets

**Goal:** one button that offers email OTP, Google/X/Discord/Farcaster/Telegram, passkeys and MetaMask-style wallets.

**Code:** none beyond `<DynamicWidget />`. Which options show up is set **in the dashboard**, not in code:
- Turn on email, SMS and social providers at https://console.dynamic.xyz/dashboard/log-in-user-profile.
- Each social provider needs its own OAuth app (client ID and secret) pasted into the dashboard. Guides: https://www.dynamic.xyz/docs/platform/social-providers/overview

```tsx
import { DynamicWidget, useDynamicContext } from '@dynamic-labs/sdk-react-core';

export function Header() {
  const { setShowAuthFlow } = useDynamicContext();
  return (
    <>
      <DynamicWidget variant="dropdown" /> {/* 'modal' (default) or 'dropdown' */}
      <button onClick={() => setShowAuthFlow(true)}>Open login from anywhere</button>
    </>
  );
}
```

**Own buttons (no widget UI):** `useSocialAccounts().signInWithSocialAccount(ProviderEnum.Google)`, with `ProviderEnum` from `@dynamic-labs/types`. Email OTP uses `useConnectWithOtp`. If you build your own UI, you also handle step-up auth and device registration yourself.

**Notes:** `useIsLoggedIn()` returns true only when the user is fully signed in, including having an embedded wallet when those are on. Rely on it rather than on `user != null`.

Sources: https://www.dynamic.xyz/docs/react/reference/components/dynamicwidget, https://www.dynamic.xyz/docs/react/authentication-methods/social, https://www.dynamic.xyz/docs/react/reference/hooks/login-user-management/useisloggedin

---

## 2. Embedded wallets

**Goal:** every user who signs in with email or social gets an MPC wallet, without a seed phrase or extension.

**Default:** turn on Embedded Wallets with **Create on Sign up** at https://console.dynamic.xyz/dashboard/embedded-wallets/dynamic. That is all. The wallet becomes `primaryWallet`, and recipes 3 to 5 work with it unchanged. To also give MetaMask users an embedded wallet, open "Create on Sign up" > Advanced Options > "Embedded Wallet for Third-Party Wallets".

**Create on demand** (if auto-create is off, or for wallet-login users):

```tsx
import { useDynamicWaas, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { ChainEnum } from '@dynamic-labs/sdk-api-core'; // npm i @dynamic-labs/sdk-api-core@0.104.0

export function CreateEmbeddedWallet() {
  const isLoggedIn = useIsLoggedIn();
  const { createWalletAccount, getWaasWallets, dynamicWaasIsEnabled } = useDynamicWaas();

  if (!isLoggedIn) return null;
  if (!dynamicWaasIsEnabled) return <p>Turn on Embedded Wallets in the Dynamic dashboard.</p>;

  const onClick = async () => {
    if (getWaasWallets().length > 0) return; // already has one
    await createWalletAccount([ChainEnum.Evm]); // e.g. [ChainEnum.Evm, ChainEnum.Sol]
  };
  return <button onClick={onClick}>Create embedded wallet</button>;
}
```

**Notes:**
- The docs page shows `const { userHasEmbeddedWallet } = useDynamicWaas()`. That property **does not exist** in 5.12.0 (it fails tsc). Use `getWaasWallets().length > 0`.
- `getWaasWallets()` is synchronous in 5.12.0, so you don't need `await`.
- Use the `sdk-api-core` version that `sdk-react-core@5.12.0` depends on (`0.104.0`). Check with `npm ls @dynamic-labs/sdk-api-core`.
- Gas sponsorship for embedded wallets covers only some chains (Arc, Base, Ethereum, Sepolia, Base Sepolia...): https://www.dynamic.xyz/docs/embedded-wallets/gas-sponsorship

Source: https://www.dynamic.xyz/docs/react/wallets/embedded-wallets/mpc/creating-wallets

---

## 3. Send a transaction with viem

**Goal:** send native ETH from the user's wallet (embedded or external) and wait for it to be mined.

```tsx
import { useState, type FormEvent } from 'react';
import { parseEther, isAddress } from 'viem';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { isEthereumWallet } from '@dynamic-labs/ethereum';

export function SendTransaction() {
  const { primaryWallet } = useDynamicContext();
  const [hash, setHash] = useState('');
  const [error, setError] = useState('');

  if (!primaryWallet || !isEthereumWallet(primaryWallet)) return null;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const form = new FormData(e.currentTarget);
    const to = String(form.get('to'));
    const amount = String(form.get('amount'));
    if (!isAddress(to)) return setError('Not a valid address');
    try {
      const publicClient = await primaryWallet.getPublicClient();
      const walletClient = await primaryWallet.getWalletClient();
      const txHash = await walletClient.sendTransaction({ to, value: parseEther(amount) });
      setHash(txHash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log('status', receipt.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <input name="to" placeholder="0x..." required />
      <input name="amount" placeholder="0.001" required />
      <button type="submit">Send</button>
      {hash && <p>Tx: {hash}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

**Notes:**
- `isEthereumWallet(primaryWallet)` narrows the type so that `getWalletClient()` and `getPublicClient()` exist.
- The docs example calls `getTransactionReceipt` right after sending. That throws `TransactionReceiptNotFoundError` until the tx is mined, so use `waitForTransactionReceipt`.
- The tx goes out on the wallet's **current** network. Switch first if needed: `useSwitchNetwork()(...)`, called as `switchNetwork({ wallet: primaryWallet, network: 4801 })` ([source](https://www.dynamic.xyz/docs/react/reference/hooks/useswitchnetwork)).
- Contract calls: `walletClient.writeContract({ address, abi, functionName, args })`, the standard viem API.

Source: https://www.dynamic.xyz/docs/react/wallets/using-wallets/evm/send-a-transaction

---

## 4. Sign a message

```tsx
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

export function SignMessageButton() {
  const { primaryWallet } = useDynamicContext();
  const sign = async () => {
    if (!primaryWallet) return;
    const signature = await primaryWallet.signMessage('hello from ETHGlobal Mumbai');
    console.log('signature', signature);
  };
  return <button onClick={sign}>Sign message</button>;
}
```

**Notes:** for proving identity to your own backend, use the JWT (recipe 7), which is simpler and already verified by Dynamic. Raw signatures are better for on-chain checks, such as `ecrecover` or EIP-1271.

Source: https://www.dynamic.xyz/docs/react/wallets/using-wallets/evm/sign-a-message

---

## 5. wagmi integration

**Goal:** use wagmi hooks (`useAccount`, `useSendTransaction`, `useWriteContract`) with the Dynamic-connected wallet.

```bash
npm i @dynamic-labs/wagmi-connector@5.12.0 wagmi@2.19.5 @tanstack/react-query@5.104.4
```

```tsx
// src/App.tsx
import { DynamicContextProvider, DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { DynamicWagmiConnector } from '@dynamic-labs/wagmi-connector';
import { createConfig, http, WagmiProvider, useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { parseEther } from 'viem';
import { baseSepolia, worldchainSepolia, unichainSepolia } from 'viem/chains';

// Module top level, not inside a component.
// List every chain you enabled in the Dynamic dashboard; wagmi v2 does NOT read them from Dynamic.
const config = createConfig({
  chains: [baseSepolia, worldchainSepolia, unichainSepolia],
  multiInjectedProviderDiscovery: false, // Dynamic does wallet discovery itself
  transports: {
    [baseSepolia.id]: http(),
    [worldchainSepolia.id]: http(),
    [unichainSepolia.id]: http(),
  },
});
const queryClient = new QueryClient();

export default function App() {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID,
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>
            <DynamicWidget />
            <AccountInfo />
            <SendWithWagmi />
          </DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  );
}

function AccountInfo() {
  const { address, isConnected, chain } = useAccount();
  return <p>wagmi: {isConnected ? address : 'not connected'} on chain {chain?.id}</p>;
}

function SendWithWagmi() {
  const { data: hash, sendTransaction, isPending, error } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  return (
    <div>
      <button
        disabled={isPending}
        onClick={() => sendTransaction({ to: '0x000000000000000000000000000000000000dEaD', value: parseEther('0.0001') })}
      >
        {isPending ? 'Confirm in wallet...' : 'Send 0.0001 ETH'}
      </button>
      {hash && <p>Tx: {hash}</p>}
      {isConfirming && <p>Waiting for confirmation...</p>}
      {isSuccess && <p>Confirmed.</p>}
      {error && <p>{error.message}</p>}
    </div>
  );
}
```

Contract write (wagmi v2):

```tsx
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

const abi = [{ type: 'function', name: 'mint', inputs: [], outputs: [], stateMutability: 'nonpayable' }] as const;

export function MintButton({ address }: { address: `0x${string}` }) {
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  return (
    <div>
      <button disabled={isPending} onClick={() => writeContract({ address, abi, functionName: 'mint' })}>
        {isPending ? 'Confirm...' : 'Mint'}
      </button>
      {isSuccess && <p>Minted: {hash}</p>}
    </div>
  );
}
```

**Notes:**
- Provider order matters: `DynamicContextProvider` > `WagmiProvider` > `QueryClientProvider` > `DynamicWagmiConnector`.
- `@dynamic-labs/wagmi-connector@5.12.0` declares the peer range `wagmi ^2.14.11`. The docs say wagmi v3.1 "may work" but is outside that range. Stay on v2.
- Dynamic's "Mint an NFT with Wagmi" page uses wagmi **v1** hooks (`usePrepareContractWrite`, `useContractWrite`, `useWaitForTransaction`). Those were removed in v2, so use the code above (wagmi docs: https://wagmi.sh/react/api/hooks/useWriteContract).

Sources: https://www.dynamic.xyz/docs/react/reference/using-wagmi, https://www.dynamic.xyz/docs/react/reference/providers/dynamicwagmiconnector, https://wagmi.sh/react/api/hooks/useSendTransaction

---

## 6. Add a custom EVM network

**Goal:** offer a chain that isn't toggled in your dashboard, such as World Chain Sepolia or Unichain Sepolia.

First, check the dashboard (https://console.dynamic.xyz/dashboard/chains-and-networks). If the chain is listed there, just turn it on. Otherwise pass it in code with `overrides.evmNetworks`. Build the network from viem's chain object, so the chain ID, RPC and explorer aren't typed by hand:

```ts
// src/networks.ts
import type { EvmNetwork } from '@dynamic-labs/sdk-react-core';
import type { Chain } from 'viem';
import { worldchainSepolia, unichainSepolia } from 'viem/chains';

export function toEvmNetwork(chain: Chain, iconUrl = 'https://app.dynamic.xyz/assets/networks/eth.svg'): EvmNetwork {
  return {
    chainId: chain.id,
    networkId: chain.id,
    name: chain.name,
    vanityName: chain.name,
    rpcUrls: [...chain.rpcUrls.default.http],
    blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : [],
    iconUrls: [iconUrl],
    nativeCurrency: {
      name: chain.nativeCurrency.name,
      symbol: chain.nativeCurrency.symbol,
      decimals: chain.nativeCurrency.decimals, // must be right: the confirm UI uses it
    },
  };
}

export const customEvmNetworks: EvmNetwork[] = [
  toEvmNetwork(worldchainSepolia), // 4801
  toEvmNetwork(unichainSepolia), // 1301
];
```

```tsx
// src/main.tsx
import { createRoot } from 'react-dom/client';
import { DynamicContextProvider, mergeNetworks } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import App from './App';
import { customEvmNetworks } from './networks';

createRoot(document.getElementById('root')!).render(
  <DynamicContextProvider
    settings={{
      environmentId: import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID,
      walletConnectors: [EthereumWalletConnectors],
      overrides: {
        // keeps dashboard networks; the first argument wins on conflict
        evmNetworks: (dashboardNetworks) => mergeNetworks(customEvmNetworks, dashboardNetworks),
      },
    }}
  >
    <App />
  </DynamicContextProvider>,
);
```

With wagmi, also add the chains to the wagmi config. Dynamic ships a mapper:

```ts
import { createConfig, http } from 'wagmi';
import { getOrMapViemChain } from '@dynamic-labs/ethereum-core'; // npm i @dynamic-labs/ethereum-core@5.12.0
import { customEvmNetworks } from './networks';

const chains = customEvmNetworks.map(getOrMapViemChain);

export const wagmiConfig = createConfig({
  chains: [chains[0], ...chains.slice(1)], // wagmi wants a non-empty tuple
  multiInjectedProviderDiscovery: false,
  transports: Object.fromEntries(chains.map((c) => [c.id, http()])),
});
```

**Notes:**
- If you pass a plain array (`evmNetworks: [...]`), it **replaces** the dashboard networks entirely. The callback plus `mergeNetworks` adds to them instead.
- Public RPCs are rate-limited. For a demo, put your own RPC URL first in `rpcUrls`, or set it in the dashboard.
- Mainnet versions: `worldchain` (480) and `unichain` (130) from `viem/chains`.

Sources: https://www.dynamic.xyz/docs/react/chains/adding-custom-networks, https://www.dynamic.xyz/docs/react/reference/objects/evmNetwork, https://www.dynamic.xyz/docs/react/reference/using-wagmi#adding-custom-networks, https://www.dynamic.xyz/docs/react/reference/utilities/getormapviemchain

---

## 7. Verify the Dynamic JWT on your server

**Goal:** your API knows which Dynamic user (and which wallets) is calling it.

Client side:

```ts
import { getAuthToken } from '@dynamic-labs/sdk-react-core';

export async function callMyApi() {
  const token = getAuthToken(); // undefined if not logged in
  if (!token) throw new Error('Not logged in');
  const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}
```

Server side (Node 18+):

```bash
npm i jsonwebtoken@9.0.3 jwks-rsa@4.1.0 && npm i -D @types/jsonwebtoken
```

```ts
// server/verifyDynamicJwt.ts
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

const ENV_ID = process.env.DYNAMIC_ENVIRONMENT_ID!; // same ID as the frontend
const jwks = new JwksClient({
  jwksUri: `https://app.dynamicauth.com/api/v0/sdk/${ENV_ID}/.well-known/jwks`,
  cache: true,
  cacheMaxAge: 600_000,
  rateLimit: true,
});

export type DynamicJwt = JwtPayload & {
  sub: string; // Dynamic user ID
  scope?: string;
  email?: string;
  verified_credentials?: Array<{ address?: string; chain?: string; id: string; wallet_name?: string }>;
};

export async function verifyDynamicJwt(token: string): Promise<DynamicJwt> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded.payload === 'string') throw new Error('Malformed token');

  const key = await jwks.getSigningKey(decoded.header.kid);
  const payload = jwt.verify(token, key.getPublicKey(), { algorithms: ['RS256'] }) as DynamicJwt;

  // Required by Dynamic: without user:basic the user has NOT finished auth (e.g. MFA pending)
  if (!(payload.scope ?? '').split(' ').includes('user:basic')) {
    throw new Error('Authentication incomplete (no user:basic scope)');
  }
  return payload;
}

export async function userFromRequest(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Missing bearer token');
  const claims = await verifyDynamicJwt(authHeader.slice('Bearer '.length));
  const wallets = (claims.verified_credentials ?? []).filter((c) => c.address).map((c) => c.address);
  return { userId: claims.sub, email: claims.email, wallets };
}
```

**Notes:**
- The JWKS is per environment, so a valid signature already proves the token came from **your** environment. If you also want an `iss` check, decode a real token first to see the exact value. The docs give the format only as an example (`app.dynamicauth.com/<environment_id>`).
- Pin `algorithms: ['RS256']`. Dynamic signs with RS256. The official example leaves this out, so add it.
- Use `sub` as the user ID. Trust `email` and `verified_credentials` only after `verify` passes.
- Send only the access token (from `getAuthToken()`), never the ID token, and never log JWTs ([source](https://www.dynamic.xyz/docs/auth/tokens#security)).
- Using Next.js with NextAuth, or Passport? There are official options for both: https://www.dynamic.xyz/docs/recipes/frameworks/next-auth and https://github.com/dynamic-labs/passport-dynamic

Sources: https://www.dynamic.xyz/docs/auth/tokens, https://www.dynamic.xyz/docs/auth/dynamic-auth/protect-servers, https://www.dynamic.xyz/docs/react/reference/utilities/getauthtoken

---

## 8. Next.js App Router

Put the provider in a client component and wrap `app/layout.tsx` with it:

```tsx
'use client';
// app/providers.tsx
import type { ReactNode } from 'react';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID!,
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}
```

**Notes:**
- Wrap login-dependent UI in `<IsBrowser>` (from `@dynamic-labs/sdk-react-core`) to avoid hydration errors ([source](https://www.dynamic.xyz/docs/get-started/troubleshooting/next/hydration-failed)).
- Next.js doesn't need the Vite polyfill, but webpack may need `config.externals.push('pino-pretty', 'lokijs', 'encoding')` ([source](https://www.dynamic.xyz/docs/get-started/troubleshooting/next/module-not-found)).
- Not tested in a real Next.js build. Only the component above was type-checked.
