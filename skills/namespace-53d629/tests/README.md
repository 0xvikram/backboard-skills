# namespace-53d629: tests

Run from the repo root: `node scripts/verify.mjs namespace-53d629`. Read-only: no Namespace API key, no wallet, no transactions. There is no `build` step (the skill has no app scaffold to build; the React blocks are type-checked).

| Script | What it checks |
| --- | --- |
| `typecheck` | `prep.mjs` adds `blocks/namespace.ts` and `blocks/mint-clients.ts` (one-line re-exports of the quickstart server client and the recipes mint clients, found by content), because other blocks import those names. Then strict `tsc` (TypeScript 7.0.2, as the skill pins) twice: Node blocks with NodeNext resolution (the SDKs are CJS, so this checks the named ESM imports) plus `live.ts`, and the React blocks (wagmi providers, `OffchainSubnameForm` / `SubnameMintForm` from ens-components 2.2.0) with Bundler resolution + JSX. |
| `live` (`live.ts`) | **Offchain Manager 1.0.13** against the mainnet API with no key: `isSubnameAvailable` (taken vs random label), `getFilteredSubnames`, `getSingleSubname`, and that a missing name **throws a 404** (errors.md #5). **Mint Manager 2.0.0** on the Optimism listing `oppunk.eth`: `normalizeName`, a fresh label is `available` on chain 10, the minted `lucas.oppunk.eth` is not available with `rpc: 'always'` (the advice in recipe 4 / errors.md #7; the default `rpc: 'auto'` result is printed as a note so you can see if the false "available" bug still happens), an unlisted parent gives `LISTING_NOT_FOUND`. **Skill blocks run for real:** the indexer block (L2 subname, registry, list on Optimism), the viem ENS block for `nick.eth` and for the Namespace L2 subname `lucas.oppunk.eth` (CCIP Read), the Resolvio block, the sepolia read block. The offchain quickstart and the mint block must stop at their env-var guard. |

`globals.d.ts` declares `client` and `mainnetClient`, because the two chains.md snippets use a client the reader already has (the quickstart server client and a viem mainnet client). `css.d.ts` declares `*.css`, which Next.js / Vite projects already have, for the ens-components stylesheet import.

**Not checked:** any offchain write (`createSubname`, `add*Record`, `setDefaultEvmAddress`, `updateSubname`, `deleteSubname`: need an API key and an owned parent), so errors.md #4 and #6 stay source-read only; an onchain mint (`prepareMint` + `simulateContract` + `writeContract`: needs a funded wallet and a listing); avatar upload (needs the name owner's SIWE signature); ENS Components in a real browser; resolution of an offchain (not L2) subname through CCIP; the Namespace App UI steps. Live names used (`artii.eth`, `oppunk.eth`, `lucas.oppunk.eth`, `nick.eth`) are third-party; if one of them is deleted or expires, the check fails and needs a new public name.

No `verify:skip` lines.
