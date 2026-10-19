Original log from 2026-10-19; current checks: see README.md

# TESTED.md (scaffold-eth), reviewer log, not part of the skill

Date: 2026-10-19. Machine: macOS (arm64), Node v24.21.0. Test root: `scratchpad/deep/_test/scaffold-eth/`.
No real funds, no real API keys, no transactions on any public chain.

## Setup

- `yarn` was not installed globally. Installed `yarn@1.22.22` locally in `_test/scaffold-eth/tools` and put it on PATH. (create-eth refuses to run without yarn: errors.md 1.)
- `npx -y create-eth@2.0.23 hh-app -s hardhat < /dev/null` → **PASS**. Non-interactive, 7m22s including install. The project ran Yarn 4.13.0 through `yarnPath`.
- Installed versions in the project: hardhat 3.19.0, hardhat-deploy 2.0.30, rocketh 0.19.20, next 16.2.12, wagmi 2.19.5, viem 2.53.1 (nextjs workspace), @rainbow-me/rainbowkit 2.2.11, @scaffold-ui/hooks 0.1.8.
- `npx create-eth@2.0.23 fd-app -s foundry --skip-install` → **FAIL as expected** (`FoundryValidationError: Could not parse foundry version`, because Foundry is not installed). Foundry install was not done: it is a system-wide install outside the allowed folders. The Foundry template files (package.json, Makefile, foundry.toml template, parseArgs.js, VerifyAll.s.sol) were read from the create-eth 2.0.23 package instead.
- `npx create-eth@2.0.23 ext-app -s hardhat -e erc-20 --skip-install` → **PASS** (adds `SE2Token.sol` and `app/erc20`).

## Local chain + deploy (Hardhat)

- `yarn chain` → **PASS** (EDR node on 127.0.0.1:8545, 20 funded accounts).
- `yarn deploy` → **PASS** (YourContract at `0x5fbdb2315678afecb367f032d93f642f64180aa3`, `deployedContracts.ts` regenerated with chain 31337 and `deployedOnBlock`).
- `yarn deploy --tags YourContract` → **PASS** (reused the existing deployment).
- A viem script sent `setGreeting("gm Mumbai")` from Hardhat test account #1 on localhost → **PASS**.

## Frontend: type-check, build, render

Variant A: `targetNetworks = [hardhat, worldchainSepolia, unichainSepolia, arcTestnet, hederaTestnet, zeroGTestnet, whitechainSepolia, arcMainnet(defineChain)]`, plus `rpcOverrides` for Arc testnet and a page using all three scaffold hooks plus wagmi `useReadContract` on chain 4801 (recipes.md 3 and 6).
- `yarn next:check-types` → **PASS**. (The first attempt used `useScaffoldReadContract({ contractName: "WETH", chainId: 4801 })` and failed with `Type '"WETH"' is not assignable to type '"YourContract"'`; that became errors.md 5.)
- `yarn next:build` (eslint + next build) → **PASS**.
- `next start` + headless Chromium (playwright-core 1.56.1, cached browser) → **PASS**: page showed `Greeting: gm Mumbai`, the GreetingChange event list (`0x7099…79C8: gm Mumbai`) and a non-empty WETH supply read from World Chain Sepolia.

Variant B: `worldchainSepolia` first, `WETH` external contract on 4801, a page using `useScaffoldReadContract` and `useScaffoldEventHistory` on WETH.
- First `check-types` failed inside the template's `useScaffoldEventHistory.ts` (TS2345, `{}`). Adding `deployedOnBlock` to the external contract fixed it → **PASS** (errors.md 6).
- Build → **PASS**. In the browser: `WETH total supply: 2.390477439559428729` → **PASS**.
- Event history with the default `blocksBatchSize` (500): RPC answered HTTP 400 "up to a 100 block range" and the hook showed 0 events (errors.md 7). With `blocksBatchSize: 100`: no errors. 0 transfers is correct, because a direct viem scan of the last 20,000 blocks also found no WETH Transfer logs.

Recipe 4a config exactly as written in recipes.md (worldchainSepolia only, Arc rpcOverride, empty externalContracts): `check-types` **PASS**, `next build` **PASS** (one prettier warning from my file write, no errors).

SKILL.md Quickstart page (`app/greet/page.tsx`), extracted from SKILL.md and run with the original `scaffold.config.ts` (hardhat only):
- `check-types` **PASS**, build **PASS**.
- Headless browser: the burner wallet auto-connected. I funded it with 1 local ETH from Hardhat account #1, clicked **Set greeting**, and the page changed from `before UI click` to `gm Mumbai` → **PASS** (full write path through `useScaffoldWriteContract` and the burner wallet).

## Sponsor-chain read calls

viem 2.53.1 (`_test/scaffold-eth/reads/reads.mjs`): `getChainId`, `getBlockNumber`, `getBalance`
- worldchainSepolia 4801 OK; unichainSepolia 1301 OK; arcTestnet 5042002 **FAIL on viem default RPC `rpc.testnet.arc.network`**, OK on `rpc.testnet.arc.io`; hederaTestnet 296 OK; zeroGTestnet 16602 OK; whitechainSepolia 1874 OK; Arc mainnet 5042 via `defineChain` + `rpc.mainnet.arc.io` OK.
- WETH predeploy `0x4200…0006`: `symbol`/`decimals`/`totalSupply` on World Chain Sepolia and Unichain Sepolia → OK.
- viem 2.57.7 (latest) already has the `*.arc.io` URLs; the template does not use it.

Hardhat (`_test/scaffold-eth/sponsorReads.ts` via `yarn hardhat run`): all six sponsor networks added to `hardhat.config.ts` with `type: "http"` returned the right chain ID and block → **PASS**. Removing `type` gives `HHE15 ... Expected 'http' | 'edr-simulated'` (errors.md 3).

Opcode probe (`eth_call` with raw init code): PUSH0, TSTORE and MCOPY OK on all six testnets; CLZ (Osaka) fails on Hedera, 0G and Whitechain.

## Deployer account flow (Hardhat), throwaway key only

- `yarn generate` (driven by `expect`, throwaway password) → **PASS**, wrote `DEPLOYER_PRIVATE_KEY_ENCRYPTED`.
- `yarn account` → **PASS**, listed the address and a 0 balance on every network, including the six sponsor testnets.
- `yarn deploy --network worldchainSepolia` with the unfunded throwaway → failed at gas estimation with `ProviderError: gas required exceeds allowance (0)`. No transaction was broadcast.
- Before `yarn generate`: `yarn deploy --network worldchainSepolia` → `🚫️ You don't have a deployer account...`.
- `yarn verify --help` → shows the `etherscan | sourcify | blockscout | metadata` subcommands.

## Verification support (read-only GETs)

- https://api.etherscan.io/v2/chainlist → lists 480, 4801, 130, 1301, 5042 (not 5042002, 295, 296, 16661, 16602, 1875, 1874).
- https://sourcify.dev/server/chains → lists 480, 4801, 130, 1301, 5042, 5042002, 295, 296, 16661, 16602, 1874.

## Other checks

- `yarn hardhat:check-types` fails on a **clean, unmodified** project (3 × TS2344 in `rocketh/*.ts`). It also fails after my edits, with the same errors and no new ones (errors.md 9).
- No official Scaffold-ETH MCP server exists. The project ships `.mcp.json` / `.cursor/mcp.json` for Context7 only, so there is no mcp.md.
- Every doc URL cited was fetched (HTTP 200) on 2026-10-19.

## NOT tested

- Foundry flavour at runtime (`yarn chain` with Anvil, `yarn deploy`, keystore flow, `yarn verify`/`VerifyAll.s.sol`, `forge verify-contract --verifier sourcify`). These come from the docs and template source only.
- A real testnet deploy and a real contract verification (that needs a funded faucet account).
- `yarn vercel` / a Vercel Git deploy (needs a login and uploads code). Only the local `next:build` that Vercel runs was tested.
- `yarn ipfs`, `yarn fork`, and the Hedera/0G/Whitechain write paths.
- Third-party extensions (`metamask/gator-extension`, SIWE) and every curated extension except `erc-20`.

## Doubts for the reviewer

1. The Vercel "Root Directory = packages/nextjs" advice comes from where `vercel.json` sits plus Vercel's monorepo docs. The Scaffold-ETH docs only describe the CLI and "connect your GitHub repo".
2. The Arc mainnet explorer URL (`explorer.arc.io`) is from Arc's docs; Etherscan's chainlist also shows `arc.etherscan.io`.
3. The BuidlGuidl Telegram invite is the "Support" link on scaffoldeth.io. Invite links can rotate.
4. The `deployedOnBlock: 35900000` and `fromBlock: 35937000n` values in recipe 6 are examples tied to 19 Oct 2026; hackers should use a recent block.
5. Scaffold-ETH changes often (2.0.23 was published 30 Jul 2026). If create-eth is bumped before 5 Nov, re-check the viem pin (Arc RPC) and the rocketh type errors.
