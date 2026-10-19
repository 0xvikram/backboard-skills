# reown skill tests

Run from the repo root: `node scripts/verify.mjs reown` (add `--full` for the Next.js and Vite builds). Versions are
pinned exactly in `package.json` to what the skill pins (@reown/appkit, -adapter-wagmi, -siwx 1.8.24, wagmi 2.19.5,
@wagmi/core 2.22.1, @wagmi/connectors 6.2.0, viem 2.57.7, @tanstack/react-query 5.104.4, next 16.4.2, React 19.3.1,
Vite 8.3.4 as create-vite scaffolds it).

| Script | What it checks |
| - | - |
| `typecheck` | `tsc --strict` over every ts/tsx block of SKILL.md and references/*.md (25 blocks) plus `live.ts`. With both `@wagmi/core@2.22.1` and `@wagmi/connectors@6.2.0` pinned, `WagmiProvider config={wagmiAdapter.wagmiConfig}` type-checks (errors.md #1). |
| `live` | `live.ts`. (1) Every export named in chains.md (12 sponsor exports plus the 3 to avoid) has the stated chain ID in `@reown/appkit/networks`. (2) The recipes.md #5 `defineChain` block at runtime. (3) `eth_chainId` on each sponsor export's default RPC. (4) The recipes.md #7 `verify()` block: a throwaway key made at runtime signs a message, verified on Sepolia's public RPC (valid -> true, tampered -> false). (5) `https://docs.reown.com/mcp` answers MCP `initialize` as "Reown Docs" (mcp.md). Exit 75 if an RPC or the docs server is unreachable. |
| `build` | `build-app.mjs` assembles the apps from the skill's own blocks. `app/next`: the recipes.md #2 App Router project (next.config.ts, config/index.ts, context/index.tsx, app/layout.tsx, app/page.tsx) plus `/wallet` rendering recipes #1, #3, #6 and #8; `next build` (Turbopack) runs twice, with the recipe's next.config.ts as written and with `cacheComponents` + `partialPrefetching` added (create-next-app 16.4's defaults, which the layout's `<Suspense>` is there for). `app/vite`: quickstart.md's src/config.ts, src/main.tsx, src/App.tsx with create-vite's react-ts vite.config.ts; `vite build`. `app-template/` holds the hand-written harness only (HTML page, vite.config.ts, the Next tsconfig with the `@/*` alias, globals.css, the `/wallet` page). |

Helper files: `shims/config.ts` and `shims/App.tsx` let the Vite main.tsx blocks (`./config`, `./App`) resolve to the
quickstart's own blocks via `rootDirs`; tsconfig.json `paths` maps the Next recipe's `@/config` and `@/context` to
their blocks (`blocks/recipes-3.ts`, `blocks/recipes-4.tsx`; update these if recipe blocks are added before them).
`shims/fragments.d.ts` declares the `NextConfig` type for the errors.md #2 one-liner.

## verify:skip

- references/errors.md #5 (`customRpcUrls: { 'eip155:1': [{ url: ... }] }`): an object property on its own, which is
  not valid TypeScript by itself (TS1005). The same `CustomRpcUrlMap` shape is fully checked in recipes.md #4.

## Not checked (needs a real projectId, a browser, a wallet or funds)

- Any wallet connection, signature or transaction through the modal; email/social login; Reown Authentication
  sessions (`getSessionAccount`); dashboard settings overriding `features`.
- Runtime rendering of `<appkit-button>` (the original log did this with Playwright; not repeated here).
- Whether wallets can transact on the sponsor chains (only exports and RPC chain IDs).
