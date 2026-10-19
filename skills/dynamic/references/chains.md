# Dynamic and the ETHGlobal Mumbai sponsor chains

Dynamic says it supports "EVM (including all EVM networks)" ([enabling chains](https://www.dynamic.xyz/docs/react/chains/enabling-chains)), and embedded wallets can "send & sign" on all EVM networks ([chain support](https://www.dynamic.xyz/docs/embedded-wallets/chains/overview)). So any EVM chain works through `EthereumWalletConnectors`. If it isn't in your dashboard list, add it with `overrides.evmNetworks` (recipe 6 in [recipes.md](recipes.md)).

Chain IDs below come from `viem@2.57.7` (`viem/chains`). On 2026-10-19 each was checked with `eth_chainId` against the chain's default public RPC.

| Chain | Where Dynamic names it | Testnet (viem export, ID) | Mainnet (viem export, ID) | Status |
| - | - | - | - | - |
| **World Chain** | Token balances and transaction-history tables list "World" / "World Chain" 480 and Sepolia 4801 ([token balances](https://www.dynamic.xyz/docs/react/reference/token-balances), [wallet transactions](https://www.dynamic.xyz/docs/react/wallets/using-wallets/general/get-wallet-transactions)) | `worldchainSepolia`, 4801 (RPC OK) | `worldchain`, 480 (RPC OK) | Supported as EVM. Check the dashboard list; otherwise add as a custom network |
| **Unichain** | Same two pages: Unichain 130, Unichain Sepolia 1301 | `unichainSepolia`, 1301 (RPC OK) | `unichain`, 130 (RPC OK) | Supported as EVM. Same as above |
| **Arc** | Tier 1 embedded-wallet chain, with send/sign, gasless, on-chain events and delegated access ([chain support](https://www.dynamic.xyz/docs/embedded-wallets/chains/overview)). Gas sponsorship lists Arc 5042 and Arc Testnet 5042002 ([gas sponsorship](https://www.dynamic.xyz/docs/embedded-wallets/gas-sponsorship)) | `arcTestnet`, 5042002 (RPC OK) | `arc`, 5042 (RPC OK) | Best-supported sponsor chain in Dynamic |
| **Hedera** | Not mentioned in Dynamic docs (docs search, 2026-10-19) | `hederaTestnet`, 296 (RPC OK, hashio relay) | `hedera`, 295 | Not confirmed. Its JSON-RPC relay is EVM-compatible, so the custom-network route should work for EVM-style accounts. Untested with Dynamic |
| **0G** | Not mentioned in Dynamic docs | `zeroGTestnet`, 16602 (Galileo; viem's older `zeroGGalileoTestnet`, 16601, is deprecated) | `zeroGMainnet`, 16661 | Not confirmed. Use the custom-network route; chain facts in the `sponsor-chains` skill |
| **Whitechain** | Not mentioned in Dynamic docs | `whitechainSepolia`, 1874 (the current testnet; the older `whitechainTestnet`, 2625, isn't in Whitechain's docs) | `whitechain`, 1875 (legacy L1; the L2 mainnet isn't live) | Not confirmed. EVM, so use the custom-network route. Untested with Dynamic |

## Adding one quickly

```ts
import { arcTestnet, worldchainSepolia, unichainSepolia, hederaTestnet } from 'viem/chains';
import { toEvmNetwork } from './networks'; // helper from recipe 6

const customEvmNetworks = [arcTestnet, worldchainSepolia, unichainSepolia, hederaTestnet].map((c) => toEvmNetwork(c));
// settings.overrides.evmNetworks = (dash) => mergeNetworks(customEvmNetworks, dash)
```

## Caveats

- Chain-specific extras (gasless, on-chain webhooks, delegated access) depend on Dynamic infrastructure per chain. Gas sponsorship covers only the chains on https://www.dynamic.xyz/docs/embedded-wallets/gas-sponsorship. Arc is there; World Chain, Unichain, Hedera, 0G and Whitechain are not (as of 2026-10-19).
- Being "supported as EVM" means wallets can sign and send there. It doesn't mean Dynamic's token-balance or tx-history APIs cover the chain. Check those tables for each feature.
- World Chain Mini Apps use World App's own wallet (MiniKit), not Dynamic. Dynamic fits a normal web app that runs on World Chain.
- Not tested: a real sign-in plus transaction on any of these chains through Dynamic (that needs a real environment ID and funded wallet). Only the network config, the viem mapping (`getOrMapViemChain`) and the RPC chain IDs were checked.
