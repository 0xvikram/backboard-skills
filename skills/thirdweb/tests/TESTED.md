Original log from 2026-10-19; current checks: see README.md

# TESTED.md: thirdweb skill (reviewer log, not part of the skill)

Date: 2026-10-19. Machine: macOS, Node v24.21.0. No real API keys were used and no transactions were sent.
Test folder: `scratchpad/deep/_test/thirdweb/`

## Versions

- `npm view thirdweb version` → 5.122.0 (latest, published 2026-10-12)
- Main test project: thirdweb@5.122.0, next@16.4.2, react@19.3.1 / react-dom@19.3.1, typescript@5.9.3, tsx@4.23.15, @types/node@22.20.5,
  @x402/core@2.28.0, @x402/evm@2.28.0, @x402/svm@2.28.0. Transitive: @coinbase/cdp-sdk@1.59.0, @base-org/account@2.5.0.
- create-next-app project (`_test/thirdweb/cna-app`): next@16.4.2, react@19.3.0, typescript@5.9.3, thirdweb@5.122.0, same @x402 versions.
- Vite project (`_test/thirdweb/vite-app`): vite@8.3.4, @vitejs/plugin-react@6.1.2, thirdweb@5.122.0, react@19.2.0.

## What I ran and what happened

1. **Quickstart, exactly as in SKILL.md** (`cna-app`):
   `npx create-next-app@16.4.2 cna-app --ts --app --src-dir --use-npm --yes --disable-git --no-agent-feedback`
   (the skill's command leaves out the last two flags; they only skip git init and a feedback prompt), then `npm i thirdweb@5.122.0`,
   `npm i @x402/core@2.28.0 @x402/evm@2.28.0 @x402/svm@2.28.0`, and the client.ts / layout / page.tsx from SKILL.md with
   `NEXT_PUBLIC_THIRDWEB_CLIENT_ID=placeholder-client-id`.
   - `npx tsc --noEmit` → PASS
   - `npm run build` (NEXT_TELEMETRY_DISABLED=1) → PASS, `/` prerendered
   - `next dev` + `curl /` → 200, HTML contains "Not connected" and the Connect button
2. **Found a real breakage (errors.md #1):** without the `@x402/*` packages, `next build` fails (Turbopack, and also `--webpack`) and
   `next dev` returns 500, with `Module not found: Can't resolve '@x402/core/client'` (plus 4 similar errors). The trace runs
   ConnectButton → base-account wallet → @base-org/account → @coinbase/cdp-sdk, which lists `@x402/*` as optional peers.
   Pinning cdp-sdk to 1.58.0 via `overrides` did NOT help. Installing the three @x402 packages fixed dev (200) and build. The `@x402`
   imports are in cdp-sdk ≥ 1.54.0 (checked via jsdelivr). Vite `vite build` passed without them.
3. **All code blocks extracted from SKILL.md, quickstart.md, recipes.md and chains.md** (`extract.py` → `src/app/extracted/*`, with a client import
   added where a snippet assumes `client`) → `npx tsc --noEmit` strict → PASS (18 files). The Vite env snippet was type-checked in
   `vite-app` → PASS.
4. **next build with the recipe components rendered** (`/recipes` and `/extracted-route`: ConnectButton + in-app wallet, useReadContract raw +
   `balanceOf` extension, useSendTransaction + TransactionButton, EIP-7702 / EIP-4337 / accountAbstraction sponsored ConnectButtons,
   defineChain chains) → PASS.
5. **Negative type-check** (to show the types bite): `clientId: process.env.X` → TS2345; `params: [..., 1]` for uint256 → TS2322 (number vs bigint).
   Both are written up in errors.md #2 and #3.
6. **Placeholder address** `"0xYourContractAddress"` in `getContract` → `next build` prerender error
   "getContract validation error - invalid address" (errors.md #4).
7. **Live reads, no key** (`npx tsx scripts/read.ts`): placeholder clientId + `defineChain({ id, rpc })` with public RPCs, then
   `eth_blockNumber` + `readContract` of `symbol()` / `decimals()`:
   - Base Sepolia USDC 0x036C…CF7e → USDC, 6 ✔
   - World Chain USDC 0x79A0…24d1 → USDC, 6 ✔
   - Unichain USDC 0x078D…7AD6 → USDC, 6 ✔
   - Arc Testnet USDC 0x3600…0000 via `https://rpc.testnet.arc.io` → USDC, 6 ✔. The old `rpc.testnet.arc.network` (still in thirdweb's chain
     data and in some search results) did not resolve (curl exit 6). The Arc docs now list `rpc.testnet.arc.io`.
   - 0G Galileo, Hedera testnet, Whitechain testnet → block numbers ✔
   - `eth_chainId` via curl: 0G mainnet 16661, World Chain Sepolia 4801, Unichain Sepolia 1301, Hedera 295, Whitechain 1875 ✔
8. `scripts/chain-check.ts`: `defineChain(480)` → RPC `https://480.rpc.thirdweb.com/<clientId>`. `arcTestnet` built-in id 5042002 ✔.
   `getRpcUrlForChain` must come from `thirdweb/chains` (importing it from `thirdweb` failed at runtime).
9. thirdweb chain services API (`/v1/chains/<id>/services`) for all 11 sponsor chain IDs → table in chains.md.
10. CLI source check: `thirdweb create` is deprecated in 5.122.0 (prints a message and exits). deploy/publish need `-k` and then spawn
    `@thirdweb-dev/cli@latest` (errors.md #9 and #10).

## Not tested

- Any real sign-in (Google/email/passkey), wallet connection, transaction, deploy or gas sponsorship. These need a real Client ID / Secret Key
  and a funded or sponsored account. The write, deploy and sponsorship code is type-checked and builds, but was never executed.
- `deployContract` / `deployERC20Contract` and `sendAndConfirmTransaction` scripts: type-checked only.
- `npx thirdweb deploy -k`: not run (it sends data and needs a key).
- MCP server: config copied from the official page source; not connected (it needs a secret key).
- `npm create vite@9.2.1` scaffold command: not run. A hand-built Vite 8.3.4 app was built instead.
- EIP-7702 support on each sponsor chain: not confirmed anywhere I could find. Only the 4337 `account-abstraction` service flag is reported.
- Discord/Telegram community links: I could not confirm an official one from the docs, so the skill only lists https://thirdweb.com/support and GitHub issues.

## Doubts for the reviewer

- The `@x402/*` workaround may become unnecessary (or need other versions) once cdp-sdk / @base-org/account / thirdweb change their deps.
  Re-run `next build` on a fresh install before publishing.
- Gas sponsorship pricing and limits ("testnet free, mainnet needs a card") come from the enable-gasless doc page. Check that it is still current.
- Service flags per chain (especially Arc 4337 "enabled" and World Chain) come from thirdweb's API, not from a docs page, and can change.
- thirdweb is not on the ETHGlobal Mumbai prizes page as of today, so the skill only says it "may help with" onboarding / gasless tracks.
