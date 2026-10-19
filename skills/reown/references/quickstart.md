# Reown AppKit quickstart (Vite + React + wagmi)

Based on https://docs.reown.com/appkit/react/core/installation.md and the official example https://github.com/reown-com/appkit-web-examples/tree/main/react/react-wagmi. For Next.js, use [recipes.md#2](recipes.md#2-nextjs-app-router-with-ssr-and-cookies).

## 1. Get a projectId (2 minutes)

1. Go to https://dashboard.reown.com and sign in (email, Google or GitHub).
2. Create a new project (follow the dashboard's prompts; the layout changes from time to time and I couldn't check it without an account). Copy the **Project ID** from the project page. It is public: it ships in your frontend bundle, so it is not a secret.
3. Domains: `localhost`, `127.0.0.1`, `*.vercel.app`, `*.pages.dev` and `*.ngrok-free.app` are allowed by default (the `DEFAULT_ALLOWED_ANCESTORS` list in `@reown/appkit-common@1.8.24`). For any other domain, add it in the dashboard under the project's **Domain** section ("+ Domain", then "Allowlist"). Source: https://docs.reown.com/cloud/dashboard-configuration-settings.md
4. Optional toggles live in the same dashboard Configuration page: **Social & Email Logins**, **Reown Authentication** (SIWX), Swaps, Onramp. Dashboard values win over the `features` in your code (see [errors.md #4](errors.md)).

The free **Starter** plan gives 1 project, 1 team member, 500 MAU and 2.5M RPC calls. Going over the limits pauses the project. Social & email login, Reown Authentication, swaps and onramp can all be turned on in Starter. Source: https://docs.reown.com/appkit/paid-plans/starter.md

## 2. Scaffold and install

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm i -E @reown/appkit@1.8.24 @reown/appkit-adapter-wagmi@1.8.24 wagmi@2.19.5 @wagmi/core@2.22.1 @wagmi/connectors@6.2.0 viem@2.57.7 @tanstack/react-query@5.104.4
```

- Tested with `create-vite@9.3.0`. It scaffolds Vite 8.3.4, React 19.3 and TypeScript 7.0.2, and `npm run build` (`tsc -b && vite build`) passed. Vite 7.3.7 also works.
- AppKit 1.8.x pairs with **wagmi 2**. Install `@wagmi/core@2.22.1` and `@wagmi/connectors@6.2.0` yourself. Without them, npm 11 puts `@wagmi/core@3` at the top level (the adapter's peer range is `>=2.21.2`) and `WagmiProvider config={...}` fails to type-check.
- Run `npm view @reown/appkit version` before you start. If there is a newer version, move every `@reown/*` package to it together.
- Recent npm versions may print `install-scripts ... not yet covered by allowScripts` warnings for `@reown/appkit`, `keccak`, `bufferutil` and others. The app built and ran in testing without approving any of them.

## 3. Env

`.env.local`:

```bash
VITE_PROJECT_ID=<YOUR_PROJECT_ID>
```

## 4. Code

`src/config.ts`

```ts
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { baseSepolia, sepolia, type AppKitNetwork } from '@reown/appkit/networks'

// Get a projectId at https://dashboard.reown.com
export const projectId = import.meta.env.VITE_PROJECT_ID as string
if (!projectId) throw new Error('VITE_PROJECT_ID is not set')

// The type annotation matters: networks must be a non-empty tuple
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [sepolia, baseSepolia]

export const wagmiAdapter = new WagmiAdapter({ projectId, networks })
```

`src/main.tsx`

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createAppKit } from '@reown/appkit/react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { projectId, networks, wagmiAdapter } from './config'
import App from './App'

const queryClient = new QueryClient()

// Call createAppKit once, outside any component
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  metadata: {
    name: 'My Hack',
    description: 'ETHGlobal Mumbai project',
    url: 'http://localhost:5173', // must match the origin the app runs on
    icons: ['https://avatars.githubusercontent.com/u/179229932'],
  },
  features: { analytics: true },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
```

`src/App.tsx`: connect, show the balance, sign, send.

```tsx
import { AppKitButton, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react'
import { useSignMessage, useSendTransaction, useWaitForTransactionReceipt, useBalance } from 'wagmi'
import { parseEther, type Address } from 'viem'

export default function App() {
  const { address, isConnected } = useAppKitAccount()
  const { chainId } = useAppKitNetwork()
  const { data: balance } = useBalance({ address: address as Address | undefined })
  const { signMessageAsync } = useSignMessage()
  const { data: hash, sendTransaction, isPending } = useSendTransaction()
  const { isSuccess: confirmed } = useWaitForTransactionReceipt({ hash })

  return (
    <main>
      <AppKitButton />
      {isConnected && (
        <>
          <p>{address} on chain {chainId}</p>
          <p>Balance: {balance ? `${balance.formatted} ${balance.symbol}` : '...'}</p>
          <button onClick={async () => alert(await signMessageAsync({ message: 'Hello from my hack' }))}>
            Sign message
          </button>
          <button
            disabled={isPending}
            onClick={() => sendTransaction({ to: address as Address, value: parseEther('0.0001') })}
          >
            Send 0.0001 to myself
          </button>
          {hash && <p>Tx {hash} {confirmed ? 'confirmed' : 'pending'}</p>}
        </>
      )}
    </main>
  )
}
```

`<AppKitButton />` is the React wrapper for the `<appkit-button>` web component. Its siblings are `AppKitConnectButton`, `AppKitAccountButton` and `AppKitNetworkButton`. Source: https://docs.reown.com/appkit/react/core/components.md

## 5. Run

```bash
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
```

Use testnet ETH (Sepolia / Base Sepolia) for the send button. It sends 0.0001 to your own address.

## Notes

- No `process.env` polyfill or `vite.config.ts` change was needed with Vite 7 or 8 (tested: production build loaded in headless Chromium with no page errors). The official example still has `define: { 'process.env': {} }`. Add it only if you see `process is not defined`.
- `metadata.url` should match the page origin. Wallets use it with the Verify API to label your app as verified or not. Source: https://docs.reown.com/appkit/react/core/installation.md
- `features.analytics` defaults to your dashboard setting.
