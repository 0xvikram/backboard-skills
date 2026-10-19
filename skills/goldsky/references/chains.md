# Goldsky on ETHGlobal Mumbai sponsor chains

Checked 2026-10-19. Sources:
- **Per-chain docs pages:** https://docs.goldsky.com/chains/0g, /chains/hedera, /chains/arc, /chains/worldchain, /chains/unichain. Slugs come from each page's Subgraphs and Turbo sections.
- **Coverage matrix:** https://docs.goldsky.com/chains/supported-networks
- **Turbo dataset catalog** (no login needed): https://app.goldsky.com/explore. Dataset names and versions below were read from it.

There are two kinds of slug:
- **Subgraph slug:** the `chain` in an instant-subgraph config, or `network:` in `subgraph.yaml`. These use hyphens.
- **Turbo slug:** the prefix of `dataset_name` in a pipeline. These use underscores. Mirror (legacy) uses the same datasets as Turbo.

## Subgraphs

| Chain | Chain ID | Subgraph slug | Notes |
| --- | --- | --- | --- |
| 0G mainnet | 16661 | `0g` | Partner Sponsored |
| 0G Galileo testnet | 16602 | `0g-galileo-testnet` | Partner Sponsored |
| Hedera mainnet | 295 | `hedera-mainnet` | |
| Hedera testnet | 296 | `hedera-testnet` | |
| Arc mainnet | 5042 | `arc-mainnet` | |
| Arc testnet | 5042002 | `arc-testnet` | |
| World Chain | 480 | `worldchain` | |
| World Chain Sepolia | 4801 | `worldchain-sepolia` | |
| Unichain | 130 | `unichain` | Partner Sponsored |
| Unichain Sepolia | 1301 | `unichain-testnet` | Partner Sponsored |
| Whitechain (1875 / 1874) | | not listed | no Goldsky docs page or dataset found |

"Partner Sponsored" means the chain may cover your usage "if approved by the team". Ask the chain's devrel for an access code ([0G page](https://docs.goldsky.com/chains/0g)).

## Turbo pipelines (and Mirror datasets)

| Chain | Turbo slug | Datasets seen in the catalog | Example version |
| --- | --- | --- | --- |
| 0G mainnet | `0g` | raw_logs, raw_blocks, receipt_transactions, erc20/721/1155_transfers (no traces) | `0g.raw_logs` 1.1.0 |
| 0G Galileo testnet | none | none | none |
| Hedera (both) | none | none | none |
| Arc mainnet | `arc_mainnet` | raw_logs, raw_blocks, raw_traces, receipt_transactions, erc20/721/1155_transfers, native_transfers, balances | `arc_mainnet.raw_logs` 1.1.0 |
| Arc testnet | `arc_testnet` | same as mainnet minus balances | `arc_testnet.erc20_transfers` 1.1.0 |
| World Chain | `worldchain` | the full EVM set, plus usdc_transfers and balances | `worldchain.raw_logs` **1.0.0**, `worldchain.erc20_transfers` **1.2.0** |
| World Chain Sepolia | none | none | none |
| Unichain | `unichain` | the full EVM set, plus balances | `unichain.raw_logs` 1.1.0 |
| Unichain Sepolia | `unichain_testnet` | raw_logs, raw_blocks, receipt_transactions, erc20/721/1155_transfers (no traces) | `unichain_testnet.erc20_transfers` **1.3.0** |

Versions differ per chain and change over time. Always check `https://app.goldsky.com/explore/<turbo_slug>/<dataset>` or run `goldsky dataset list` before you pin one.

## Other Goldsky products on these chains

From the supported-networks matrix (M = mainnet, T = testnet):

| Chain | Edge RPC | Compose |
| --- | --- | --- |
| 0G | no | no |
| Hedera | no | no |
| Arc | M+T | M+T (gas sponsoring) |
| World Chain | no | no |
| Unichain | M+T | M+T (gas sponsoring) |

## What this means at the hackathon

- **Hedera and 0G Galileo:** use **subgraphs** (instant or from source) plus **subgraph webhooks** for push. There is no Turbo or Mirror on these networks. The config's `address` is an EVM `0x...` address, so give it your contract's EVM address, not the Hedera `0.0.x` ID (not tested on Hedera).
- **0G mainnet, World Chain mainnet:** subgraphs, or Turbo pipelines on mainnet only. The testnets support subgraphs only.
- **Arc and Unichain:** every product is available on mainnet and testnet.
- Testing found that the CLI does not validate slugs, so a typo only fails at deploy. Copy the slugs from this file.
- Chain IDs match the verified list used across Backboard skills. For RPCs, explorers and faucets, see the `sponsor-chains` skill: `npx skills add 0xvikram/backboard-skills --skill sponsor-chains`.
