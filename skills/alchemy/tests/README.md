# alchemy skill tests

Run from the repo root: `node scripts/verify.mjs alchemy`. There is no build step (the skill is plain Node scripts).
Pinned: viem@2.57.7, ethers@6.17.0, @alchemy/wallet-apis@5.3.0, typescript@5.9.3, tsx@4.23.15.

## What each script checks

- **typecheck** (`tsc`, strict, NodeNext): every ts block in SKILL.md and references/*.md (12 blocks).
  `prep.mjs` first saves the `// networks.ts` and `// alchemy-rpc.ts` blocks (recipes.md §1, §2) as `blocks/networks.ts` and
  `blocks/alchemy-rpc.ts`, because the other recipes import them by those names, exactly as a user would have them.
- **live** (`live.ts`, no keys):
  - Sponsor-chain RPC reads: for each entry of the skill's `NETWORKS` map (World Chain, World Chain Sepolia, Unichain, Unichain Sepolia,
    Arc, Arc Testnet) against the chain's public RPC from viem: viem `getChainId` / `getBlockNumber` / `getBalance` and ethers
    `JsonRpcProvider(..., Network.from(id), { staticNetwork: true }).getBlockNumber()`; the chain IDs must be 480, 4801, 130, 1301, 5042, 5042002.
  - Documented errors, against real Alchemy endpoints with a fake key: the skill's quickstart, token-balances, transfers, nfts, portfolio and
    sponsored scripts are run as-is (`ALCHEMY_API_KEY=invalidkey`) and must fail with `Must be authenticated!` (errors.md #1);
    webhook-create with a fake token must get `401 ... AuthError` (#9); a non-UUID policy ID must get `Must be a valid UUID string` (#10);
    the public World Chain URL must reject `alchemy_getTokenBalances` with `Only core evm requests are allowed.` (#3); ethers
    `new AlchemyProvider(480, ...)` must throw `unsupported network` (#4).
  - Webhook signature checks: the skill's `webhook-server.ts` runs locally with signing key `whsec_test`. A body signed with HMAC-SHA256 gets 200
    and the event is parsed and logged; a wrong signature, no signature, or the same JSON re-serialized (errors.md #9) get 401; GET gets 404.

## Not checked

- Any successful call with a real key: token balances/metadata, transfers, NFTs, Portfolio API responses, webhook creation and real deliveries,
  gas-sponsored transactions. Response types come from Alchemy's docs, not live data.
- Which enhanced APIs are enabled per chain, the dashboard steps and the MCP server setup.

## verify:skip

None.
