# QuickNode on ETHGlobal Mumbai sponsor chains

Checked 2026-10-19. Chain IDs were confirmed live with `eth_chainId`. Support can change, so check each chain's "API Overview" page.

| Chain | Supported? | Networks (chain ID) | Endpoint subdomain* | Streams / Webhooks slug | viem chain | Source |
|---|---|---|---|---|---|---|
| World Chain | Yes | Mainnet (480), Sepolia (4801) | `worldchain-mainnet`, `worldchain-sepolia` | `worldchain-mainnet`, `worldchain-sepolia` | `worldchain`, `worldchainSepolia` | [API overview](https://www.quicknode.com/docs/worldchain/api-overview) |
| Unichain | Yes | Mainnet (130), Sepolia (1301) | `unichain-mainnet`, `unichain-sepolia` | `unichain-mainnet`, `unichain-sepolia` | `unichain`, `unichainSepolia` | [API overview](https://www.quicknode.com/docs/unichain/api-overview) |
| Hedera | Yes | Mainnet (295), Testnet (296) | `hedera-mainnet`, `hedera-testnet` | `hedera-mainnet`, `hedera-testnet` | `hedera`, `hederaTestnet` | [API overview](https://www.quicknode.com/docs/hedera/api-overview) |
| Arc | Yes | Mainnet (5042), Testnet (5042002) | `arc-mainnet`, `arc-testnet` | `arc-mainnet`, `arc-testnet` | `arc`, `arcTestnet` | [API overview](https://www.quicknode.com/docs/arc/api-overview) |
| 0G | Yes | Mainnet (16661), Galileo testnet (16602) | `0g-mainnet` (Galileo: copy from dashboard) | `zerog-mainnet`, `zerog-galileo` | `zeroGMainnet`, `zeroGTestnet` | [API overview](https://www.quicknode.com/docs/0g/api-overview) |
| Whitechain | **Not listed** | n/a | n/a | n/a | | Not in the [docs index](https://www.quicknode.com/docs/llms.txt), `docs/whitechain/llms.txt` returns 404, and it is not in the Streams/Webhooks network enums |

\* Seen in QuickNode's own `docs-demo` URLs (for example `https://docs-demo.worldchain-mainnet.quiknode.pro/`). Your URL is `https://<name>.<subdomain>.quiknode.pro/<token>/`. **Copy it from the dashboard rather than building it by hand.** We did not see the subdomains for the testnets in the docs, so treat them as likely, not confirmed.

All five chains are listed with HTTP and WSS, archive data, no pruning, and support for **Streams** and **Webhooks**. The Streams/Webhooks slugs come from the [Streams OpenAPI](https://api.quicknode.com/streams/rest/openapi.json) and the [Webhooks OpenAPI](https://api.quicknode.com/webhooks/rest/openapi.json). Datasets per chain: [Streams supported chains](https://www.quicknode.com/docs/streams/supported-chains). On all five chains you get block, block_with_receipts, transactions, logs, receipts and debug_trace. `trace_block` is listed only for Arc.

Testing done: viem `getChainId` + `getBlockNumber` against QuickNode's demo endpoints for World Chain mainnet, Unichain mainnet, Hedera testnet, Arc mainnet and 0G mainnet, and against public RPCs for all 10 networks. WebSocket `newHeads`/`logs` was tested on Unichain mainnet.

## APIs on each chain (per QuickNode docs)

| Chain | Extra APIs on the same endpoint | eth_subscribe types | Source |
|---|---|---|---|
| World Chain | Ethereum JSON-RPC, Debug, OP-Node (`optimism_syncStatus`, ...) | `newHeads`, `logs` | [index](https://www.quicknode.com/docs/worldchain/llms.txt) |
| Unichain | JSON-RPC, Debug, OP-Node, **Flashblocks** (`pending` tag; Flashblocks subscriptions `newFlashblocks`, `newFlashblockTransactions`, `pendingLogs`) | `newHeads`, `logs` | [index](https://www.quicknode.com/docs/unichain/llms.txt), [Flashblocks](https://www.quicknode.com/docs/unichain/flashblocks/overview) |
| Hedera | EVM JSON-RPC, Debug, **Mirror Node REST** (`/api/v1/accounts`, `/tokens`, `/contracts/.../results/logs`, ...) | `newHeads`, `logs` | [index](https://www.quicknode.com/docs/hedera/llms.txt) |
| Arc | JSON-RPC, Trace, Debug | `newHeads`, `logs`, `newPendingTransactions` | [index](https://www.quicknode.com/docs/arc/llms.txt) |
| 0G | EVM JSON-RPC, Debug | `newHeads`, `logs` | [index](https://www.quicknode.com/docs/0g/llms.txt) |

Add-ons on sponsor chains ([catalog](https://www.quicknode.com/docs/add-ons)): **GoldRush** data APIs list World Chain, Unichain and Arc (paid). **Single Flight RPC** lists 0G. The Token and NFT API v2 is not listed for the sponsor chains.

## Faucet

The [QuickNode faucet](https://faucet.quicknode.com/drip) lists **Unichain Sepolia** (https://faucet.quicknode.com/unichain/sepolia) and no other sponsor chain ([faucet docs](https://faucet.quicknode.com/llms-full.txt)). Use each chain's own faucet for the others (see the `sponsor-chains` skill).

## Chain notes that bite

- **Hedera:** the JSON-RPC relay reports balances with 18 decimals. Mirror Node and HBAR amounts use 8 (tinybars). The ratio is 10^10, which we checked on testnet. viem's `hedera` chain has no `multicall3` address. Hedera-native features (HTS tokens, accounts `0.0.x`, HCS topics) need the Hedera SDK. QuickNode gives you EVM RPC plus Mirror Node reads.
- **Arc:** USDC is the native gas token (viem `arc`: symbol USDC, 18 decimals for gas). Read Arc's EVM differences before writing value-transfer code (see the `sponsor-chains` skill).
- **0G:** use viem `zeroGTestnet` (16602) for Galileo. viem's `zeroG` export is the old 16600 testnet, and `zeroGGalileoTestnet` (16601) is deprecated.
- **Unichain:** `pending` reads return Flashblock state (200 ms). `latest` is the last sealed block.
- **World Chain:** World ID and Mini Apps come from World's own docs and SDKs. QuickNode only provides the RPC and data.

For deeper chain facts (faucets, explorers, gas tokens, contract addresses): `npx skills add 0xvikram/backboard-skills --skill sponsor-chains`.
