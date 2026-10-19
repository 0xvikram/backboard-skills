Original log from 2026-10-19; current checks: see README.md

# TESTED.md: Namespace skill (namespace-53d629)

Not part of the skill. Test log for the reviewer. Date: 2026-10-19. Node 22, macOS.
Test folder: `scratchpad/deep/_test/namespace-53d629/` (Node scripts) and `scratchpad/deep/_test/namespace-53d629/ui/` (React / ENS Components). Docs snapshot used for writing: `_test/namespace-53d629/docs-snapshot/`.

## Versions checked (`npm view <pkg> version`, 2026-10-19)

| Package | Latest | Pinned in skill |
| - | - | - |
| @thenamespace/offchain-manager | 1.0.13 | 1.0.13 |
| @thenamespace/mint-manager | 2.0.0 | 2.0.0 |
| @thenamespace/indexer | 1.0.2 | 1.0.2 |
| @thenamespace/avatar | 2.0.2 | 2.0.2 |
| @thenamespace/ens-components | 2.2.0 | 2.2.0 |
| viem | 2.57.7 | 2.57.7 |
| wagmi | 3.x latest; ens-components peer needs ^2.19.5 | 2.19.5 (ui test only) |
| @tanstack/react-query | 5.104.4 | 5.104.4 |
| react / react-dom | 19.3.1 | 19.3.1 |
| dotenv / tsx / typescript | 17.4.2 / 4.23.15 / 7.0.2 | same |

Install commands used (all with `--ignore-scripts`):
```
npm i @thenamespace/offchain-manager@1.0.13 @thenamespace/mint-manager@2.0.0 @thenamespace/indexer@1.0.2 @thenamespace/avatar@2.0.2 viem@2.57.7 dotenv@17
npm i -D typescript@7.0.2 tsx@4.23.15 @types/node@22
# ui/
npm i @thenamespace/ens-components@2.2.0 @thenamespace/offchain-manager@1.0.13 react@19.3.1 react-dom@19.3.1 wagmi@2.19.5 viem@2.57.7 @tanstack/react-query@5.104.4
npm i -D typescript@7.0.2 @types/react@19 @types/react-dom@19
```

## Type-check (PASS)

- Every ```ts / ```tsx block in SKILL.md, references/quickstart.md, references/recipes.md was extracted by script into `src/x/*.ts` and `ui/src/x/*.tsx` and checked; chains.md snippets checked in `src/x/chains_snippets.ts`.
- Root: `npx tsc -p .` (NodeNext, strict) -> exit 0. UI: `npx tsc -p .` (Bundler, jsx react-jsx, strict) -> exit 0.
- Fix found during type-check: Indexer docs show `texts`/`addresses` top-level on `getL2Subname`; SDK types have `records.texts`/`records.addresses`. Recipe uses the SDK shape (also confirmed live).
- UI note: TS 7 flags `import '...styles.css'` without a `declare module '*.css'` (Next.js projects already have one). Added in the test env only.

## Live runs (read-only, no API key, no wallet, no transactions) (PASS)

`npx tsx src/test-readonly.ts`:
- Offchain (mainnet API, no key): `isSubnameAvailable('test.artii.eth')` -> `{isAvailable:false}`; random label -> `{isAvailable:true}`; `getSingleSubname('test.artii.eth')` -> object; `getFilteredSubnames({parentName:'artii.eth'})` -> totalItems 33.
- `getSingleSubname` on a missing name -> **threw AxiosError 404** (docs say returns null) -> errors.md #5.
- Mint Manager: `normalizeName('Alice.OPPUNK.eth')` -> `alice.oppunk.eth`; `checkName('<random>.oppunk.eth')` -> available, L2, chain 10; unlisted parent -> `MintManagerError LISTING_NOT_FOUND`.
- **Finding:** `checkName('lucas.oppunk.eth')` (already minted; indexer shows owner; `isL2SubnameAvailable` -> false) returned `available` with default `rpc:'auto'`, and `getMintDetails` returned `canMint:true`. With `rpc:'always'` it returned `taken`. -> errors.md #7, recipe 4 uses `rpc:'always'` + simulate.
- Indexer: `getL2Subname` / `getL2Registry` / `getL2Subnames` on Optimism `oppunk.eth` worked; `page:0` and `page:1` return the same page (1-based) -> errors.md table.
- viem recipe (public mainnet RPC): `nick.eth` -> address, avatar, url, primary name; Namespace L2 subname `lucas.oppunk.eth` -> address + avatar resolved via CCIP Read.
- Resolvio recipe: `GET /ens/v2/profile/nick.eth` and `lucas.oppunk.eth` OK; `/ens/v2/reverse/<addr>` OK; `/ens/v2/chains` OK (no World Chain / Unichain short names; numeric coin types `2147484128`, `2147483778` accepted).
- Extracted recipe files re-run: recipes 3, 5, 6, 7 ran clean.
- Runtime ESM check: `npx tsx src/quickstart.ts` and `src/recipe-mint.ts` load the CJS SDKs via named ESM imports and stop at the env-var guard as expected.

## NOT tested

- Any offchain **write** (`createSubname`, `add*Record`, `updateSubname`, `deleteSubname`, `setDefaultEvmAddress`): needs a real API key and an owned parent name. Type-checked only.
- `updateSubname` wiping omitted records (errors.md #4) is from reading SDK source (`dist/offchain-client/private-actions.js`), not observed.
- Error classes never thrown (errors.md #6): from SDK source grep, not observed.
- Onchain mint (`prepareMint` + `simulateContract` + `writeContract`): needs a funded wallet and an activated listing. Only `checkName` was run.
- Avatar upload (needs SIWE signature from the name owner).
- ENS Components in a browser (type-check only). Whether wagmi 3 actually breaks them at runtime was not tried; only the peer range was read.
- The Namespace App UI steps (resolver config, API key creation, activation) are copied from the docs, not clicked through.
- End-to-end CCIP resolution of an **offchain** subname: the only public parent I found with offchain names (`artii.eth`) did not resolve its offchain text record via viem (`null`) and Resolvio returned 500 for it, so I could not confirm offchain resolution on a live name. L2 subnames did resolve.
- Coin-type mapping for L2 address records on offchain names (SDK sends `8453`/`480`, viem queries ENSIP-11 `0x80000000|chainId`). Flagged as unverified in chains.md.

## Doubts for the reviewer

1. errors.md #7 (checkName false `available`) is real on `oppunk.eth` today, but it may be specific to that old listing (e.g. names minted before an API change). Advice (`rpc:'always'` + simulate) is safe either way.
2. errors.md #4 (`updateSubname` replaces records) is from source; the backend might merge server-side. If so, the advice to prefer `add*` helpers is still harmless.
3. chains.md: "works on any EVM chain" (team claim) is presented as address records via the ENSIP-19 default EVM address. Hedera / Arc / 0G / Whitechain are not named in any SDK enum.
4. Three different Telegram links appear across Namespace pages (`+OsziFgfuZz03NjEy` getting-started and troubleshooting, `+5FAwyiKOTeswNTIy` chainname/dev-portal, `+u2X1_QbR-CVmMGIy` GitHub README). The skill uses the getting-started one.
5. The SKILL.md quickstart says to verify on `sepolia.app.ens.domains`; I assume the ENS app shows CCIP-resolved offchain subnames on Sepolia, not tested.
6. Using a **Sepolia** parent name in the Namespace App (resolver config + API key for `mode: 'sepolia'`) is implied by the SDK's `sepolia` mode and the docs' "use Sepolia while developing", but the docs do not show a network switch in the app. Worth one click-through.
