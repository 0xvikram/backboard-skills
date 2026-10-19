Original log from 2026-10-19; current checks: see README.md

# TESTED.md: dynamic (reviewer log, not part of the skill)

Date: 2026-10-19. Machine: macOS, Node v24.21.0. Test folder: `scratchpad/deep/_test/dynamic/`.

## SDK choice

Dynamic's docs now label `@dynamic-labs/sdk-react-core` the "Legacy React SDK" and recommend the headless JS SDK (`@dynamic-labs-sdk/client` + `react-hooks`, v1.41.0) for new apps. The React quickstart's own agent prompt says to use the React SDK when the user "explicitly requests the React SDK, `DynamicContextProvider`, `DynamicWidget`, or React SDK + Wagmi integration". The brief asks for DynamicWidget and wagmi, so the skill uses the React SDK and points to the JS SDK in SKILL.md. The React SDK is actively released (5.12.0 and 4.102.0 both published 2026-10-16).

## Packages (exact)

`npm view` on 2026-10-19:
- @dynamic-labs/sdk-react-core 5.12.0, @dynamic-labs/ethereum 5.12.0, @dynamic-labs/ethereum-core 5.12.0, @dynamic-labs/wagmi-connector 5.12.0, @dynamic-labs/types 5.12.0, @dynamic-labs/sdk-api-core 0.104.0 (the exact dependency of sdk-react-core 5.12.0)
- viem 2.57.7 (latest), wagmi 2.19.5 (latest 2.x; latest overall is 3.7.7, but wagmi-connector 5.12.0 declares peer `wagmi ^2.14.11`), @tanstack/react-query 5.104.4
- react / react-dom 18.3.1, vite 5.4.21, @vitejs/plugin-react 4.7.0, typescript 5.9.3 (Dynamic docs: "We support TypeScript v5.x"; latest is 7.0.2, which I didn't use)
- jsonwebtoken 9.0.3, jwks-rsa 4.1.0, @types/jsonwebtoken 9.0.10

## What I ran

```bash
npm init -y
npm i @dynamic-labs/sdk-react-core@5.12.0 @dynamic-labs/ethereum@5.12.0 @dynamic-labs/ethereum-core@5.12.0 @dynamic-labs/wagmi-connector@5.12.0 viem@2.57.7 wagmi@2.19.5 @tanstack/react-query@5.104.4 react@18.3.1 react-dom@18.3.1 jsonwebtoken@9.0.3 jwks-rsa@4.1.0 @dynamic-labs/sdk-api-core@0.104.0 @dynamic-labs/types@5.12.0
npm i -D vite@5.4.21 @vitejs/plugin-react@4.7.0 typescript@5.9.3 @types/react@18.3.12 @types/react-dom@18.3.1 @types/jsonwebtoken@9.0.10 @types/node@22
```
Install OK (963 packages; deprecation warning for @metamask/sdk 0.33.1, a transitive dependency).

1. **Type-check** (`npx tsc --noEmit -p .`, strict, moduleResolution bundler). **PASS** on:
   - every `ts`/`tsx` code block in SKILL.md, references/quickstart.md and references/recipes.md, extracted automatically into `src/skillmd/` and `src/fromdocs/` (15 blocks + 2 SKILL.md blocks)
   - hand-written test copies in `src/recipes/` (SendTransaction, SignMessage, EmbeddedWallet, WagmiApp, WriteContract, networks, main-custom-networks, WagmiCustomChains, SwitchNetwork, CallBackend, Header with useSocialAccounts/useConnectWithOtp/IsBrowser, Next.js providers, chains.md snippet)
   - negative control: `useDynamicWaas().userHasEmbeddedWallet` (from the docs) **fails** tsc. That confirms the type-check is real and that this docs snippet is stale (errors.md #8).
2. **Production builds** with the documented Vite 5 `define` polyfill:
   - `npx vite build` of the quickstart (main.tsx + App.tsx with DynamicWidget): **PASS** (one large-chunk warning, about 4.7 MB unminified chunk)
   - `npx vite build -c vite.wagmi.config.ts`: first `src/main-wagmi.tsx` (wagmi app + all recipe components), then the recipe-6 `main.tsx` from recipes.md: **PASS** both
3. **JWT verification** (recipe 7), run for real with a local JWKS server on 127.0.0.1 and RSA keys generated locally (`node scripts/test-jwt.mjs`). I ran it on both my test copy and the exact recipes.md code block (with only the `jwksUri` string swapped for the local URL). **8/8 PASS**: accepts `user:basic` and multi-scope tokens; rejects `requiresAdditionalAuth`, no scope, expired, wrong key, HS256 forgery (alg confusion) and garbage. `userFromRequest` extracted sub, email and wallet addresses.
4. **Public RPC reads** with viem (`scripts/rpc-check.mjs`, eth_chainId + blockNumber): World Chain 480 OK, World Chain Sepolia 4801 OK, Unichain 130 OK, Unichain Sepolia 1301 OK, Arc 5042 OK, Arc Testnet 5042002 OK, Hedera Testnet 296 OK, Whitechain Testnet 2625 OK. **0G Galileo: viem says 16601, the RPC returned 16602 (MISMATCH)**, noted in chains.md.
5. **Custom-network mapping** (`scripts/test-networks.mjs`): the recipe-6 `toEvmNetwork()` output was put through Dynamic's `getOrMapViemChain` and then a viem public client. World Chain Sepolia and Unichain Sepolia resolved to the right chain IDs and RPCs (OK).
6. Exports checked at runtime with `require`: DynamicContextProvider, DynamicWidget, useDynamicContext, getAuthToken, mergeNetworks, useDynamicWaas, useIsLoggedIn, useSwitchNetwork, useUserWallets, IsBrowser, useSocialAccounts, isEthereumWallet, EthereumWalletConnectors, getOrMapViemChain all exist.
7. Doc and support URLs cited in the skill returned HTTP 200 (dynamic.xyz/slack 301-redirects to the official `dynamiccustomers` Slack invite). The JWKS path `https://app.dynamicauth.com/api/v0/sdk/<env>/.well-known/jwks` answers (404 for a dummy env ID, so the host and path exist).
8. The Dynamic docs MCP (`https://www.dynamic.xyz/docs/mcp`) answered `tools/list` and `tools/call` over HTTP. I used it read-only to search the docs for World Chain, Unichain, Hedera, 0G and Whitechain.

## NOT tested

- Any real login, embedded-wallet creation, signing or transaction. That needs a real environment ID and dashboard config. No keys were used, and no transactions were sent.
- Running the app in a browser: not done, because the SDK would call Dynamic's API with a fake environment ID. The Vite `define` polyfill is checked at build time only, not at runtime.
- Next.js: only the `'use client'` provider component was type-checked. No `next build`.
- wagmi v3 with wagmi-connector (deliberately avoided).
- Hedera, 0G and Whitechain through Dynamic: not confirmed in Dynamic docs. Only their RPCs were checked.
- The dashboard menu names and URLs (Security > Allowed CORS Origins, Log in & User Profile, Embedded Wallets > Create on Sign up) come from the docs text and links, not from logging in.

## Doubts for the reviewer

- The SDK choice (legacy React SDK vs. headless JS SDK) is the big call. It matches the brief and the docs' own rule, but the docs push new apps to the JS SDK.
- The docs say `npm create vite@latest` (Vite 8) is incompatible. I followed that and didn't test Vite 8.
- `iss` claim: the docs give `app.dynamicauth.com/<environment_id>` only as an example, so the recipe doesn't check `iss` (the per-environment JWKS already binds the token to the environment). Worth a look.
- Two Dynamic docs pages have stale code that the skill corrects: the wagmi v1 hooks in "Mint an NFT with Wagmi", and `userHasEmbeddedWallet`. A third change: the docs call `getTransactionReceipt` right after send, and the skill uses `waitForTransactionReceipt` instead.
- The two Vite polyfill pages contradict each other (quickstart `define` vs. the older esbuild-plugins page). I used the quickstart one.
