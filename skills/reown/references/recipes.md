# Reown AppKit recipes

Every block below was type-checked against @reown/appkit@1.8.24, wagmi@2.19.5 and viem@2.57.7. The Next.js recipe also passed `next build` (Next 16.4.2). The setup (`config.ts`, `main.tsx`) is in [quickstart.md](quickstart.md).

## 1. Read account, sign a message, send a transaction

Goal: show who is connected, ask for a signature, send native tokens.
Based on: https://docs.reown.com/appkit/recipes/wagmi-send-transaction.md and https://docs.reown.com/appkit/react/core/hooks.md

```tsx
import { AppKitButton, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react'
import { useSignMessage, useSendTransaction, useWaitForTransactionReceipt, useBalance } from 'wagmi'
import { parseEther, type Address } from 'viem'

export default function Wallet() {
  const { address, isConnected, status, embeddedWalletInfo } = useAppKitAccount()
  const { chainId, caipNetwork } = useAppKitNetwork()
  const { data: balance } = useBalance({ address: address as Address | undefined })
  const { signMessageAsync } = useSignMessage()
  const { data: hash, sendTransaction, isPending, error } = useSendTransaction()
  const { isSuccess: confirmed } = useWaitForTransactionReceipt({ hash })

  if (!isConnected) return <AppKitButton />
  return (
    <div>
      <p>{address} ({status}) on {caipNetwork?.name} / {chainId}</p>
      {embeddedWalletInfo && <p>Email/social login via {embeddedWalletInfo.authProvider}</p>}
      <p>{balance?.formatted} {balance?.symbol}</p>
      <button onClick={async () => console.log(await signMessageAsync({ message: 'gm' }))}>Sign</button>
      <button disabled={isPending} onClick={() => sendTransaction({ to: address as Address, value: parseEther('0.0001') })}>
        Send
      </button>
      {hash && <p>{hash} {confirmed ? 'confirmed' : 'pending'}</p>}
      {error && <p>{error.message}</p>}
    </div>
  )
}
```

Notes:
- Use AppKit hooks for **connection state** (`useAppKitAccount`, `useAppKitNetwork`) and wagmi hooks for **chain actions**. The wagmi hooks work because AppKit's adapter supplies the wagmi config.
- `useAppKitAccount().address` is a plain `string`. Cast it to viem's `Address` before passing it to wagmi.
- An email/social wallet's signature can be longer than 65 bytes until its smart account is deployed. Verify it with `publicClient.verifyMessage` (recipe 7), not with `recoverMessageAddress`. Source: https://docs.reown.com/appkit/faq.md (Technical: "Why are signatures longer").

## 2. Next.js App Router with SSR and cookies

Goal: AppKit + wagmi in Next.js. A cookie keeps the connection across reloads without a hydration mismatch.
Based on: https://docs.reown.com/appkit/next/core/installation.md and https://github.com/reown-com/appkit-web-examples/tree/main/nextjs/next-wagmi-app-router

```bash
npx create-next-app@16.4.2 my-app --ts --app --no-src-dir --import-alias "@/*" --no-tailwind --no-eslint --use-npm --yes && cd my-app
npm i -E @reown/appkit@1.8.24 @reown/appkit-adapter-wagmi@1.8.24 wagmi@2.19.5 @wagmi/core@2.22.1 @wagmi/connectors@6.2.0 viem@2.57.7 @tanstack/react-query@5.104.4
echo 'NEXT_PUBLIC_PROJECT_ID=<YOUR_PROJECT_ID>' > .env.local
```

`next.config.ts`: **required** on Next 16 (see [errors.md #2](errors.md)). Keep any options create-next-app already put there.

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@coinbase/cdp-sdk'],
}

export default nextConfig
```

The files below sit at the project root (`config/`, `context/`, `app/`). If you chose a `src/` folder, put them under `src/`; the `@/` alias follows.

`config/index.ts`: no `'use client'`. The server imports it too.

```ts
import { cookieStorage, createStorage } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { sepolia, baseSepolia, type AppKitNetwork } from '@reown/appkit/networks'

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID
if (!projectId) throw new Error('NEXT_PUBLIC_PROJECT_ID is not set')

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [sepolia, baseSepolia]

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks,
})
```

`context/index.tsx`

```tsx
'use client'

import { wagmiAdapter, projectId, networks } from '@/config'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { type ReactNode } from 'react'
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi'

const queryClient = new QueryClient()

createAppKit({
  adapters: [wagmiAdapter],
  projectId: projectId!,
  networks,
  metadata: {
    name: 'My Hack',
    description: 'ETHGlobal Mumbai project',
    url: 'http://localhost:3000', // set to your deployed origin later
    icons: ['https://avatars.githubusercontent.com/u/179229932'],
  },
  features: { analytics: true },
})

export default function ContextProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies)
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
```

`app/layout.tsx`

```tsx
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import ContextProvider from '@/context'
import './globals.css'

export const metadata: Metadata = { title: 'My Hack' }

// Reads the wagmi cookie so the first render already knows the connected account
async function Providers({ children }: { children: React.ReactNode }) {
  const cookies = (await headers()).get('cookie')
  return <ContextProvider cookies={cookies}>{children}</ContextProvider>
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {/* Suspense is needed when next.config has cacheComponents: true (create-next-app 16.4 default) */}
        <Suspense>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  )
}
```

`app/page.tsx`: any component that uses hooks needs `'use client'`.

```tsx
'use client'

import { AppKitButton, useAppKitAccount } from '@reown/appkit/react'

export default function Home() {
  const { address, isConnected } = useAppKitAccount()
  return (
    <main>
      <AppKitButton />
      {isConnected && <p>Connected: {address}</p>}
    </main>
  )
}
```

Notes:
- The docs' layout calls `await headers()` directly in `RootLayout` with no `Suspense`. That fails `next build` when `cacheComponents: true` is set, which create-next-app 16.4.2 does by default. The `Suspense` version above builds both with and without `cacheComponents`.
- The docs also add `webpack: config => { config.externals.push('pino-pretty', 'lokijs', 'encoding') }`. Next 16 builds with Turbopack and **errors** when a `webpack` key is present without `--webpack`. Turbopack didn't need it in testing. Add it only if you build with `next build --webpack`.
- The wagmi docs say AppKit "doesn't fully support the `ssr` flag". It still built and rendered in testing. Source: https://docs.reown.com/appkit/next/core/installation.md (SSR and Hydration).

## 3. Your own buttons: open views, switch network, disconnect

Goal: replace `<AppKitButton />` with your own UI.
Based on: https://docs.reown.com/appkit/react/core/hooks.md (useAppKit, useAppKitNetwork, useDisconnect)

```tsx
import { useAppKit, useAppKitAccount, useAppKitNetwork, useDisconnect } from '@reown/appkit/react'
import { worldchainSepolia } from '@reown/appkit/networks'

export function Buttons() {
  const { open } = useAppKit()
  const { isConnected, address } = useAppKitAccount()
  const { chainId, switchNetwork } = useAppKitNetwork()
  const { disconnect } = useDisconnect()
  if (!isConnected) return <button onClick={() => open()}>Connect</button>
  return (
    <div>
      <span>{address?.slice(0, 6)}… chain {chainId}</span>
      <button onClick={() => open({ view: 'Account' })}>Account</button>
      <button onClick={() => open({ view: 'Networks' })}>Networks</button>
      <button onClick={() => switchNetwork(worldchainSepolia)}>Use World Chain Sepolia</button>
      <button onClick={() => disconnect()}>Disconnect</button>
    </div>
  )
}
```

Notes: `switchNetwork` only accepts a network you passed to `createAppKit({ networks })`. Here that is `worldchainSepolia`, so add it to `networks` (recipe 4). Other views: `Connect`, `AllWallets`, `WalletSend`, `Swap`, `OnRampProviders`.

## 4. Sponsor chains and your own RPC

Goal: World Chain, Unichain, Hedera, Arc, 0G and Whitechain in the network list.
Based on: https://docs.reown.com/appkit/react/core/options.md (networks, defaultNetwork, customRpcUrls) and https://docs.reown.com/appkit/networks/custom-networks.md

```ts
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { createAppKit } from '@reown/appkit/react'
import {
  worldchain, worldchainSepolia,
  unichain, unichainSepolia,
  hedera, hederaTestnet,
  arc, arcTestnet,
  zeroGMainnet, zeroGTestnet,
  whitechainSepolia,
  type AppKitNetwork,
} from '@reown/appkit/networks'
import type { CustomRpcUrlMap } from '@reown/appkit-common'

const projectId = import.meta.env.VITE_PROJECT_ID as string

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  worldchainSepolia, // 4801
  unichainSepolia,   // 1301
  hederaTestnet,     // 296
  arcTestnet,        // 5042002
  zeroGTestnet,      // 16602 (0G Galileo). Not `zeroG` (16600, old Newton testnet)
  whitechainSepolia, // 1874
  worldchain, unichain, hedera, arc, zeroGMainnet,
]

// Optional: your own RPC per chain (CAIP-2 key, array of { url })
const customRpcUrls: CustomRpcUrlMap = {
  'eip155:4801': [{ url: 'https://worldchain-sepolia.g.alchemy.com/public' }],
}

export const wagmiAdapter = new WagmiAdapter({ projectId, networks, customRpcUrls })

export const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  defaultNetwork: worldchainSepolia,
  customRpcUrls, // pass the same map to both
  metadata: { name: 'My Hack', description: 'Demo', url: 'http://localhost:5173', icons: [] },
})
```

Notes:
- `@reown/appkit-common` is installed as a dependency of `@reown/appkit`. Importing the `CustomRpcUrlMap` type from it type-checks. Add it to `package.json` (same version) if your linter complains.
- If a chain is not on Reown's Blockchain API list, AppKit uses the chain's public RPC from viem. That is every sponsor chain except Unichain. Public RPCs are rate-limited, so put a real RPC (Alchemy, QuickNode, the chain's own) in `customRpcUrls` before your demo.
- `customRpcUrls` values are **arrays of `{ url }`**. The custom-networks page and the FAQ show a plain string, which fails type-checking ([errors.md #5](errors.md)).
- In Next.js, use `process.env.NEXT_PUBLIC_PROJECT_ID` and keep the cookie storage from recipe 2.
- `createAppKit` can only be called once, so list every network up front. Source: https://docs.reown.com/appkit/faq.md

## 5. A chain that is not exported (defineChain)

Goal: add an EVM chain that `@reown/appkit/networks` doesn't have, such as a local devnet or a brand-new testnet.
Based on: https://docs.reown.com/appkit/networks/custom-networks.md

```ts
import { defineChain } from '@reown/appkit/networks'

export const myChain = defineChain({
  id: 123456789,
  caipNetworkId: 'eip155:123456789',
  chainNamespace: 'eip155',
  name: 'My Chain',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: ['https://rpc.my-chain.example'] } },
  blockExplorers: { default: { name: 'Explorer', url: 'https://explorer.my-chain.example' } },
  testnet: true,
})
```

Then add `myChain` to `networks`. To set its logo, pass `chainImages: { 123456789: '/logo.png' }` to `createAppKit`. The docs' example leaves out `rpcUrls`, but you need it: wagmi uses it as the transport.

## 6. Email and social login

Goal: let users sign in with email (OTP), Google, X, GitHub, Discord, Apple, Facebook or Farcaster. AppKit then creates a non-custodial wallet for them.
Based on: https://docs.reown.com/appkit/react/core/socials.md and https://docs.reown.com/appkit/authentication/socials.md

**Turn it on in the dashboard first**: Configuration → *Social & Email Logins* → choose providers → *Apply*. It is available on the free Starter plan ([starter plan](https://docs.reown.com/appkit/paid-plans/starter.md)). When the dashboard config loads, it **overrides** the `features` below. Your code only applies when the dashboard config can't be fetched.

```ts
import { createAppKit } from '@reown/appkit/react'
import { sepolia, type AppKitNetwork } from '@reown/appkit/networks'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'

const projectId = import.meta.env.VITE_PROJECT_ID as string
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [sepolia]
const wagmiAdapter = new WagmiAdapter({ projectId, networks })

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  metadata: { name: 'My Hack', description: 'Demo', url: 'http://localhost:5173', icons: [] },
  features: {
    email: true,
    socials: ['google', 'x', 'github', 'discord', 'apple', 'farcaster'],
    emailShowWallets: true,
  },
  allWallets: 'SHOW',
})
```

Show who logged in:

```tsx
import { useAppKitAccount } from '@reown/appkit/react'

export function EmbeddedInfo() {
  const { embeddedWalletInfo } = useAppKitAccount()
  if (!embeddedWalletInfo) return null // external wallet, not email/social
  return (
    <p>
      Logged in with {embeddedWalletInfo.authProvider} as {embeddedWalletInfo.user?.email ?? embeddedWalletInfo.user?.username}
      {' '}({embeddedWalletInfo.accountType})
    </p>
  )
}
```

Notes:
- Email/social wallets are run by Reown, with keys handled by Magic. They sign through `secure.walletconnect.org` and **only transact reliably on chains Reown's Blockchain API serves**. Among the sponsor chains that is Unichain (130, 1301). Users can log in on World Chain, Hedera, Arc, 0G or Whitechain, but transactions there may fail. Test early, or ask users to connect an external wallet for those chains. Source: https://docs.reown.com/appkit/networks/overview.md
- Facebook login doesn't work on mobile. Each email/social user counts toward the 500 MAU free limit.

## 7. Sign In With X (SIWX)

Goal: make the user sign a message on connect so your app knows they own the address.
Based on: https://docs.reown.com/appkit/authentication/siwx/default.md, https://docs.reown.com/appkit/authentication/siwx/reown-authentication.md and https://docs.reown.com/appkit/authentication/siwx/siwx-default.md

```bash
npm i -E @reown/appkit-siwx@1.8.24
```

**Option A: Reown Authentication** (hosted; sessions show in the dashboard). Turn on *Reown Authentication* in the dashboard Configuration page too.

```ts
import { createAppKit } from '@reown/appkit/react'
import { ReownAuthentication } from '@reown/appkit-siwx'
import { sepolia, type AppKitNetwork } from '@reown/appkit/networks'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'

const projectId = import.meta.env.VITE_PROJECT_ID as string
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [sepolia]
const wagmiAdapter = new WagmiAdapter({ projectId, networks })

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  metadata: { name: 'My Hack', description: 'Demo', url: 'http://localhost:5173', icons: [] },
  siwx: new ReownAuthentication(), // or new ReownAuthentication({ required: false })
})
```

Read the signed-in account (it throws if there is no session):

```ts
import { ReownAuthentication } from '@reown/appkit-siwx'

export const auth = new ReownAuthentication()

export async function whoAmI() {
  const account = await auth.getSessionAccount() // throws if not signed in
  return account
}
```

**Option B: DefaultSIWX** (no Reown server). Sessions live in localStorage and the browser does the check. Good for gating UI, **not** for protecting a backend.

```ts
import { DefaultSIWX, InformalMessenger, EIP155Verifier, LocalStorage } from '@reown/appkit-siwx'

export const siwx = new DefaultSIWX({
  messenger: new InformalMessenger({
    domain: 'localhost:5173',
    uri: 'http://localhost:5173',
    getNonce: async () => crypto.randomUUID(),
  }),
  verifiers: [new EIP155Verifier()],
  storage: new LocalStorage({ key: '@my-hack/siwx' }),
})
// createAppKit({ ..., siwx })
```

Check whether SIWX is on. The hook is in **`@reown/appkit-siwx/react`**, not `@reown/appkit/react` as the hooks page says:

```tsx
import { useAppKitSIWX } from '@reown/appkit-siwx/react'

export function SiwxStatus() {
  const siwx = useAppKitSIWX()
  return <p>SIWX {siwx ? 'enabled' : 'off'}</p>
}
```

**Protecting your own API.** The simplest backend check: the client signs a message containing a nonce from your server (`useSignMessage`), and the server verifies it. `publicClient.verifyMessage` also accepts smart-account signatures from email/social wallets (ERC-1271/6492), so use it instead of `recoverMessageAddress`. Based on https://viem.sh/docs/actions/public/verifyMessage

```ts
import { createPublicClient, http, type Address, type Hex } from 'viem'
import { sepolia } from 'viem/chains'

const client = createPublicClient({ chain: sepolia, transport: http() })

export async function verify(address: Address, message: string, signature: Hex) {
  return client.verifyMessage({ address, message, signature })
}
```

Notes:
- If *Reown Authentication* is on in the dashboard, AppKit **replaces** any `siwx` you pass with `ReownAuthentication` and logs `SIWX configuration will be overridden` (seen in `@reown/appkit@1.8.24` source). Turn the toggle off to use DefaultSIWX.
- You can't pass both `siweConfig` (old `@reown/appkit-siwe`) and `siwx`, or `createAppKit` throws. SIWE configs are mapped to SIWX automatically since 1.5.0. For new code use SIWX.
- Reading Reown Authentication users from your backend needs an "AppKit Auth API" secret from the dashboard (Configuration → Secret). Its API isn't documented in the pages I read, so check https://docs.reown.com/cloud/dashboard-configuration-settings.md before relying on it.

## 8. Contract read and write

Goal: read state and send a contract call.
Based on: https://docs.reown.com/appkit/next/core/installation.md (Smart Contract Interaction) and https://wagmi.sh/react/api/hooks/useWriteContract

```tsx
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { erc20Abi, parseUnits, type Address } from 'viem'
import { useAppKitAccount } from '@reown/appkit/react'

const TOKEN: Address = '0x0000000000000000000000000000000000000000' // your token

export function Contract() {
  const { address } = useAppKitAccount()
  const { data: bal } = useReadContract({
    address: TOKEN, abi: erc20Abi, functionName: 'balanceOf',
    args: [address as Address], query: { enabled: !!address },
  })
  const { data: hash, writeContract, error } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })
  return (
    <div>
      <p>Balance: {bal?.toString()}</p>
      <button onClick={() => writeContract({
        address: TOKEN, abi: erc20Abi, functionName: 'transfer',
        args: ['0x000000000000000000000000000000000000dEaD', parseUnits('1', 18)],
      })}>Transfer 1</button>
      {isSuccess && <p>Done: {hash}</p>}
      {error && <p>{error.message}</p>}
    </div>
  )
}
```

Notes: these are plain wagmi v2 hooks, so the wagmi docs apply as written. Pass `chainId` to pin a call to one network.
