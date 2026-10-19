Original log from 2026-10-19; current checks: see README.md

# TESTED: alchemy (for the reviewer, not part of the skill)

Date: 2026-10-19. Machine: macOS, Node v24.21.0. Test folder: `scratchpad/deep/_test/alchemy/`.
No real Alchemy API key was used. Nothing was sent on-chain.

## Packages (exact)

- viem@2.57.7 (npm latest on test day)
- ethers@6.17.0 (latest)
- @alchemy/wallet-apis@5.3.0 (latest; docs call v5 "the recommended SDK")
- dev: typescript@5.9.3, tsx@4.23.15, @types/node@26.6.5

## SDK decision

- `alchemy-sdk` (npm 3.6.5, last modified 2025-09-30, no npm deprecation flag) is called deprecated in Alchemy's docs ("Never install `alchemy-sdk`. It is deprecated.") at https://www.alchemy.com/docs/data-apis-with-cursor. The skill does not use it.
- Account Kit is deprecated: https://www.alchemy.com/docs/wallets/account-kit-deprecated. The successor is Wallet APIs (`@alchemy/wallet-apis` v5).
- The skill uses viem/ethers for RPC, `fetch` for enhanced JSON-RPC and REST, and `@alchemy/wallet-apis` for sponsorship.

## What I ran

1. `npm init -y`, `npm pkg set type=module`, `npm i viem@2.57.7 ethers@6.17.0 @alchemy/wallet-apis@5.3.0`, `npm i -D typescript@5 tsx @types/node`. Strict `tsconfig.json` (NodeNext).
2. Wrote every snippet as a file in `src/`: quickstart, ethers-quickstart, networks, alchemy-rpc, token-balances, portfolio, nfts, transfers, webhook-create, webhook-server, sponsored.
3. `npx tsc --noEmit -p .`: **PASS** (0 errors).
4. Pulled every ```ts block back out of SKILL.md, quickstart.md and recipes.md into `extracted/` and type-checked them: **PASS**. All 9 recipe files are byte-identical to the tested `src/` files.
5. `src/test-public.ts` used the recipe-1 `NETWORKS` map with each chain's **public** RPC (from viem's chain definitions) to run viem `getChainId` / `getBlockNumber` / `getBalance` and ethers `JsonRpcProvider(..., Network.from(id), { staticNetwork: true }).getBlockNumber()`. **PASS** on all 6: worldchain 480, worldchainSepolia 4801, unichain 130, unichainSepolia 1301, arc 5042, arcTestnet 5042002. Chain IDs matched viem's definitions.
6. Error paths against real Alchemy endpoints with a fake key `invalidkey`:
   - quickstart (viem): `InvalidRequestRpcError ... Details: Must be authenticated!`. **as documented**
   - ethers: `server response 401 Unauthorized`, with the key visible in `requestUrl` (this is why errors.md #12 exists)
   - token-balances / transfers (fetch helper): `... failed (HTTP 401): Must be authenticated!`
   - nfts: `getNFTsForOwner HTTP 401: Must be authenticated!`
   - portfolio: first version crashed on non-JSON 401 body. **Fixed** by checking `res.ok` first. Now prints `Portfolio API HTTP 401: Must be authenticated!`
   - webhook-create with fake token: `401 { message: 'Unauthenticated request.', name: 'AuthError' }`
   - sponsored (Wallet APIs) with a random private key: a non-UUID policy gives `Must be a valid UUID string` (now in errors.md). With a random UUID, the SDK sent `wallet_prepareCalls` for chainId `0x12c1` (World Chain Sepolia) to `https://api.g.alchemy.com/v2` and got `Must be authenticated!`.
   - Missing env var: every script throws its `Set ...` message.
   - `npx tsx --env-file=<file>` loads env as documented.
7. Webhook receiver run locally on port 8787 with signing key `whsec_test`. A body signed with `openssl dgst -sha256 -hmac` got **200**, and the event was parsed and logged. A bad signature got **401**. No signature got **401**. GET got **404**.
8. Probes: `docs-demo` key from the docs got `Unspecified origin not on whitelist.` on all 6 chain URLs. Alchemy's public World Chain URL got `Only core evm requests are allowed.` for `alchemy_getTokenBalances` / `alchemy_getAssetTransfers`. Both are in errors.md.
9. ethers `new AlchemyProvider(480, ...)` throws `unsupported network`, and `"worldchain"` throws `unknown network`. Read provider-alchemy.js: the preset list has no World Chain, Unichain or Arc.

## NOT tested (needs a real key / account)

- Successful responses from `alchemy_getTokenBalances`, `alchemy_getTokenMetadata`, `alchemy_getAssetTransfers`, the NFT v3 `getNFTsForOwner`, and the Portfolio API. Response field names come from the docs' OpenAPI schemas, not from live data.
- Whether Token / Transfers / Portfolio / NFT APIs are enabled on World Chain, Unichain or Arc. The docs only name World Chain for NFTs. The skill tells users to check https://dashboard.alchemy.com/chains.
- Creating a real webhook and receiving a real delivery from Alchemy.
- Any sponsored transaction (needs a key, a policy, and Alchemy's sponsorship review).
- MCP server setup (`claude mcp add ...`). Taken verbatim from the official page; not run, to avoid changing local config.
- Dashboard click paths. Taken from https://www.alchemy.com/docs/create-an-api-key, not clicked through.

## Doubts for the reviewer

- Transfers recipe: I make two calls (fromAddress / toAddress) on the reading that setting both is an AND filter. That fits the API shape and Alchemy's tutorials, but the reference page does not say it outright.
- The Portfolio recipe uses `eth-mainnet` / `base-mainnet` (from the docs example). World Chain, Unichain and Arc slugs for the Portfolio API are not confirmed.
- Arc mainnet: Alchemy's docs list `arc-mainnet` and viem has `arc` (5042), and the public mainnet RPC answered. Check that Arc mainnet is really open for hackers, or point them to testnet.
- The Discord link is the ticket channel Alchemy's own docs link to. There may be a better official community link.
- The gas sponsorship "review process" warning comes from Alchemy's docs. It is not clear how long the review takes, so hackers should ask early.
