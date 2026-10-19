---
name: sponsor-chains
description: "Use when connecting to or deploying on World Chain, Unichain, Hedera, Arc, 0G or Whitechain (mainnet or testnet), for example at ETHGlobal Mumbai: chain IDs, RPC URLs, explorers, faucets, viem chain exports, Hardhat and Foundry config, and the gotchas that break deploys."
license: MIT
metadata:
  category: "Chains & L2s"
  source: "hand-written"
  checked: "2026-10-19"
  packages: "viem@2.57.7"
---

# Sponsor chains

Connection and deploy facts for the six chains with prize tracks at ETHGlobal Mumbai. Every chain ID below was confirmed against the chain's live public RPC on 19 Oct 2026. Testnets change: before deploying, confirm the chain ID and RPC on the official page linked in the reference.

## Testnets at a glance

| Chain | Chain ID | Public RPC | viem export | Gas token | Faucet |
| --- | --- | --- | --- | --- | --- |
| World Chain Sepolia | 4801 | `https://worldchain-sepolia.g.alchemy.com/public` | `worldchainSepolia` | ETH | alchemy.com/faucets/world-chain-sepolia |
| Unichain Sepolia | 1301 | `https://sepolia.unichain.org` | `unichainSepolia` | ETH | app.optimism.io/faucet |
| Hedera Testnet | 296 | `https://testnet.hashio.io/api` | `hederaTestnet` | HBAR | portal.hedera.com/faucet |
| Arc Testnet | 5042002 | `https://rpc.testnet.arc.io` | `arcTestnet` | USDC | faucet.circle.com |
| 0G Galileo Testnet | 16602 | `https://evmrpc-testnet.0g.ai` | `zeroGTestnet` | 0G | faucet.0g.ai |
| Whitechain Sepolia | 1874 | `https://rpc.testnet.whitechain.io` | `whitechainSepolia` | WBT | faucet.testnet.whitechain.io |

Mainnets, WebSockets, explorers, all faucets and Hardhat/Foundry snippets: [references/chains.md](references/chains.md).

## Gotchas that break deploys

- **0G:** the Galileo testnet is chain **16602**. viem's older `zeroGGalileoTestnet` (16601) and `zeroG` (16600) exports are deprecated: use `zeroGTestnet`. Compile for the Cancun EVM version. The faucet gives 0.1 0G a day, so ask the team early if you need more.
- **Arc:** gas is paid in USDC. Native amounts use 18 decimals, but the USDC token contract uses 6 for the same balance. A transaction with a max fee below 20 gwei is dropped silently. `PREVRANDAO` is always 0, so don't use it for randomness.
- **Hedera:** over JSON-RPC, values use 18 decimals while native HBAR uses 8 (1 tinybar = 10^10 wei). Use an ECDSA account with an EVM alias for EVM work; ED25519 keys can't sign EVM transactions. A faucet-created account can't send until it's completed. Associate an HTS token before receiving it. Hashio is for development only.
- **Whitechain:** it is moving to an OP Stack L2 whose mainnet isn't live yet; build on Whitechain Sepolia (1874). Check `eth_chainId` rather than the RPC hostname. The faucet needs a GitHub account at least 30 days old and limits by IP, so claim before the event or from a phone hotspot, not the venue Wi-Fi.
- **Unichain and World Chain:** the public RPCs are rate limited. Use a provider key (Alchemy, QuickNode and others on the board) for anything that polls.

## Using a chain with viem

```ts
import { createPublicClient, http } from "viem";
import { unichainSepolia } from "viem/chains";

const client = createPublicClient({ chain: unichainSepolia, transport: http() });
console.log(await client.getChainId()); // 1301
```

Swap in any export from the table. For Hardhat and Foundry config per chain, see [references/chains.md](references/chains.md).

## About

Hand-written for [Backboard](https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or any of these chains. Checked against each chain's official docs on 19 Oct 2026 (sources are in the reference). When this and the official docs disagree, the docs win.
