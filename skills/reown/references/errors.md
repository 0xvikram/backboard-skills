# Reown AppKit: errors and gotchas

All of these were reproduced or checked on 2026-10-19 with @reown/appkit@1.8.24, unless a note says otherwise.

## 1. `Type 'Config' is not assignable to type 'Config'` on `<WagmiProvider config={wagmiAdapter.wagmiConfig}>`

Cause: two copies of `@wagmi/core`. `@reown/appkit-adapter-wagmi@1.8.24` declares the peer `@wagmi/core >=2.21.2` and the optional dependency `@wagmi/connectors >=5.9.9`. npm 11 resolves both to the newest majors (`@wagmi/core@3.6.5`, `@wagmi/connectors@8.2.0`, both for wagmi 3), while `wagmi@2.19.5` brings its own `@wagmi/core@2.22.1`.

Fix: install the wagmi-2 versions at the top level, as Reown's own examples do:

```bash
npm i -E @wagmi/core@2.22.1 @wagmi/connectors@6.2.0
npm ls @wagmi/core   # every line should say 2.22.1
```

Source: reproduced locally. Official example `package.json` pins `@wagmi/connectors`: https://github.com/reown-com/appkit-web-examples/blob/main/react/react-wagmi/package.json

## 2. Next.js: `Module not found: Can't resolve '@x402/evm'` (or `@x402/core/client`, `@x402/svm/exact/client`)

Cause: the dependency chain `@wagmi/connectors` → `@base-org/account@2.4.0` → `@coinbase/cdp-sdk@1.59.0`. cdp-sdk imports the `@x402/*` packages statically but lists them only as *optional* peers, so they are never installed. Next's server bundle (Turbopack or webpack) then fails. Vite browser builds are not affected. The same failure is reported for other wagmi-based starters: https://github.com/celo-org/celo-composer/issues/398

Fix (tested, Next 16.4.2, Turbopack and `--webpack`): keep cdp-sdk out of the server bundle.

```ts
// next.config.ts
const nextConfig: NextConfig = { serverExternalPackages: ['@coinbase/cdp-sdk'] }
```

`next build` and `next start` then worked, and the page rendered the connect button.

## 3. Next 16: `This build is using Turbopack, with a webpack config and no turbopack config`

Cause: the Reown Next.js docs tell you to add `webpack: config => { config.externals.push('pino-pretty', 'lokijs', 'encoding') }`. Next 16 builds with Turbopack by default and refuses to build when a `webpack` key exists.

Fix: leave the `webpack` block out (Turbopack built fine without it), or keep it and build with `next build --webpack`. Source: https://docs.reown.com/appkit/next/core/installation.md (Extra configuration); Next's message links https://nextjs.org/docs/app/api-reference/next-config-js/turbopack

## 4. Email/social login (or swaps/onramp) won't turn on or off from code. Warning: "Your local configuration for "features.socials" ... was ignored because a remote configuration was successfully fetched"

Cause: when AppKit can load your project's dashboard config, that config **overrides** `features.email`, `features.socials`, swaps, onramp, activity, branding and Reown Authentication. Code values only apply if the fetch fails. Seen in `@reown/appkit@1.8.24` `dist/esm/src/utils/ConfigUtil.js`.

Fix: change these at https://dashboard.reown.com → your project → Configuration (toggle, then "Apply"). Docs: https://docs.reown.com/cloud/dashboard-configuration-settings.md

## 5. `Type 'string' is not assignable to type 'CustomRpcUrl[]'` (customRpcUrls)

Cause: https://docs.reown.com/appkit/networks/custom-networks.md and the FAQ show `customRpcUrls: { 'eip155:1': 'https://...' }`. The real type is an array of objects.

Fix:

<!-- verify:skip -->
```ts
customRpcUrls: { 'eip155:1': [{ url: 'https://your.rpc' }] }
```

Pass the same map to `new WagmiAdapter({...})` **and** `createAppKit({...})`. Correct form: https://docs.reown.com/appkit/react/core/options.md#customrpcurls

## 6. `Source provides no match for required element at position 0 in target` (networks)

Cause: `const networks = [mainnet, arbitrum]` is inferred as an array, but `createAppKit` wants a non-empty tuple. Several doc pages show the untyped form.

Fix:

```ts
import { mainnet, arbitrum, type AppKitNetwork } from '@reown/appkit/networks'
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, arbitrum]
```

Same pattern as the official example config: https://github.com/reown-com/appkit-web-examples/blob/main/react/react-wagmi/src/config/index.tsx

## 7. `'"@reown/appkit/react"' has no exported member named 'useAppKitSIWX'`

Cause: https://docs.reown.com/appkit/react/core/hooks.md#useappkitsiwx imports it from `@reown/appkit/react`. In 1.8.24 it lives in the SIWX package.

Fix: `import { useAppKitSIWX } from '@reown/appkit-siwx/react'`

## 8. "Invalid App Configuration" (APKT002) / origin not in allow list / 403 from `api.web3modal.org`

Cause: a wrong or placeholder projectId, or your domain isn't allowlisted. localhost, 127.0.0.1, `*.vercel.app`, `*.pages.dev` and `*.ngrok-free.app` are allowed by default. A custom domain is not. With a fake projectId you'll see `[Reown Config] Failed to fetch remote project configuration ... 403` in the server and browser logs.

Fix: copy the real Project ID from https://dashboard.reown.com, and add your domain under the project's Domain section. Source: https://docs.reown.com/appkit/faq.md ("Invalid App Configuration")

## 9. Modal opens with only the "Connect Wallet" title and no wallets

Cause: `@reown/*` packages on different versions, or `createAppKit` called inside a component.

Fix: put every `@reown/*` package on the same exact version (`npm view @reown/appkit version`), and call `createAppKit` once at module level. Source: https://docs.reown.com/appkit/faq.md

## 10. Connect / Network buttons greyed out, or `Failed host lookup: 'relay.walletconnect.org'`

Cause: the network or a VPN blocks the WalletConnect relay. This happens on venue Wi-Fi and corporate networks.

Fix: switch networks (phone hotspot) or turn off the VPN firewall. Source: https://docs.reown.com/appkit/recipes/troubleshooting.md

## Also worth knowing

- Email/social wallets can log in on any viem EVM chain, but they only transact reliably on Blockchain-API chains. Of the sponsor chains, only Unichain is on that list. See [chains.md](chains.md).
- `createAppKit` can't be re-run with different networks. Pass them all at start-up. Source: https://docs.reown.com/appkit/faq.md
- `zeroG` in `@reown/appkit/networks` is chain **16600** ("0G Newton Testnet", retired). For 0G Galileo use `zeroGTestnet` (16602), and for mainnet `zeroGMainnet` (16661).
