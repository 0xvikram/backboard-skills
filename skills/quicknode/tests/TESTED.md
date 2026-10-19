Original log from 2026-10-19; current checks: see README.md

# TESTED: quicknode skill (reviewer log, not part of the skill)

Date: 2026-10-19. Machine: macOS (Apple Silicon), Node v24.21.0.
Test folder: `scratchpad/deep/_test/quicknode/`.

## Packages (exact)

`npm view` on 2026-10-19: viem 2.57.7, ethers 6.17.0, @quicknode/sdk 3.8.2, @quicknode/mcp 0.1.2 (not used).
Installed: `viem@2.57.7 ethers@6.17.0 @quicknode/sdk@3.8.2`, dev: `typescript@7.0.2 tsx@4.23.15 @types/node@22.20.5`.
tsconfig: ES2022, module/moduleResolution NodeNext, strict, skipLibCheck.

## Docs read (saved under `_test/quicknode/dl/`)

llms.txt, docs/llms.txt, docs/llms-full.txt, pricing.md, agents.md, per-chain llms.txt and api-overview/quickstart pages for worldchain, unichain, hedera, arc, 0g, Streams (webhook destination, filters, create-stream, billing, supported chains, REST overview, EVM schemas), Webhooks (getting started, REST, create-from-template), Streams and Webhooks OpenAPI JSON, SDK pages, MCP page, add-ons, eth_getLogs and eth_subscribe pages, endpoint security, error references, faucet llms-full.txt and the live Unichain faucet page, the signature validation guide plus the official sample repo `quiknode-labs/streams-webhook-validate-signature` (server.js).

## What I ran and the results

1. **Type-check of all source files**: `npx tsc -p .` over `src/*.ts` → 0 errors.
2. **Type-check of every TS block extracted from SKILL.md, quickstart.md and recipes.md** (13 blocks): `npx tsc -p tsconfig.extracted.json` → 0 errors.
3. **Quickstart (viem)** with `QUICKNODE_RPC_URL=https://worldchain-sepolia.g.alchemy.com/public`: `{ chainId: 4801, block: 35937621n, wethBalance: '2.39…' }`. The extracted SKILL.md block gave the same result.
4. **ethers quickstart** (same public RPC): `{ block: 35937622, balance: '2.39…' }`.
5. **Recipe 1 (all sponsor chains)** against public RPCs: worldchain 480, worldchainSepolia 4801, unichain 130, unichainSepolia 1301, hedera 295, hederaTestnet 296, arc 5042, arcTestnet 5042002, 0G mainnet 16661, 0G Galileo 16602. All matched viem's chain IDs.
   Also against **QuickNode-hosted endpoints**, using the public `docs-demo` URLs from QuickNode's own docs pages (`https://docs-demo.<network>.quiknode.pro/`): worldchain-mainnet 480, unichain-mainnet 130, hedera-testnet 296, arc-mainnet 5042, 0g-mainnet 16661. All OK. This shows that viem works with QuickNode's URL format on these chains.
6. **Recipe 2 (WebSockets)** on `wss://docs-demo.unichain-mainnet.quiknode.pro/`: `watchBlocks` printed one block per second, and `watchEvent` decoded WETH Transfer logs. Ran 20 s, then closed cleanly. Re-run from the extracted block: OK.
7. **Recipe 4 (HMAC verification)**, fully local: server plus a client that signs as the docs describe. valid plain → 200, valid gzip (`content-encoding: gzip`) → 200, tampered body → 401, wrong secret → 401, short signature → 401 (no throw), missing headers → 400. Re-run from the extracted recipes.md block: same results. Cross-check: our HMAC equals the official sample's `verifySignature` digest for the same input (`4b7a78ce…` MATCH).
8. **Recipe 5 (Streams filter)**: ran the filter locally against real `eth_getLogs` output (21 Unichain mainnet blocks, about 146 logs), wrapped as `{data:[[logs]]}`. It returned the matching WETH transfers, and `null` for an empty payload. The generated filter JS passes `node --check`. The create-stream POST was **not** sent.
9. **Recipe 6 (chunked getLogs)**: public World Chain RPC OK. QuickNode docs-demo World Chain without a pause → `-32010 "log requests limited to 1/sec"`. With `PAUSE_MS=1100` → 26 WETH transfers in 50 blocks. (That error is the reason the pause option is in the recipe.)
10. **Recipe 7 (Multicall3 token balances)** on QuickNode docs-demo World Chain → `WETH 0.0200…`, `USDC 2.749651`. On a public RPC, OK.
11. **Recipe 8**: Hedera Mirror Node `/api/v1/accounts/0.0.2` on `docs-demo.hedera-testnet.quiknode.pro` and on `testnet.mirrornode.hedera.com` returned the same account. Unichain `pending` block via public Sepolia RPC and QuickNode demo mainnet: OK.
12. **Facts checked live**: World Chain average block time over 1000 blocks = 2 s. Hedera testnet `eth_getBalance(0x…02)` / mirror tinybars = 10^10 (18 vs 8 decimals).
13. **Stale-docs checks** (`_test/quicknode/stale/`):
    - Docs chain-quickstart `import { Core } from '@quicknode/sdk'` → TS2305, and at runtime `Core === undefined`.
    - Docs QNSDK webhook sample (`templateArgs: { templateId, wallet }`) → TS2353.
14. **viem behaviour**: confirmed in `node_modules/viem/_esm/utils/buildRequest.js` that viem retries HTTP 429 and JSON-RPC `code: 429` bodies, and reads `Retry-After`.

## Not tested

- Anything that needs a QuickNode account or API key: creating an endpoint, the Multichain toggle, Streams/Webhooks creation by REST or SDK (type-checked only), real Stream/Webhook deliveries and their real signature headers, the MCP server (OAuth), the faucet (needs reCAPTCHA and a wallet), and add-on enablement.
- Free-plan behaviour (5-block getLogs cap, 15 rps, 1 stream/webhook) is taken from the docs. I did not observe it on a real free account.
- The Mirror Node path on a **token** endpoint (`<endpoint>/<token>/api/v1/...`). The docs only show the token-less demo URL.
- ethers WebSocketProvider (only viem WSS was tested). Transactions were not sent.
- Whether the Streams JS sandbox supports every JS feature used in the filter (`reduce`, `concat`, arrow functions, `parseInt`). These are ES5/ES2015 and the official examples use `flatMap` and `?.`, so it should be fine.

## Doubts for the reviewer

1. **Free tier wording**: the pricing page now says "Free trial, $0/mo, includes 1 month free". I could not confirm whether a card is required or what happens after the month.
2. **REST/SDK on the free plan**: the pricing table lists the Admin API as Build+. It is unclear whether Streams/Webhooks REST and MCP account tools work with a free-plan API key. The skill tells users to fall back to the dashboard.
3. **Testnet endpoint subdomains** (e.g. `worldchain-sepolia`, `0g` Galileo): inferred from the naming pattern, not seen in docs. The skill tells users to copy the URL from the dashboard.
4. **Hedera Mirror Node URL with token**: see "Not tested".
5. **GoldRush price** ($50/month starting plan) was read from the marketplace page JSON on 2026-10-19 and may change.
6. I used QuickNode's public `docs-demo` endpoints (published in their docs pages) for about 15 read calls during testing. They are not mentioned in the skill as something to build on.
7. Unichain block time: QuickNode's Flashblocks page says "Unichain's standard 2-second block time". Measured live: the average over 1000 mainnet blocks is 1 s. The skill says "about one block per second" and does not repeat the docs figure.
