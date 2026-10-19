# thirdweb skill tests

Run from the repo root: `node scripts/verify.mjs thirdweb` (typecheck + live) or `node scripts/verify.mjs thirdweb --full` (adds the build).
Pinned: thirdweb@5.122.0, next@16.4.2, react@19.3.0, @x402/core|evm|svm@2.28.0, typescript@5.9.3.

## What each script checks

- **typecheck** (`tsc`, strict): every ts/tsx block in SKILL.md and references/*.md (18 blocks), written to `blocks/` by the runner.
  Support files in `shim/`:
  - `shim/client.ts` is the skill's own `client.ts`. `tsconfig.json` uses `rootDirs` so the blocks' `import { client } from "./client"` resolves to it.
  - `shim/globals.d.ts` declares `client` and `baseSepolia`, which the one-off read fragment in recipes.md §3 assumes are in scope, and the
    `ImportMetaEnv` typing that quickstart.md tells Vite users to add to `src/vite-env.d.ts`.
- **live** (`live.ts`, no keys, placeholder Client ID):
  - `readContract` of USDC `symbol()`/`decimals()` through thirdweb on Base Sepolia, World Chain, Unichain and Arc Testnet (`rpc.testnet.arc.io`), plus `eth_blockNumber` on 0G Galileo, Hedera testnet and Whitechain testnet 2625.
  - `eth_chainId` of every public RPC in references/chains.md (480, 4801, 130, 1301, 5042002, 16661, 16602, 295, 296, 1875, 1874, 2625).
  - `arcTestnet.id === 5042002` and `defineChain(480)` → `https://480.rpc.thirdweb.com/<clientId>`.
  - thirdweb's public chain services API: the `account-abstraction` flag of each chain matches the "4337 AA" column of chains.md, and 1874 is still absent from thirdweb's chain list.
    A flag change makes this fail on purpose: it means chains.md is out of date.
- **build** (`build.mjs`, `--full` only): copies the skill's own blocks into `app/src/app` (SKILL.md client.ts + page.tsx, the quickstart.md layout,
  and a `/recipes` page rendering the Login, ReadExample and sponsored-gas ConnectButtons from recipes.md), then runs `next build` with
  `NEXT_PUBLIC_THIRDWEB_CLIENT_ID=placeholder-client-id`. The `@x402/*` packages in package.json are the workaround in errors.md #1;
  without them this build fails with `Can't resolve '@x402/core/client'` (re-confirmed 2026-10-19).

## Not checked

- Any sign-in, wallet connection, transaction, deploy or gas sponsorship: these need a real Client ID / Secret Key and funds. The write,
  deploy and sponsorship blocks (recipes.md §4, §5, §7) are type-checked only; `recipes.md` §4's `WriteExample` is not rendered in the build
  because its placeholder address throws at prerender by design (errors.md #4).
- The CLI (`npx thirdweb deploy -k`), the MCP server, the Vite scaffold, and EIP-7702 support per chain.

## verify:skip

None.
