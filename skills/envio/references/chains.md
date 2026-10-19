# Envio on ETHGlobal Mumbai sponsor chains

Checked on 2026-10-19 in three ways:
1. Envio's docs: [HyperSync supported networks](https://docs.envio.dev/docs/HyperSync/hypersync-supported-networks), [HyperIndex supported chains](https://docs.envio.dev/docs/HyperIndex/supported-networks) and the per-chain pages at https://envio.dev/chains.
2. `envio@3.14.0` itself: we set each chain ID in `config.yaml` with no `rpc:` and ran `envio config view`. "RPC only" means it failed with `Failed to automatically find HyperSync endpoint`.
3. A live `GET https://<id>.hypersync.xyz/height` request (no token needed), plus `eth_chainId` on the public RPCs listed below.

| Chain | Chain ID | HyperIndex data source | HyperSync URL (client) |
| --- | --- | --- | --- |
| Arc mainnet | 5042 | HyperSync (built in) | `https://arc.hypersync.xyz` or `https://5042.hypersync.xyz` |
| Arc testnet | 5042002 | HyperSync (built in) | `https://arc-testnet.hypersync.xyz` or `https://5042002.hypersync.xyz` |
| Unichain mainnet | 130 | HyperSync (built in) | `https://unichain.hypersync.xyz` or `https://130.hypersync.xyz` |
| Unichain Sepolia | 1301 | **RPC only** | none |
| World Chain mainnet | 480 | HyperSync (built in) | `https://worldchain.hypersync.xyz` or `https://480.hypersync.xyz` |
| World Chain Sepolia | 4801 | **RPC only** | none |
| Hedera mainnet / testnet | 295 / 296 | **RPC only** (envio.dev/chains/hedera: "RPC source") | none |
| 0G mainnet / Galileo testnet | 16661 / 16602 | **RPC only** (envio.dev/chains/0g: "RPC source") | none |
| Whitechain / Whitechain Sepolia | 1875 / 1874 | **RPC only** (not listed by Envio) | none |

HyperRPC (JSON-RPC backed by HyperSync, token needed) exists for the same four HyperSync chains: `https://arc.rpc.hypersync.xyz`, `https://arc-testnet.rpc.hypersync.xyz`, `https://unichain.rpc.hypersync.xyz` and `https://worldchain.rpc.hypersync.xyz` ([HyperRPC networks](https://docs.envio.dev/docs/HyperRPC/hyperrpc-supported-networks)).

Envio's docs table still lists an old "0G Newton Testnet" (16600), which is not the current 0G testnet. Use Galileo **16602**.

## Public RPCs for RPC-only chains

Each of these answered `eth_chainId` with the expected ID on 2026-10-19. Public endpoints are rate-limited. For anything beyond a demo, use a provider RPC through `${ENVIO_..._RPC}`.

| Chain | RPC | Where it came from |
| --- | --- | --- |
| Unichain Sepolia (1301) | `https://sepolia.unichain.org` | checked live (eth_chainId) |
| World Chain Sepolia (4801) | `https://worldchain-sepolia.g.alchemy.com/public` | checked live (eth_chainId) |
| Hedera testnet (296) | `https://testnet.hashio.io/api` | checked live; testnet twin of the Hashio URL on envio.dev/chains/hedera |
| Hedera mainnet (295) | `https://mainnet.hashio.io/api` | https://envio.dev/chains/hedera |
| 0G Galileo (16602) | `https://evmrpc-testnet.0g.ai` | checked live (eth_chainId) |
| 0G mainnet (16661) | `https://evmrpc.0g.ai` | https://envio.dev/chains/0g |
| Whitechain | see the `sponsor-chains` skill | not checked here |

Example (V3 syntax; the envio.dev/chains pages show the old `rpc_config:` key, which V3 rejects):

```yaml
chains:
  - id: 296 # Hedera testnet
    rpc: ${ENVIO_HEDERA_RPC:-https://testnet.hashio.io/api}
    start_block: <DEPLOY_BLOCK>
    contracts:
      - name: MyContract
        address: "<CONTRACT_ADDRESS>"
```

## What this means at the hackathon

- **Arc, Unichain mainnet, World Chain mainnet:** the default setup works: a token in `.env`, `start_block: 0` is fine, and backfill is fast. Arc testnet is the only sponsor **testnet** with HyperSync.
- **Unichain Sepolia, World Chain Sepolia, Hedera, 0G, Whitechain:** add `rpc:` and set `start_block` to your deploy block. No HyperSync token is needed for these chains. If you want an indexer mainly for a testnet demo, Arc testnet is the easiest.
- **Hedera:** the EVM RPC goes through a JSON-RPC relay (Hashio), so `eth_getLogs` on it may be slow or limited. Keep the block range small. We did not run a full sync against it.
- **HyperSync client (raw queries):** only works on the four HyperSync chains above.
- Envio can request HyperSync support for a chain. Ask on https://discord.gg/envio.

Chain IDs match the verified list used across Backboard skills. For explorers, faucets and more RPCs, see the `sponsor-chains` skill: `npx skills add 0xvikram/backboard-skills --skill sponsor-chains`.
