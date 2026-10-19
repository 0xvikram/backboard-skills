# Alchemy on ETHGlobal Mumbai sponsor chains

Checked 2026-10-19. Support changes, so check the [chain/product matrix](https://dashboard.alchemy.com/chains) before you build on an enhanced API.

| Chain | Supported? | RPC URL (`<KEY>` = your API key) | viem chain | Chain ID |
|---|---|---|---|---|
| World Chain | Yes: Mainnet + Sepolia | `https://worldchain-mainnet.g.alchemy.com/v2/<KEY>`, `https://worldchain-sepolia.g.alchemy.com/v2/<KEY>` | `worldchain`, `worldchainSepolia` | 480, 4801 |
| Unichain | Yes: Mainnet + Sepolia | `https://unichain-mainnet.g.alchemy.com/v2/<KEY>`, `https://unichain-sepolia.g.alchemy.com/v2/<KEY>` | `unichain`, `unichainSepolia` | 130, 1301 |
| Arc | Yes: Mainnet + Testnet | `https://arc-mainnet.g.alchemy.com/v2/<KEY>`, `https://arc-testnet.g.alchemy.com/v2/<KEY>` | `arc`, `arcTestnet` | 5042, 5042002 |
| Hedera | Not listed in Alchemy's docs | n/a | | |
| 0G | Not listed in Alchemy's docs | n/a | | |
| Whitechain | Not listed in Alchemy's docs | n/a | | |

"Not listed" means no mention in Alchemy's full docs export (`llms-full.txt`) or chain list on 2026-10-19. Check https://www.alchemy.com/docs/reference/node-supported-chains before ruling it out.

Sources for the RPC URLs: [Chain API supported chains](https://www.alchemy.com/docs/reference/node-supported-chains), [World Chain quickstart](https://www.alchemy.com/docs/reference/world-chain-api-quickstart), [Unichain quickstart](https://www.alchemy.com/docs/reference/unichain-api-quickstart), [Arc FAQ](https://www.alchemy.com/docs/reference/arc-api-faq) ("Alchemy supports both Arc Mainnet and Arc Testnet"). Chain IDs are from viem@2.57.7 and were confirmed live with `eth_chainId`.

## What else works on these chains (per Alchemy docs)

| Product | World Chain | Unichain | Arc | Source |
|---|---|---|---|---|
| Wallet APIs: bundler, gas sponsorship, ERC-20 gas, BSO | Yes (Mainnet + Sepolia) | Yes (Mainnet + Sepolia) | Yes (Mainnet + Testnet) | [Wallet APIs supported chains](https://www.alchemy.com/docs/wallets/supported-chains) |
| Webhooks (network enum exists) | `WORLDCHAIN_MAINNET`, `WORLDCHAIN_SEPOLIA` | `UNICHAIN_MAINNET`, `UNICHAIN_SEPOLIA` | `ARC_MAINNET`, `ARC_TESTNET` | [Create webhook API](https://www.alchemy.com/docs/data/webhooks/webhooks-api-endpoints/notify-api-endpoints/create-webhook) |
| Internal ETH transfers in Address Activity webhooks | No | No | Yes | [Address Activity webhook](https://www.alchemy.com/docs/reference/address-activity-webhook) |
| NFT API (getNFTsForOwner) | Yes (named in docs) | Check the dashboard | Check the dashboard | [NFTs By Owner](https://www.alchemy.com/docs/reference/nft-api-endpoints/nft-api-endpoints/nft-ownership-endpoints/get-nf-ts-for-owner-v-3) |
| NFT spam filter (paid tiers) | Yes (mainnet) | Yes (mainnet) | Not listed | same page |
| Transfers API `internal` category | No | No | Yes | [alchemy_getAssetTransfers](https://www.alchemy.com/docs/data/transfers-api/transfers-endpoints/alchemy-get-asset-transfers) |
| Token API, Transfers API (other categories), Portfolio API | Check the dashboard | Check the dashboard | Check the dashboard | https://dashboard.alchemy.com/chains |

## Chain-specific notes

- **World Chain:** verified humans (World ID) get priority blockspace and a gas allowance ([Alchemy World Chain FAQ](https://www.alchemy.com/docs/reference/world-chain-api-faq)). For World ID or Mini App work, use World's own docs. Alchemy only gives you the RPC and data.
- **Unichain:** 1-second blocks. Alchemy also documents Flashblocks for faster pre-confirmations ([Flashblocks quickstart](https://www.alchemy.com/docs/reference/unichain-flashblocks-api-quickstart)).
- **Arc:** a Circle L1 with **USDC as the native gas token**. Native USDC uses 18 decimals for gas. Sending value to `address(0)` reverts, and there is a 20 gwei `maxFeePerGas` floor. Read the [Arc EVM differences](https://docs.arc.io/arc/references/evm-differences.md) before you write value-transfer or gas code. viem's `arc` chain has `nativeCurrency` USDC with 18 decimals.
