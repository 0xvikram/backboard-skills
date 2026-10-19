# The Graph on ETHGlobal Mumbai sponsor chains

Checked 2026-10-19. Sources:
- **Registry:** The Graph networks registry v0.8.7, updated 2026-10-08, at https://networks-registry.thegraph.com/TheGraphNetworksRegistry.json (repo: https://github.com/graphprotocol/networks-registry).
- **Supported networks page:** the data behind https://thegraph.com/docs/en/supported-networks/.

The value in the "`network:` name" column is what you put in `subgraph.yaml` and `networks.json`. The registry also lists aliases, but use the ID.

| Chain | Chain ID | `network:` name | Subgraphs in Studio | Substreams |
| --- | --- | --- | --- | --- |
| Unichain mainnet | 130 | `unichain` | Yes (full support, indexing rewards) | Yes |
| Unichain Sepolia | 1301 | `unichain-testnet` | Yes (basic) | Yes |
| Arc mainnet | 5042 | `arc` | Yes (basic) | Yes |
| Arc testnet | 5042002 | `arc-testnet` | Yes (basic) | No |
| World Chain mainnet | 480 | `worldchain` | **No** | Yes (`mainnet.worldchain.streamingfast.io:443`) |
| World Chain Sepolia | 4801 | not listed | No | No |
| Hedera (295 / 296) | | not listed | No | No |
| 0G (16661 / 16602) | | not listed | No | No |
| Whitechain (1875 / 1874) | | not listed | No | No |

Registry aliases: `unichain` = `unichain-mainnet`/`evm-130`; `unichain-testnet` = `unichain-sepolia`/`unisepolia`/`evm-1301`; `arc` = `arc-mainnet`/`evm-5042`; `arc-testnet` = `arctest`/`evm-5042002`; `worldchain` = `worldchain-mainnet`/`evm-480`.

## What this means at the hackathon

- **Unichain and Arc:** follow the normal flow (`graph init --network unichain-testnet` or `arc-testnet`, then `graph deploy` to Studio). Arc's native gas token is USDC, which makes no difference to a subgraph.
- **World Chain:** you cannot deploy to Subgraph Studio. Use Substreams with a token from https://thegraph.market, or run your own graph-node against a World Chain RPC. See [recipes.md section 7](recipes.md#7-world-chain-substreams-or-your-own-graph-node). For a small World Chain app, plain `getLogs` with viem may be enough.
- **Hedera, 0G, Whitechain, World Chain Sepolia:** not in The Graph's registry. A self-hosted graph-node can index any EVM chain with an RPC that supports `eth_getLogs` ([supported networks, "Running Graph Node locally"](https://thegraph.com/docs/en/supported-networks/)). We have not tested that on these chains.

The chain IDs match the verified list used across Backboard skills. For RPCs, explorers and faucets, see the `sponsor-chains` skill: `npx skills add 0xvikram/backboard-skills --skill sponsor-chains`.
