Original log from 2026-10-19; current checks: see README.md

# TESTED.md — pimlico (reviewer log, not part of the skill)

Date: 2026-10-19. Machine: macOS, Node v24.21.0. Test folder: `scratchpad/deep/_test/pimlico/`.

## Versions

- `npm view permissionless version` -> 0.5.0 (published 2026-10-15; peer `viem ^2.44.4`; 0.5.0 change: `ox` became a regular dependency, `getOxExports`/`hasOxModule` removed)
- `npm view viem version` -> 2.57.7 (published 2026-10-14)
- Installed exact: permissionless@0.5.0, viem@2.57.7, dotenv@17.2.3; dev: tsx@4.23.15, typescript@7.0.2, @types/node@26.6.5
- `@pimlico/cli` on npm: 1.1.0 (not installed)

## Setup

```
npm init -y && npm pkg set type=module
npm i --save-exact permissionless@0.5.0 viem@2.57.7 dotenv@17.2.3
npm i -D --save-exact tsx typescript @types/node
```
tsconfig: target ES2022, module ESNext, moduleResolution bundler, strict, skipLibCheck, noEmit, types [node].

## Type-checks (all PASS, 0 errors)

`npx tsc -p .` (TypeScript 7.0.2) and `npx -y -p typescript@5.9.3 tsc -p .` on:
- `quickstart.ts` (identical to the block in references/quickstart.md, checked with diff)
- `skill-quickstart.ts` (code block extracted from SKILL.md step 4)
- `r1-accounts.ts`, `r2-batch.ts`, `r2b-contract.ts`, `r3-erc20.ts`, `r4-chains.ts`, `r5-policy.ts`, `r6-browser.ts`
- `extracted/*.ts`: every ```ts block of references/recipes.md and quickstart.md, extracted by script (recipes 2, 3 and 6 prefixed with the shared setup block), checked with `npx tsc -p extracted` on TS 7.0.2 and 5.9.3.

## Run live (no API key, no funds, nothing sent on-chain)

1. `npx tsx r1-accounts.ts` -> PASS. Safe 1.4.1, Simple and Kernel 0.3.1 counterfactual addresses derived on Sepolia via viem's default public RPC.
2. `npx tsx quickstart.ts` without `.env` -> throws `Missing PIMLICO_API_KEY` as intended.
3. `live-public.ts <chain> <safe|simple|kernel>` against Pimlico's keyless public bundler `https://public.pimlico.io/v2/<id>/rpc`, throwaway in-memory owner key:
   - First attempt with `paymaster: pimlicoClient` on Sepolia -> refused: `Sponsorship policy ID is required for this API key` (code -32601). So sponsored sends could NOT be tested without a real key. Documented in errors.md #3 and quickstart.md.
   - Without paymaster, `prepareUserOperation` (2 batched calls: raw call + typed `approve`) -> `Smart Account does not have sufficient funds...` on all 4 chains (documented, errors.md #2).
   - With `stateOverride: [{ address: account.address, balance: 1e18 }]` -> gas estimation PASS for Safe 1.4.1 on Sepolia, World Chain Sepolia, Unichain Sepolia, Arc Testnet; Simple Account PASS on World Chain Sepolia, Unichain Sepolia, Arc Testnet. `getUserOperationGasPrice` and `eth_supportedEntryPoints` (0.7 EntryPoint present) PASS on all.
   - Kernel 0.3.1: PASS on Unichain Sepolia and Arc Testnet; FAIL on World Chain Sepolia (address `0x000…000`, `Failed to simulate deployment`). Matches docs for World Chain Sepolia; Arc result contradicts the docs table (which says no Kernel 0.3.x on Arc), so the skill follows the docs.
4. `quotes.ts` (`pimlicoClient.getTokenQuotes`, public endpoint): Base Sepolia USDC `0x036C…CF7e` -> quote returned (paymaster `0x777777777777AeC03fd955926DbF81597e66834C`). World Chain Sepolia USDC `0x6614…eA88` and PIM `0xFC3e…F751` -> `[]`.
5. Every https URL in SKILL.md and references/ checked with curl: all docs.pimlico.io, GitHub, ethglobal, t.me, viem, faucet links 200. `dashboard.pimlico.io` returns HTTP 404 to curl but serves the Next.js dashboard app (it is the link the official docs use).

## Not tested

- Any sponsored (paymaster) user operation actually landing on-chain — needs a real Pimlico API key. The sponsored code is the official tutorial-1 pattern, type-checked only.
- ERC-20 paymaster send (recipe 4), sponsorship policy (recipe 6), browser-wallet owner (recipe 7) — type-checked only.
- Mainnets (World Chain 480, Unichain 130, Arc 5042) — only docs.
- Pimlico CLI / MCP server — not installed (global install, login and telemetry). Commands are copied from https://docs.pimlico.io/references/platform/cli. The Cursor mcp.json is Cursor's standard format, not from Pimlico's page.
- The NFT contract `0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2` used in Pimlico's account guides has no code on Sepolia (checked with `getCode`), so recipe 2 uses a placeholder `NFT_ADDRESS` instead.

## Doubts for the reviewer

- permissionless 0.5.0 is 4 days old at test time. If you want an older pin, 0.4.1 (2026-09-09) should take the same code, but I did not test it.
- The keyless public endpoint's "policy required" behaviour may differ from a fresh dashboard key. Docs say testnet sponsorship is free with a key; I could not confirm whether new keys also need a policy.
- World Chain Sepolia ERC-20 tokens returned no quotes on the public endpoint; they may work with a real key or need enabling in the dashboard.
- Telegram https://t.me/pimlicoHQ is from Pimlico's docs; I found no official Discord.
- Deviation from the official tutorial: `appendFileSync` instead of `writeFileSync(".env")` (the original overwrites the API key line). Flagged in quickstart.md and errors.md #10.
