# Sponsor chains with Scaffold-ETH 2

Scaffold-ETH 2 works with any EVM chain. It takes chains from `viem/chains` or from your own `defineChain` (https://docs.scaffoldeth.io/recipes/add-custom-chain). No sponsor chain is preconfigured in `hardhat.config.ts`, `foundry.toml` or `scaffold.config.ts`, so add them yourself (recipes.md 4).

Checked on 2026-10-19: every testnet below returned the expected chain ID and a fresh block. The checks used viem 2.53.1 (the template's version), Hardhat 3 `network.connect`, and the scaffold app in a browser (World Chain Sepolia).

| Chain | Chain ID (mainnet / testnet) | viem 2.53.1 export (testnet) | Testnet RPC that worked | Verify on |
|---|---|---|---|---|
| World Chain | 480 / 4801 | `worldchainSepolia` | `https://worldchain-sepolia.g.alchemy.com/public` (viem default; `eth_getLogs` max 100 blocks) | Etherscan V2 or Sourcify |
| Unichain | 130 / 1301 | `unichainSepolia` | `https://sepolia.unichain.org` | Etherscan V2 or Sourcify |
| Arc | 5042 / 5042002 | `arcTestnet` (mainnet `arc` has **no RPC** in this viem) | `https://rpc.testnet.arc.io` (**override needed**; the viem default `rpc.testnet.arc.network` did not answer) | Sourcify (testnet); Etherscan V2 lists mainnet 5042 |
| Hedera | 295 / 296 | `hederaTestnet` | `https://testnet.hashio.io/api` | Sourcify (HashScan) |
| 0G | 16661 / **16602** (Galileo) | `zeroGTestnet` (not the deprecated `zeroGGalileoTestnet` 16601) | `https://evmrpc-testnet.0g.ai` | Sourcify |
| Whitechain | 1875 (legacy L1) / **1874** (Whitechain Sepolia) | `whitechainSepolia` (not the outdated `whitechainTestnet` 2625) | `https://rpc.testnet.whitechain.io` | Sourcify |

Sources:
- Chain IDs: Backboard wave-1 checks against live RPCs, plus `eth_chainId` calls on 2026-10-19 (see TESTED.md).
- Arc RPCs, explorer (`explorer.arc.io`, `explorer.testnet.arc.io`) and faucet: https://docs.arc.io/arc/references/rpc-endpoints.md
- Verification support: https://sourcify.dev/server/chains (all six testnets listed) and https://api.etherscan.io/v2/chainlist (480, 4801, 130, 1301, 5042 listed).

## Things to know per chain

- **Arc:** USDC is the gas token (18 decimals natively). There is a 20 gwei `maxFeePerGas` floor, and sending value to `address(0)` reverts. Read https://docs.arc.io/arc/references/evm-differences.md before writing value-transfer code. Testnet USDC: https://faucet.circle.com.
- **Hedera:** reads through the Hashio JSON-RPC relay worked. Deploying was not tested here. Hedera accounts and HBAR decimals work differently from Ethereum, so check the sponsor-chains skill and the Hedera docs before you fund a deployer.
- **0G and Whitechain:** both use standard EVM tooling. Use the testnet IDs above (16602, 1874).
- **EVM version:** solc 0.8.30 in the template targets `prague`. PUSH0, TSTORE and MCOPY all ran via `eth_call` on all six testnets. The Osaka opcode CLZ did **not** run on Hedera, 0G or Whitechain, so do not set `evmVersion: "osaka"` for those chains.

## Snippet: all six testnets in `scaffold.config.ts`

```ts
targetNetworks: [
  chains.worldchainSepolia,
  chains.unichainSepolia,
  chains.arcTestnet,
  chains.hederaTestnet,
  chains.zeroGTestnet,
  chains.whitechainSepolia,
],
rpcOverrides: {
  [chains.arcTestnet.id]: "https://rpc.testnet.arc.io",
},
```

(Tested together with `chains.hardhat` and an Arc mainnet `defineChain` in the same list: type-check and `next build` passed.)

For faucets, explorers, mainnet details and chain quirks, install the companion skill:

```bash
npx skills add 0xvikram/backboard-skills --skill sponsor-chains
```
