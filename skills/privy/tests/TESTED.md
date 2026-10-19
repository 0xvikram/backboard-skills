Original log from 2026-10-19; current checks: see README.md

# TESTED: privy (not part of the skill)

Date: 2026-10-19. Machine: macOS, Node v24.21.0, npm 11.19.0.
Test folder: `scratchpad/deep/_test/privy/`

## Versions (from `npm view <pkg> version` on 2026-10-19, installed exactly)

| Package | Version | Note |
| - | - | - |
| @privy-io/react-auth | 3.50.0 | latest, published 2026-10-16 |
| @privy-io/node | 0.36.0 | latest; `@privy-io/server-auth@1.32.5` is marked deprecated on npm |
| @privy-io/wagmi | 4.0.19 | peer deps: `viem: "2.57.5"` (exact), `wagmi: ">=2"` |
| wagmi | 3.7.7 | |
| viem | 2.57.5 | pinned to match @privy-io/wagmi's exact peer (latest was 2.57.7) |
| @tanstack/react-query | 5.104.4 | |
| @privy-io/chains | 0.6.1 | |
| next | 16.4.2 | Turbopack build |
| react / react-dom | 19.3.1 | |
| typescript | 5.9.3 | |
| @worldcoin/minikit-js | 2.0.3 | dev dep, only for recipe 8 type-check |
| jose | 6.2.12 | dep of @privy-io/node, used to mint test JWTs |

## What I ran and the results

1. `npm init -y`, then installed the packages above. Removed `"type": "commonjs"` (added by npm 11's `init -y`), because with it Next/Turbopack fails ("Specified module format (CommonJs) is not matching").
2. **Type-check, hand-written files**: `npx tsc --noEmit -p .` (strict, moduleResolution bundler, jsx react-jsx, skipLibCheck) over `app/` and `src/`: quickstart provider/page, whitelabel email + OAuth + createWallet, getAccessToken call, send-ERC20, viem wallet client + switchChain, Privy+wagmi providers, wagmi hooks, custom chain + `addRpcUrlOverrideToChain`, all-chains provider, Next route handler. **PASS (exit 0).**
3. **Type-check, every code block in the skill**: a script pulled all ```tsx/```ts blocks from SKILL.md (2), references/quickstart.md (3) and references/recipes.md (12) into `src/fromdocs/` and ran tsc. **PASS (exit 0)** after these fixes:
   - Recipe 7's first block was a JSX fragment. Rewrote it as a full provider component.
   - Recipe 8 (World MiniKit) as copied from Privy's docs failed: `has no default export` and `walletAuth does not exist on type 'never'`. Rewrote it for minikit-js 2.0.3 (`import {MiniKit}`, `MiniKit.walletAuth({nonce})`, `.data`).
4. **Negative checks of doc snippets** (`neg/a.ts`, `neg/b.ts`):
   - `privy.utils().auth().verifyAccessToken({access_token})` (access-tokens page) gives TS2345: the method takes a string. Recorded as errors.md #1.
   - wagmi page `privyConfig` with top-level `embeddedWallets.createOnLogin` / `requireUserPasswordOnCreate` gives TS2353. Recorded as errors.md #2.
5. **`next build`** (with `NEXT_TELEMETRY_DISABLED=1`) on the full test app (`/` = quickstart, `/recipes` = recipes under the wagmi provider, `/api/me` = verify route):
   - With `NEXT_PUBLIC_PRIVY_APP_ID=placeholder-app-id`: FAIL, `Cannot initialize the Privy provider with an invalid Privy app ID`. The SDK checks for a 25-character app ID. (errors.md #3)
   - With a fake 25-char ID: first FAIL, `Multiple PrivyProvider instances found`, because my harness nested the wagmi provider inside the root provider (errors.md #5). Split into route groups; then **PASS** (all pages prerendered).
   - Without `PRIVY_APP_ID`: FAIL, `Failed to collect page data for /api/me` / `The PRIVY_APP_ID environment variable is missing or empty` (errors.md #4).
   - `PrivyProvider` imported straight into a server layout (no `'use client'`): FAIL, `TypeError: (0 , b.createContext) is not a function` (errors.md #6). Test page removed afterwards.
6. **Server token verification, offline** (`verify-test.mjs`): made a local ES256 key pair with jose, passed the public SPKI as `jwtVerificationKey` (so no request goes to Privy), and signed tokens with `iss=privy.io`, `aud=<app id>`, `typ=JWT`.
   - Valid token returns `{app_id, issuer, issued_at, expiration, session_id, user_id}` (snake_case). PASS
   - Wrong audience: rejected, `InvalidAuthTokenError: Authentication token is invalid`. PASS
   - Expired: rejected, `Authentication token expired`. PASS
   - Docs form `verifyAccessToken({access_token})`: rejected, `Failed to verify authentication token`, so the docs form never works at runtime in 0.36.0.
   - Note: the SDK requires the `typ: 'JWT'` header (real Privy tokens have it; my first test token didn't and was rejected).
7. **Route handler end to end**: `next start -p 3917` with `PRIVY_VERIFICATION_KEY` set to the local test key, then `curl` on localhost only:
   - no header: 401 `{"error":"missing token"}`
   - garbage token: 401 `{"error":"invalid token"}`
   - valid test token: 200 `{"userId":"did:privy:test-user","sessionId":"sess_1"}`
   - `GET /`: 200
8. **Sponsor chains, public RPC reads** (`chains-test.mjs`, viem `getChainId` + `getBlockNumber`, read-only): World Chain 480, World Chain Sepolia 4801, Unichain 130, Unichain Sepolia 1301. Each RPC chainId matched the viem config. PASS
9. `addRpcUrlOverrideToChain(worldchainSepolia, url)` at runtime: returns the chain with `rpcUrls.privyWalletOverride.http = [url]` and keeps the default. PASS

## Not tested

- Any real login (email OTP, Google OAuth, SIWE), embedded wallet creation, the Privy modal, or `sendTransaction`. These need a real Privy app ID, a browser and a funded wallet. No keys were used and no transactions were sent.
- The `defaultChain not in supportedChains` and `supportedChains: []` throws (docs only).
- Gas sponsorship (`{sponsor: true}`), HTTP-only cookie mode, app clients (`clientId`).
- Whether the Privy embedded wallet signer works on World Chain / Unichain at runtime. It is config-only per docs; both chains are listed in Privy's gas-sponsorship and swap chain tables.
- Recipe 8 (World mini app) is type-check only; it needs World App.
- Vite / Create React App setups (docs only).
- The Claude Code command in mcp.md (`claude mcp add --transport http privy-docs https://docs.privy.io/mcp`). Privy's page only gives Cursor and Claude Desktop JSON. I built the command from Claude Code's standard syntax and did not run it.
- `npx create-next-app@16.4.2` in quickstart.md was not run (the test app was set up by hand). The version matches the tested `next`.

## Doubts for the reviewer

1. **Docs vs SDK drift (high impact)**: Privy's access-token page shows `verifyAccessToken({access_token})` and camelCase return fields. The 0.36.0 types and runtime take a string and return snake_case. The skill follows the SDK and says so. If Privy releases a version that accepts the object form, errors.md #1 needs updating.
2. The wagmi integration page still shows the v2-style `embeddedWallets.createOnLogin`. The skill uses the v3 per-chain shape.
3. `@privy-io/wagmi@4.0.19` pins `viem` exactly to `2.57.5`. If a hacker installs a newer viem, npm may warn about peers or install two viem copies. The skill pins 2.57.5.
4. The "whitelabel login does not auto-create wallets" claim is from Privy's automatic-wallet-creation page. The official whitelabel starter also creates wallets with a button.
5. Rate-limit numbers (5 email OTPs per 5 min) come from the test-accounts page and may change.
6. Prize-track wording in SKILL.md is generic ("may help with World and Unichain tracks"). I did not open the prizes page; check that those sponsors have tracks at Mumbai.
7. Hedera / Arc / 0G / Whitechain are marked "not confirmed": no mention in llms-full.txt.
