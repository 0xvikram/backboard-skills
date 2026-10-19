# Privy errors and gotchas

Items marked **(reproduced)** were hit in our test project on 2026-10-19. The others come from Privy's docs.

---

### 1. `verifyAccessToken` always throws, or TS2345 `'{ access_token: string; }' is not assignable to parameter of type 'string'` (reproduced)

**Cause:** the access-token docs page shows `privy.utils().auth().verifyAccessToken({access_token: accessToken})`. In `@privy-io/node@0.36.0` the method takes the token string. If you pass an object, it fails type-check, and in plain JS it always throws `Failed to verify authentication token`.

**Fix:**
```ts
const claims = await privy.utils().auth().verifyAccessToken(accessToken);
claims.user_id; // snake_case: user_id, app_id, session_id, issued_at, expiration
```
The docs table also lists camelCase fields (`userId`); the 0.36.0 types return snake_case. Check `node_modules/@privy-io/node/lib/auth.d.ts` if you are on a newer version.
Source: https://docs.privy.io/authentication/user-authentication/access-tokens

---

### 2. TS2353 `'createOnLogin' does not exist in type ...` in `embeddedWallets` (reproduced)

**Cause:** an older config shape (`embeddedWallets.createOnLogin`, `requireUserPasswordOnCreate`) still appears in the wagmi integration page. In v3 the setting is per chain.

**Fix:**
```ts
embeddedWallets: {ethereum: {createOnLogin: 'users-without-wallets'}}
```
Source: https://docs.privy.io/basics/react/advanced/automatic-wallet-creation

---

### 3. `next build` fails: `Cannot initialize the Privy provider with an invalid Privy app ID` (reproduced)

**Cause:** `NEXT_PUBLIC_PRIVY_APP_ID` is missing, empty or fake while Next prerenders pages. The SDK checks that the app ID is a 25-character string.

**Fix:** set the real App ID (Dashboard > Configuration > App settings > Basics) in `.env.local` and in your host's env settings (for example Vercel) **before** building. `NEXT_PUBLIC_` values are baked in at build time.
Source: https://docs.privy.io/basics/get-started/dashboard/create-new-app

---

### 4. `next build` fails: `Failed to collect page data for /api/...` / `The PRIVY_APP_ID environment variable is missing or empty` (reproduced)

**Cause:** `new PrivyClient(...)` at the top of a route file runs while the build collects page data, and the server env vars are not set.

**Fix:** set `PRIVY_APP_ID` and `PRIVY_APP_SECRET` in the build environment, or create the client inside the handler.
Source: https://docs.privy.io/basics/nodeJS/setup

---

### 5. `Multiple PrivyProvider instances found` (reproduced)

**Cause:** two `PrivyProvider`s are mounted, for example one in `layout.tsx` and another in a nested layout or in a wagmi providers file.

**Fix:** render exactly one `PrivyProvider` near the root. When you add wagmi, replace your provider file with the combined Privy + QueryClient + Wagmi one ([recipes.md #5](recipes.md#5-use-wagmi-hooks-with-privy)).
Source: https://docs.privy.io/basics/react/setup

---

### 6. Next.js App Router: `TypeError: (0 , b.createContext) is not a function` / `Failed to collect configuration` (reproduced)

**Cause:** `PrivyProvider` (or a Privy hook) is imported straight into a Server Component such as `app/layout.tsx`. The package does not mark itself `'use client'`.

**Fix:** put the provider in its own file that starts with `'use client'` and import that wrapper in `app/layout.tsx`. Every component that calls a Privy hook also needs `'use client'`.
Source: https://docs.privy.io/basics/troubleshooting/react-frameworks (NextJS tab)

---

### 7. User logs in but has no embedded wallet

**Cause:** `createOnLogin` only runs for the Privy modal (`login()`). It does not run for whitelabel logins such as `loginWithCode` or `useLoginWithOAuth`. It also defaults to `'off'`.

**Fix:** set `embeddedWallets.ethereum.createOnLogin`, or call `useCreateWallet().createWallet()` after a whitelabel login ([recipes.md #1](recipes.md#1-custom-email-otp-login-whitelabel)).
Source: https://docs.privy.io/basics/react/advanced/automatic-wallet-creation

---

### 8. `Wallet proxy not initialized`, or `wallets` is empty right after login

**Cause:** code uses wallets before Privy is ready, or the origin is not allowed.

**Fix:** wait for `ready` from `usePrivy()` **and** `ready` from `useWallets()`. Check that your origin is in Dashboard > Configuration > App settings > Domains.
Source: https://docs.privy.io/basics/troubleshooting/error-handling/client-errors

---

### 9. `invalid_origin`, or login works on localhost but not on your deployed URL

**Cause:** you set Allowed Origins (or use an app client with `clientId`) and the deployed origin is not listed. Embedded wallets also need `https://`: they use WebCrypto, which only works on secure pages (`http://localhost` counts as secure).

**Fix:** add `https://your-app.vercel.app` (with protocol, no path; add both `www` and non-`www` if needed) under Allowed Origins, and deploy on HTTPS.
Sources: https://docs.privy.io/recipes/react/allowed-domains, https://docs.privy.io/basics/troubleshooting/troubleshooting-embedded-wallets

---

### 10. Email codes stop arriving during a demo

**Cause:** rate limits. Normal accounts get 5 email OTP requests every 5 minutes (5 per 10 minutes for SMS).

**Fix:** turn on test accounts (Dashboard > User management > Authentication > Advanced). The `test-XXXX@privy.io` login has a fixed OTP and a looser limit in development apps.
Source: https://docs.privy.io/recipes/using-test-accounts

---

### 11. Sending on World Chain / Unichain throws, or the wallet stays on Ethereum

**Cause:** the chain is not in `supportedChains` (it is not in Privy's default list), or `defaultChain` is not also in `supportedChains`.

**Fix:** pass both `defaultChain` and `supportedChains` from `viem/chains` ([recipes.md #7](recipes.md#7-add-world-chain-unichain-or-any-custom-chain)). With viem, call `wallet.switchChain(id)` before `getEthereumProvider()`.
Source: https://docs.privy.io/basics/react/advanced/configuring-evm-networks

---

### 12. Vite: `process is not defined` (Coinbase SDK) or Solana optional-peer build errors

**Fix:** add `vite-plugin-node-polyfills`. If you don't use Solana, add the `@solana-program/system` alias shim from the docs.
Source: https://docs.privy.io/basics/troubleshooting/react-frameworks (Vite tab)

---

### 13. World mini app: `has no default export` / `Property 'walletAuth' does not exist on type 'never'` (reproduced)

**Cause:** Privy's World mini-app page uses the MiniKit 1.x API (`import MiniKit from '@worldcoin/minikit-js'`, `MiniKit.commandsAsync.walletAuth`). In `@worldcoin/minikit-js@2.0.3`, `MiniKit` is a named export, `commandsAsync` is deprecated and typed `never`, and the result comes back in `.data`.

**Fix:** `import {MiniKit} from '@worldcoin/minikit-js'` and `const {data} = await MiniKit.walletAuth({nonce})` ([recipes.md #8](recipes.md#8-world-mini-app-login-siwe-through-world-app)).
Source: https://docs.privy.io/recipes/world/mini-apps, types in `@worldcoin/minikit-js@2.0.3`
