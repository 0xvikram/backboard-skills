# dynamic skill tests

Run from the repo root: `node scripts/verify.mjs dynamic` (add `--full` for the Vite builds). Versions are pinned
exactly in `package.json` to what the skill pins (@dynamic-labs/* 5.12.0, @dynamic-labs/sdk-api-core 0.104.0,
viem 2.57.7, wagmi 2.19.5, React 18.3.1, Vite 5.4.21, jsonwebtoken 9.0.3, jwks-rsa 4.1.0).

| Script | What it checks |
| - | - |
| `typecheck` | `tsc --strict` over every ts/tsx block of SKILL.md and references/*.md (19 blocks) plus `live.ts`, with `vite/client` types for `import.meta.env`. |
| `live` | `live.ts`. (1) The recipes.md #7 `verifyDynamicJwt` / `userFromRequest` block against a local JWKS server on 127.0.0.1 with RSA keys made at runtime; only the block's `jwksUri` string is swapped for the local URL (the test first asserts the block still uses the documented `app.dynamicauth.com/.../.well-known/jwks` URL). Accepts `user:basic` and multi-scope tokens; rejects MFA-pending, no scope, expired, wrong key, HS256 forgery and garbage. (2) The recipes.md #6 `networks.ts` block: `customEvmNetworks` and Dynamic's `getOrMapViemChain` mapping. (3) Every chain ID in chains.md against `viem/chains`, then `eth_chainId` on the public RPCs of World Chain, Unichain, Arc (both), Hedera testnet and 0G Galileo. (4) The Dynamic JWKS host/path answers (404 for a dummy environment). Exit 75 if an RPC or Dynamic is unreachable. |
| `build` | `build-app.mjs` assembles Vite 5 apps from the skill's own blocks and runs `vite build`: `app/quickstart` (quickstart.md vite.config.ts, main.tsx, App.tsx exactly as written) and `app/recipes`, built once per page: `index` = recipes.md #6 main.tsx with custom networks rendering recipes #1-#4 and the #7 client call, `wagmi` = the recipes.md #5 wagmi App, `mint` = the #5 MintButton under the #6 wagmi config. `app-template/` holds the hand-written harness only (HTML pages, the recipes App, two small entry files, a vite.config.ts that merges one entry into the skill's config). |

Helper files: `shims/App.tsx` and `shims/networks.ts` let blocks that import `./App` or `./networks` resolve to the
skill's own App and networks blocks via `rootDirs`. `shims/fragments.d.ts` declares `defineConfig` and `react` for
SKILL.md step 4, a one-line excerpt of quickstart.md's vite.config.ts, so it is still checked against Vite's types.

No `verify:skip` lines are used.

## Not checked (needs a real Dynamic environment, a browser or funds)

- Any real login, embedded-wallet creation, signing or transaction; the DynamicWidget at runtime. The Vite `define`
  polyfill is checked at build time only.
- Token verification against Dynamic's real JWKS (needs a real environment ID and a real token).
- The Next.js providers block (recipes.md #8) is type-checked only; no `next build`.
- Hedera, 0G and Whitechain with Dynamic itself (only their chain IDs and RPCs).
