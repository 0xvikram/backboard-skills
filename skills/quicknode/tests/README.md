# quicknode skill tests

Run from the repo root: `node scripts/verify.mjs quicknode`. There is no build step (the skill is plain Node scripts).
Pinned: viem@2.57.7, ethers@6.17.0, @quicknode/sdk@3.8.2, typescript@7.0.2, tsx@4.23.15.

## What each script checks

- **typecheck** (`tsc`, strict, NodeNext): every ts block in SKILL.md and references/*.md (13 blocks), including the Streams/Webhooks REST
  and `@quicknode/sdk` scripts that need a key to run.
- **live** (`live.ts`, no QuickNode account or key). The skill's scripts are run as-is from `blocks/`, with their env vars pointed at public
  RPCs or at QuickNode's public `docs-demo.<network>.quiknode.pro` endpoints (published in QuickNode's own docs pages):
  - Quickstarts (viem in SKILL.md, ethers in quickstart.md) on World Chain Sepolia: chainId 4801, block, WETH balance.
  - Sponsor-chain RPC reads: the multi-chain client in recipes.md with all 10 networks (World Chain, Unichain, Hedera, Arc, 0G, mainnet and
    testnet) on public RPCs; each chainId must equal both viem's chain and the ID the skill documents. Then 5 of them on QuickNode-hosted
    docs-demo URLs, to check viem works with QuickNode's URL format.
  - Chunked `eth_getLogs` and the Multicall3 token-balance recipe on World Chain; the Hedera Mirror Node path (public mirror node and the
    QuickNode docs-demo Hedera endpoint); Unichain Flashblocks `pending` block on Unichain Sepolia; viem WebSocket `watchBlocks` on the
    docs-demo Unichain WSS (stops after two blocks).
  - Streams and Webhooks REST scripts run with `fetch-stub.mjs` preloaded: calls to `api.quicknode.com` are printed, not sent. The create-stream
    body is checked, its base64 `filter_function` is decoded and run against real `eth_getLogs` output from the last 20 Unichain blocks, and must
    match exactly the WETH Transfer logs (and return `null` for an empty payload). The webhook-from-template body is checked too.
  - Webhook / Stream signature checks: the skill's verification server runs locally with a random security token. Requests signed as
    QuickNode documents (HMAC-SHA256 of nonce + timestamp + body) get 200, plain and gzip; tampered body, wrong secret and short signature
    get 401; missing `X-QN-*` headers get 400; GET gets 404.

## Not checked

- Anything that needs a QuickNode account or API key: creating endpoints, Streams or Webhooks for real (REST and SDK scripts are type-checked,
  and the REST bodies are checked with the stub), real deliveries and their real signature headers, the MCP server, the faucet, add-ons.
- Free-plan limits (5-block getLogs cap, request rates) on a real free account.
- If the docs-demo endpoints go away, those checks report "network", not a failure.

## verify:skip

None.
