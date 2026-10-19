# privy skill tests

Run from the repo root: `node scripts/verify.mjs privy` (add `--full` for the Next.js build). Versions are pinned
exactly in `package.json` to what the skill pins (@privy-io/react-auth 3.50.0, @privy-io/node 0.36.0,
@privy-io/wagmi 4.0.19, wagmi 3.7.7, viem 2.57.5, next 16.4.2).

| Script | What it checks |
| - | - |
| `typecheck` | `tsc --strict` over every ts/tsx block of SKILL.md and references/*.md (19 blocks) plus `live.ts`. |
| `live` | `live.ts`. (1) The recipes.md #6 `/api/me` route block, called directly: no token, garbage, valid, wrong-audience and expired tokens, signed with a throwaway ES256 key made at runtime (`jwtVerificationKey` is set, so nothing goes to Privy). (2) `verifyAccessToken(string)` returns snake_case claims and the docs' object form is still rejected (errors.md #1). (3) The recipes.md #7 `addRpcUrlOverrideToChain` block at runtime. (4) World Chain 480/4801 and Unichain 130/1301: viem config IDs, then `getChainId()` on each public RPC (exit 75 if an RPC is unreachable). |
| `build` | `build-app.mjs` assembles a Next.js App Router app from the skill's own blocks (`/` = quickstart providers/layout/page, `/recipes` = recipes #1-#5, #7, #8 under the recipe's Privy + wagmi providers, `/api/me` = recipe #6) and runs `next build` (Turbopack) with a fake 25-character app ID. `app-template/` holds the only hand-written harness files: the `/recipes` root layout and page. |

Helper files: `shims/providers.tsx` lets quickstart.md's layout block (`import Providers from './providers'`) resolve to
the quickstart providers block via `rootDirs`. `shims/fragments.d.ts` declares `privy` and `accessToken` for the
two-line fix in errors.md #1, so that fragment is still checked against the SDK types.
errors.md #2 is an object-property fragment; it parses as labelled statements, so it passes but checks nothing (the
same config is fully checked in quickstart.md and recipes.md).

No `verify:skip` lines are used.

## Not checked (needs a real Privy app, a browser or funds)

- Any real login (email OTP, Google OAuth, SIWE / World App), the Privy modal, embedded wallet creation,
  `sendTransaction`, gas sponsorship. Components are type-checked and prerendered only.
- Token verification against Privy's real JWKS (the test uses a local key).
- The `claude mcp add` command in mcp.md.
