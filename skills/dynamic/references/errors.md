# Dynamic: errors and gotchas

General first steps from Dynamic: try to reproduce on https://demo.dynamic.xyz, then in a fresh quickstart app, then run Dynamic Doctor (https://www.dynamic.xyz/docs/get-started/troubleshooting/dynamic-doctor). Source: https://www.dynamic.xyz/docs/get-started/troubleshooting/general

---

### 1. Widget opens but login fails, or every request shows a CORS error

**Cause:** your app's origin is not on the allowlist.
**Fix:** add the exact origin, port included (`http://localhost:5173`, `https://my-app.vercel.app`), under Settings > Security > Allowed CORS Origins: https://console.dynamic.xyz/dashboard/settings/security. Do it for each environment (Sandbox and Live).
Source: https://www.dynamic.xyz/docs/platform/dashboard/security

### 2. Builds fine, but no login options, no embedded wallet, or empty results

**Cause:** dashboard setup. Dynamic's quickstart lists four common causes: the chain isn't enabled (Chains & Networks), the login method isn't enabled (Sign-in Methods), Embedded Wallets aren't turned on, or the origin isn't allowlisted.
**Fix:** check all four in https://console.dynamic.xyz. Also check that you copied the environment ID from the **same** environment (Sandbox or Live) that you configured.
Source: https://www.dynamic.xyz/docs/react/reference/quickstart (section "Troubleshooting: Dashboard Configuration")

### 3. `Uncaught ReferenceError: process is not defined` (Vite)

**Cause:** SDK dependencies expect the Node globals `process` and `global`.
**Fix:** add `define: { 'process.env': {}, global: 'globalThis' }` to `vite.config.ts`. An older troubleshooting page suggests `@esbuild-plugins/node-globals-polyfill`, but the current quickstart says that plugin doesn't work with Vite 5.
Sources: https://www.dynamic.xyz/docs/react/reference/quickstart, https://www.dynamic.xyz/docs/get-started/troubleshooting/react/vitejs-polyfills-necessary-for-dynamic-sdk

### 4. Strange build or install failures on a fresh Vite app

**Cause:** `npm create vite@latest` now installs Vite 8. Dynamic's quickstart says it "is incompatible with the Dynamic SDK due to a missing native binary".
**Fix:** `npm create vite@5 my-app -- --template react-ts`. Tested: Vite 5.4.21 builds the quickstart and the wagmi setup.
Source: https://www.dynamic.xyz/docs/react/reference/quickstart

### 5. Console error about mismatched `@dynamic-labs` package versions

**Cause:** for example, `sdk-react-core@5.12.0` installed next to `ethereum@5.11.0`. The SDK checks at runtime that every `@dynamic-labs/*` package is on the same version, and logs an error if not (see `@dynamic-labs/assert-package-version`).
**Fix:** pin all `@dynamic-labs/*` packages to one exact version (`npm i @dynamic-labs/sdk-react-core@5.12.0 @dynamic-labs/ethereum@5.12.0 ...`), then `npm ls | grep @dynamic-labs`. Note that `@dynamic-labs/sdk-api-core` has its own version line (`0.104.0` for SDK 5.12.0).

### 6. wagmi hooks: `usePrepareContractWrite` / `useContractWrite` is not exported

**Cause:** the Dynamic page "Mint an NFT on EVM with Wagmi" still shows wagmi v1 hooks. They were removed in wagmi v2, which `@dynamic-labs/wagmi-connector@5.12.0` requires (peer range `wagmi ^2.14.11`).
**Fix:** use `useWriteContract` and `useWaitForTransactionReceipt` (recipe 5). For wagmi v3, the docs say it "may work" but is outside the peer range, so expect warnings.
Sources: https://www.dynamic.xyz/docs/react/wallets/using-wallets/evm/send-a-transaction-wagmi, https://www.dynamic.xyz/docs/react/reference/using-wagmi, https://wagmi.sh/react/guides/migrate-from-v1-to-v2

### 7. wagmi `useAccount().chain` is undefined, or the chain isn't configured

**Cause:** since Dynamic + wagmi v2, Dynamic **does not** copy dashboard chains into wagmi. A chain the user is on that isn't in `createConfig({ chains })` is unknown to wagmi.
**Fix:** list every chain you enabled in Dynamic (and every custom network) in the wagmi config. Call `createConfig` at module top level, and set `multiInjectedProviderDiscovery: false`.
Source: https://www.dynamic.xyz/docs/react/reference/using-wagmi#chain-configuration

### 8. `Property 'userHasEmbeddedWallet' does not exist on type ...`

**Cause:** the "Creating Wallets" page uses `useDynamicWaas().userHasEmbeddedWallet`, which isn't in `sdk-react-core@5.12.0` (confirmed with tsc).
**Fix:** `const { getWaasWallets } = useDynamicWaas(); const hasEmbedded = getWaasWallets().length > 0;`
Source: https://www.dynamic.xyz/docs/react/wallets/embedded-wallets/mpc/creating-wallets

### 9. `TransactionReceiptNotFoundError` right after sending

**Cause:** the docs example calls `publicClient.getTransactionReceipt({ hash })` straight after `sendTransaction`, before the tx is mined.
**Fix:** `await publicClient.waitForTransactionReceipt({ hash })`.
Sources: https://www.dynamic.xyz/docs/react/wallets/using-wallets/evm/send-a-transaction, https://viem.sh/docs/actions/public/waitForTransactionReceipt

### 10. Backend accepts a token from a user who hasn't finished MFA or onboarding

**Cause:** the signature is valid, but the token's `scope` is `requiresAdditionalAuth` or `userDataForm`, not `user:basic`.
**Fix:** reject any token whose space-separated `scope` doesn't include `user:basic` (recipe 7). Also pin `algorithms: ['RS256']`.
Source: https://www.dynamic.xyz/docs/auth/tokens#verifying-the-jwt

### 11. Next.js: "Hydration failed..." or `Module not found: Can't resolve 'encoding'`

**Fix:** wrap login-dependent components in `<IsBrowser>` from `@dynamic-labs/sdk-react-core`. For the module warning, add `config.externals.push('pino-pretty', 'lokijs', 'encoding')` in `next.config.js` under `webpack`.
Sources: https://www.dynamic.xyz/docs/get-started/troubleshooting/next/hydration-failed, https://www.dynamic.xyz/docs/get-started/troubleshooting/next/module-not-found

### 12. Wrong amount in the confirm popup on a custom chain

**Cause:** `nativeCurrency.decimals` is wrong in your `EvmNetwork`.
**Fix:** set the real value (18 for nearly every EVM chain). Building networks from viem chain objects (recipe 6) avoids the mistake.
Source: https://www.dynamic.xyz/docs/react/chains/adding-custom-networks

Still stuck? Ask in Dynamic's Slack, `#bug-report` channel: https://dynamic.xyz/slack
