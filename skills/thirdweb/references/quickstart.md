# thirdweb quickstart (full)

Tested 2026-10-19 with `thirdweb@5.122.0`, `next@16.4.2`, `react@19.3.0`, Node 24. The SDK needs Node >= 18
(`engines` in the thirdweb package.json).

Sources: https://portal.thirdweb.com/react/v5/getting-started, https://portal.thirdweb.com/typescript/v5/getting-started,
https://portal.thirdweb.com/references/typescript/v5/createThirdwebClient

## 1. Get a Client ID (and Secret Key)

1. Go to https://thirdweb.com/team and sign in (or https://thirdweb.com/create-api-key).
2. Click **Projects** → create a project.
3. In **allowed domains**, add `localhost` (and later your deployed domain, for example `my-app.vercel.app`).
4. Copy the **Client ID**. It is public and safe to use in frontend code.
5. Save the **Secret Key** somewhere safe. Use it only on servers and in scripts. Never ship it to the browser.

| Key | Where it goes | Limited by allowed domains? |
|---|---|---|
| Client ID | Browser / React (`NEXT_PUBLIC_...`, `VITE_...`) | yes |
| Secret Key | Server routes, Node scripts, CLI `-k`, MCP | no, so keep it secret |

The client gives you thirdweb's built-in RPC, IPFS storage and wallet services. One client per app is enough.

## 2. Next.js (App Router)

```bash
npx create-next-app@16.4.2 my-app --ts --app --src-dir --use-npm --yes
cd my-app
npm i thirdweb@5.122.0
# Needed in Next.js as of 2026-10-19, or dev/build fails with
# "Module not found: Can't resolve '@x402/core/client'" (see errors.md #1)
npm i @x402/core@2.28.0 @x402/evm@2.28.0 @x402/svm@2.28.0
```

`.env.local`
```bash
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=<YOUR_CLIENT_ID>
# server-only, no NEXT_PUBLIC_ prefix:
THIRDWEB_SECRET_KEY=<YOUR_SECRET_KEY>
```

`src/app/client.ts`
```ts
import { createThirdwebClient } from "thirdweb";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
if (!clientId) throw new Error("Set NEXT_PUBLIC_THIRDWEB_CLIENT_ID in .env.local");

export const client = createThirdwebClient({ clientId });
```
The `if` check matters. `process.env.X` is `string | undefined`, and `createThirdwebClient({ clientId: process.env.X })` fails type-checking.

`src/app/layout.tsx` (keep what create-next-app made and add the provider)
```tsx
import { ThirdwebProvider } from "thirdweb/react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThirdwebProvider>{children}</ThirdwebProvider>
      </body>
    </html>
  );
}
```
`ThirdwebProvider` can be used directly in the server `layout.tsx`. The official next-starter does this too:
https://github.com/thirdweb-example/next-starter

`src/app/page.tsx`. Any file that uses thirdweb hooks or `ConnectButton` needs `"use client"`.
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

Run:
```bash
npm run dev     # http://localhost:3000
npm run build   # should pass. If it fails on @x402/*, see errors.md #1
```

If you leave out `wallets`, `ConnectButton` shows a default list: in-app wallet plus popular external wallets.
Wallet IDs for `createWallet(...)`: https://portal.thirdweb.com/typescript/v5/supported-wallets

## 3. Vite + React (alternative)

```bash
npm create vite@9.2.1 my-app -- --template react-ts   # scaffold step not tested; the build below was tested with vite@8.3.4
cd my-app && npm i thirdweb@5.122.0
```
`.env`: `VITE_THIRDWEB_CLIENT_ID=<YOUR_CLIENT_ID>`

```ts
// src/client.ts
import { createThirdwebClient } from "thirdweb";
export const client = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
});
```
Type the env var in `src/vite-env.d.ts` with `interface ImportMetaEnv { readonly VITE_THIRDWEB_CLIENT_ID: string }`.
Wrap `<App />` in `<ThirdwebProvider>` in `main.tsx`, then use the same `ConnectButton` code as above. The Vite build did not need the
`@x402/*` packages (tested). Official starter: https://github.com/thirdweb-example/vite-starter

## 4. Node script / backend

```bash
npm i thirdweb@5.122.0 && npm i -D tsx@4.23.15 typescript@5.9.3
```

```ts
// read.ts (run with: npx tsx read.ts). Put "type": "module" in package.json for top-level await.
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";

const client = createThirdwebClient({ secretKey: process.env.THIRDWEB_SECRET_KEY! });

const usdc = getContract({
  client,
  chain: baseSepolia,
  address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
});

const symbol = await readContract({
  contract: usdc,
  method: "function symbol() view returns (string)",
  params: [],
});
console.log(symbol); // "USDC"
```
For writes from a script, see recipes.md #4 (`privateKeyToAccount`) and #5 (deploy).

## 5. About `npx thirdweb create app`

The React getting-started page still shows `npx thirdweb create app`. In `thirdweb@5.122.0` the CLI prints
"The 'thirdweb create' command is deprecated. Please use the thirdweb dashboard instead" and exits
(`dist/esm/cli/bin.js`). Use create-next-app or Vite as shown above, or clone
https://github.com/thirdweb-example/next-starter or https://github.com/thirdweb-example/vite-starter.
