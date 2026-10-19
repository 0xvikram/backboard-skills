Original log from 2026-10-19; current checks: see README.md

# TESTED.md: reown (reviewer log, not part of the skill)

Date: 2026-10-19. Machine: macOS, Node v24.21.0, npm 11.19.0. Test folder: `scratchpad/deep/_test/reown/`. Placeholder projectId `00000000000000000000000000000000` everywhere. No real keys, no transactions.

## Packages (exact)

`npm view` on 2026-10-19: @reown/appkit, @reown/appkit-adapter-wagmi and @reown/appkit-siwx were all at 1.8.24 (published 2026-10-10). wagmi latest is 3.7.7, but the Reown docs install `wagmi@2.x` and call wagmi 3 a beta (`@reown/*@2.0.0-wagmi-3.0`), so I used wagmi 2.19.5 + @wagmi/core 2.22.1 + @wagmi/connectors 6.2.0, the same pairing as Reown's official examples. Other versions: viem 2.57.7, @tanstack/react-query 5.104.4, react/react-dom 19.3.1, next 16.4.2, vite 8.3.4 (and 7.3.7), @vitejs/plugin-react 6.1.2 (and 5.2.0), typescript 5.9.3 (and 7.0.2 via create-vite).

## Projects and what I ran

1. **vite-app** (hand-made, Vite 7.3.7, TS 5.9.3): `npm i` of the pinned set.
   - First `tsc` **FAILED**: two `@wagmi/core` copies (3.6.5 top level, 2.22.1 under wagmi), so `WagmiProvider config` was a type mismatch. Adding `@wagmi/core@2.22.1` left `@wagmi/connectors@8.2.0` invalid; adding `@wagmi/connectors@6.2.0` made `npm ls @wagmi/core` clean. This became errors.md #1, and the install line pins both.
   - Then `tsc --noEmit` **PASS** and `vite build` **PASS** (chunk-size warning only).
   - Hand-written recipe files in `src/recipes/` (sponsor networks + customRpcUrls, defineChain, socials, EmbeddedInfo, ReownAuthentication, getSessionAccount, DefaultSIWX, SiwxStatus, Contract, Buttons): **PASS** after one fix. `useAppKitSIWX` is not exported from `@reown/appkit/react` (the docs say it is); it lives in `@reown/appkit-siwx/react`.
   - `server/verify.ts` run with tsx: signed with a throwaway `generatePrivateKey()` account and verified with `publicClient.verifyMessage` on Sepolia's public RPC → `valid: true`, `tampered: false`.
2. **Every ts/tsx block in SKILL.md, quickstart.md, recipes.md and errors.md** was auto-extracted (`extract.py`, 26 blocks):
   - SKILL.md quickstart (3 blocks) and quickstart.md (3 blocks) were dropped into a **real `create-vite@9.3.0` react-ts scaffold** (Vite 8.3.4, **TypeScript 7.0.2**, `verbatimModuleSyntax`, `noUnusedLocals`). `npm run build` (`tsc -b && vite build`) **PASS** for both sets.
   - All Vite-side recipe blocks plus the errors.md #6 snippet: `tsc --noEmit` **PASS**.
   - The Next.js recipe blocks (next.config.ts, config, context, layout, page, plus recipe 1 as `/wallet`) were copied unchanged into a **real `create-next-app@16.4.2` scaffold**. `next build` **PASS** with the recipe's next.config, and again with create-next-app's `cacheComponents: true, partialPrefetching: true` added.
3. **Negative checks**, where the doc snippets were confirmed broken by `tsc`: untyped `const networks = [mainnet, arbitrum]` (tuple error); `customRpcUrls` string form (`string` not assignable to `CustomRpcUrl[]`); `useAppKitSIWX` from `@reown/appkit/react` (no such export).
4. **Next.js build issues found and fixed** (Next 16.4.2):
   - With the docs' `webpack` externals → Turbopack refuses ("webpack config and no turbopack config").
   - Empty config (Turbopack) and `--webpack` with the docs' externals both **FAIL**: `Can't resolve '@x402/evm'` and others (chain: @wagmi/connectors → @base-org/account 2.4.0 → @coinbase/cdp-sdk 1.59.0, whose `@x402/*` are optional peers that it imports statically). This reproduced in the real create-next-app scaffold too.
   - `serverExternalPackages: ['@coinbase/cdp-sdk']` → **PASS** on Turbopack and on `--webpack` (with the externals; the webpack build also warns about `@react-native-async-storage/async-storage`).
   - create-next-app 16.4.2 sets `cacheComponents: true`. Then the docs' layout (`await headers()` in RootLayout) **FAILS** prerender ("uncached or runtime data ... outside of <Suspense>"). Wrapping in `<Suspense>` with an async `Providers` component → **PASS**, with or without cacheComponents.
5. **Runtime smoke tests** (Playwright 1.64.1 headless Chromium, **every non-localhost request blocked**): loaded the production builds of vite-app (Vite 7), vite8-app (Vite 8), the create-vite scaffold and the create-next-app scaffold (`next start`). In all four, `<appkit-button>` rendered with its shadow DOM (`<appkit-connect-button>`). There were no page errors, only failed loads from the blocked hosts (api.web3modal.org, fonts.reown.com, cca-lite.coinbase.com). No `process is not defined` polyfill was needed. Note: in the Next.js run, the **server side** (not blocked) called `api.web3modal.org` with the placeholder projectId and got 403. That is the SDK's own config fetch; no other data was sent.
6. **Network exports** (`check-networks.mjs`, installed @reown/appkit@1.8.24): worldchain 480, worldchainSepolia 4801, unichain 130, unichainSepolia 1301, hedera 295, hederaTestnet 296, arc 5042, arcTestnet 5042002, zeroGMainnet 16661, zeroGTestnet 16602, zeroGGalileoTestnet 16601, **zeroG 16600 ("0G Newton Testnet")**, whitechain 1875, whitechainSepolia 1874, whitechainTestnet 2625, and `defineChain` is a function. `rpc-check.mjs` ran `eth_chainId` on each sponsor export's default RPC: all 12 matched (OK). These agree with the wave-1 verified IDs.
7. **Source reading** (installed package, to back claims the docs don't make):
   - `appkit/dist/esm/src/utils/ConfigUtil.js`: dashboard config overrides local `features` (email, socials, swaps, onramp, reownAuthentication...) when fetched.
   - `appkit-base-client.js`: dashboard "Reown Authentication" replaces any custom `siwx`.
   - `appkit-utils/.../CaipNetworkUtil.js`: the Blockchain-API chain list (Unichain 130/1301 are the only sponsor chains on it); other chains fall back to viem's default RPC.
   - `appkit-common` `DEFAULT_ALLOWED_ANCESTORS`: localhost, 127.0.0.1, *.vercel.app, *.pages.dev, *.ngrok-free.app.
   - `appkit-utils/.../ErrorUtil.js`: APKT002 "Invalid App Configuration" = origin not in allow list.
8. **Docs MCP**: `https://docs.reown.com/mcp` answered `initialize` (serverInfo "Reown Docs") and `tools/list` (search_reown_docs, query_docs_filesystem_reown_docs, submit_feedback). No tool calls were made.
9. All URLs in the skill were fetched: 200, except `docs.reown.com/mcp` (405 on GET, expected for MCP) and the Alchemy public RPC (401 on GET; it answered JSON-RPC POST in step 6).

## NOT tested

- Any real wallet connection, signature or transaction through the modal. That needs a real projectId and a wallet.
- Email/social login and the OTP flow; whether email/social wallets can actually transact on World Chain, Hedera, Arc, 0G or Whitechain (the docs say "not reliably").
- Reown Authentication end to end (`getSessionAccount`, dashboard sessions) and the AppKit Auth API secret. Not documented in the pages I read.
- The dashboard UI itself (I have no account). Click paths in quickstart.md come from the docs pages, not from a live dashboard.
- `ReownAuthentication({ required: false })` behaviour, swaps, onramp, payments.
- wagmi 3 beta (`@reown/*@2.0.0-wagmi-3.0`).
- `next dev` (only `next build` + `next start`). Next 15 wasn't tested, but its webpack build should hit the same x402 error, since the failure is in cdp-sdk.

## Doubts for the reviewer

- **x402 fix**: `serverExternalPackages: ['@coinbase/cdp-sdk']` works because nothing loads cdp-sdk during SSR on our routes. If a future connector change makes the server *execute* cdp-sdk, the app could fail at runtime instead of build time. The alternative is installing the `@x402/*` peers (not tested). Re-check when `@base-org/account` or `@wagmi/connectors` change.
- The pins depend on npm resolution on 2026-10-19. A new `@coinbase/cdp-sdk` or `@reown/*` release could change both issues (#1, #2).
- `features` in code vs the dashboard: I documented the source-code behaviour (dashboard wins). The docs only say "defaults to your Cloud configuration" for analytics.
- The "Reown docs MCP" is the generic Mintlify endpoint. I couldn't find a Reown page announcing it, and mcp.md says so.
- Sponsor-chain support beyond "exported + correct chain ID" is unconfirmed by Reown, except for Unichain (on the Blockchain API list).
