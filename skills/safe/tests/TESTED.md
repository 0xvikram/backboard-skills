Original log from 2026-10-19; current checks: see README.md

# TESTED.md: safe (reviewer log, not part of the skill)

Date: 2026-10-19. Machine: macOS, Node v24.21.0. Test folder: `scratchpad/deep/_test/safe/`. Sources read: cloned `safe-global/safe-docs` (pages/*.mdx), `safe-global/safe-core-sdk` (HEAD 7fa0f0a, 16 Oct 2026 = the 8.0.8 / 5.0.4 / 6.1.2 release), `safe-global/safe-deployments` (v1.37.64), `safe-global/safe-apps-sdk`, npm tarball of `safe-modules-deployments@3.0.11`, https://docs.safe.global/llms.txt, https://safe.global/llms.txt.

## Versions (`npm view`)

- @safe-global/protocol-kit 8.0.8 (2026-10-16), api-kit 5.0.4 (2026-10-16), relay-kit 6.1.2 (2026-10-16), types-kit 4.0.1, safe-deployments 1.37.64, safe-modules-deployments 3.0.11
- @safe-global/safe-apps-sdk 9.1.0, safe-apps-provider 0.18.6 (both 2026-08-13; repo last commit May 2026)
- viem 2.57.7 (protocol-kit peer `^2.52.2`, deduped to one copy), dotenv 17.2.3, wagmi 3.7.7 (@wagmi/connectors 8.2.0, @wagmi/core 3.6.5), @tanstack/react-query 5.104.4, react 19.3.1
- dev: tsx, typescript 7.0.2, @types/node. Also checked with typescript 5.9.3.
- Not used: @safe-global/sdk-starter-kit 4.1.1 (higher-level wrapper; not covered).

## Type-checks (all PASS, 0 errors on TS 7.0.2 and TS 5.9.3)

`npx tsc -p .` and `npx -y -p typescript@5.9.3 tsc -p .` (tsconfig: ES2022, ESNext, moduleResolution bundler, strict, skipLibCheck, noEmit) on:
- `quickstart.ts` (byte-identical to the block in references/quickstart.md, checked with diff), `skill-quickstart.ts` (SKILL.md step 3)
- `r1-predict.ts`, `r2-multisig.ts`, `r3-local-sigs.ts`, `r4-batch.ts`, `r5-4337.ts`, `r6-safe-app.ts`, `r6-wagmi.ts`, `r7-read.ts` (recipes.md is generated from these files by a script, so the code is identical)
- `extracted/*.ts`: every ```ts block with imports from SKILL.md and references/*.md, extracted by script: PASS on both TS versions. The one fragment not extracted (recipe 5 `customContracts` object) is exercised in `live-4337.ts`.
- `docs-snippets/*.ts`: official doc snippets that FAIL with the current SDK, used for errors.md #7: `chainId: 1` (TS2322 number->bigint), `to: deploymentTransaction.to` (TS2322 string->0x string), sponsored `paymasterAddress` (TS2353). Also the deploy guide's `client.waitForTransactionReceipt` (TS2339) and `import { SigningMethod } from '@safe-global/protocol-kit'` (TS2614) failed in earlier drafts of quickstart.ts / r3.

## Run live (throwaway in-memory keys, no API keys, nothing with funds)

1. `npx tsx quickstart.ts` / `skill-quickstart.ts` on Sepolia -> PASS, predicted address printed, `deployed: false`.
2. `DEPLOY=1 npx tsx quickstart.ts` with an empty throwaway key -> viem `TransactionExecutionError: The total cost ... exceeds the balance` (the node rejected it; nothing landed). Used for errors.md #8.
3. `r1-predict.ts` -> PASS: the same 2-of-3 address `0xDbCF…DdaF` on Sepolia, World Chain Sepolia, Unichain Sepolia, Arc Testnet, Whitechain Sepolia.
4. `r3-local-sigs.ts` on World Chain Sepolia (predicted 2-of-2 Safe) -> PASS, `signatures: 2`. Execution not run.
5. `r4-batch.ts` on Sepolia -> PASS, batch target MultiSendCallOnly 1.4.1 `0x9641…02e2`, operation 1.
6. `chains-check.ts`: `Safe.init({ predictedSafe })` with safeVersion 1.4.1 and 1.3.0 plus `eth_getCode` for SafeL2 1.4.1, factory 1.4.1, GnosisSafeL2 1.3.0 (canonical + eip155), Safe4337Module 0.3.0, SafeModuleSetup 0.3.0, EntryPoint 0.7 on 13 chains via viem default RPCs (all chain IDs matched). Results are the table in chains.md. Highlights: 0G Galileo 16602 and Whitechain 1875 fail (`Invalid multiSend contract address`); Hedera 295/296 only 1.3.0; Hedera testnet has 1.4.1 + 4337 code on-chain but not in the registry (`hedera-code.ts` confirmed real bytecode, random address returns `0x`).
7. `curl GET https://api.safe.global/tx-service/<short>/api/v1/about/` (no key) -> 200 for `sep`, `wc`, `unichain`, `arc`, `arc-testnet`, `0g`, `wch-sepolia`; 404 for guessed `wcsep`, `unisep`. `GET https://safe-config.safe.global/api/v1/chains/?limit=200` -> 55 chains; the sponsor chains listed are 480, 130, 5042, 5042002, 16661, 1874 (+ Sepolia). Unauthenticated `GET .../tx-service/wc/api/v2/owners/0x1111…/safes/` -> 200 `{"count":0,...}`.
8. `apikit-errors.ts` -> exact messages for errors.md #1, #2, #6, #10 (no key -> mandatory error; chainId 4801 -> `Network with chainId 4801 not found`; 1874 constructs OK; bogus key `getSafeInfo` on unknown address -> `Not Found`; `Safe.init` with undeployed safeAddress -> `SafeProxy contract is not deployed on the current network`).
9. `live-4337.ts`: `Safe4337Pack.init` + `createTransaction` (2 calls, includes deployment) + `signSafeOperation` against Pimlico's keyless public bundler `https://public.pimlico.io/v2/<id>/rpc?add_balance_override`, `safeModulesVersion: "0.3.0"`, no paymaster. Never sent.
   - Sepolia: PASS with registry addresses and with `customContracts`.
   - World Chain Sepolia, Unichain Sepolia, Arc Testnet: registry -> `Safe4337Module and/or SafeModuleSetup not available ... 0.3.0`; with `customContracts` -> PASS (callGasLimit estimated, 1 signature).
10. `live-4337-sponsored.ts`: sponsored mode on the public endpoint -> `The method "pm_getPaymasterStubData" does not exist / is not available` (errors.md #5). Default module version on World Chain (480) -> `... not available for chain 480 and modules version 0.2.0` (errors.md #4).
11. `run-wagmi.ts`: built the wagmi config in Node -> connectors `[safe, injected]`, chains `[11155111, 480]`.
12. Every https link in SKILL.md and references/ fetched: all 200 except `dashboard.pimlico.io` (404 to curl, it is the SPA link Pimlico's own docs use), `ethereum.stackexchange.com` (403 to curl, Cloudflare), and the templated Pimlico URL (401 without key, expected). docs.safe.global returns 200 for any path, so each docs link was also checked for a real page `<title>` (all have one; a bogus path has none).

## Not tested

- Any real deployment, execution, proposal or confirmation (needs funded keys and a Safe API key). Recipe 2 (propose/confirm/execute) and recipe 7 (reads with API Kit) are type-checked only.
- Sponsored user operations end to end (need a Pimlico key). ERC-20 paymaster mode not tested.
- Safe App code (recipe 6a) inside the Safe{Wallet} iframe; wagmi `safe()` connector actually connecting. Only type-checks + config build.
- Hedera deployment (only address prediction with 1.3.0). Hedera testnet 1.4.1 via `contractNetworks` not tried.
- Mainnets: only read-only checks (code, prediction, Tx Service /about).
- No official Safe MCP server found (docs and GitHub org search), so no mcp.md.

## Doubts for the reviewer

- `Safe4337Pack` default `safeModulesVersion` is still `0.2.0` in relay-kit 6.1.2 source (`constants.ts`). The skill tells users to always set `0.3.0`. If Safe changes the default, the note becomes redundant but not wrong.
- The `customContracts` workaround for 4801/1301/5042002/1874 relies on our `eth_getCode` check that the canonical 0.3.0 module bytecode is deployed there; we did not compare code hashes against the registry.
- The wagmi docs `allowedDomains: [/^app\.safe\.global$/]` claim (never matches) is from reading safe-apps-sdk `isValidMessage` (regex tested against `event.origin`), not from running inside the iframe.
- "Arc 5042" mainnet: our RPC call to viem's `arc` default RPC returned chainId 5042 and Safe code; spec lessons say Arc mainnet 5042, consistent.
- Pimlico chain support for 4337 is quoted from the wave-1 pimlico skill / Pimlico docs, not re-read today beyond the URL check.
