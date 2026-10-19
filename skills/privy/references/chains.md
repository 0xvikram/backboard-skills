# Privy on ETHGlobal Mumbai sponsor chains

Privy embedded wallets work on "any EVM-compatible chain" that you add with `defaultChain` / `supportedChains` (https://docs.privy.io/basics/react/advanced/configuring-evm-networks). How to configure: [recipes.md #7](recipes.md#7-add-world-chain-unichain-or-any-custom-chain).

| Chain | Status with Privy | Chain IDs | `viem/chains` export | Where support is stated |
| - | - | - | - | - |
| **World Chain** | Supported | 480 (mainnet), 4801 (Sepolia) | `worldchain`, `worldchainSepolia` | Listed in gas sponsorship networks (https://docs.privy.io/wallets/gas-and-asset-management/gas/overview) and swap chains (https://docs.privy.io/wallets/actions/swap/overview). World mini app guide: https://docs.privy.io/recipes/world/mini-apps |
| **Unichain** | Supported | 130 (mainnet), 1301 (Sepolia) | `unichain`, `unichainSepolia` | Listed in gas sponsorship networks, mainnet and Unichain Sepolia (https://docs.privy.io/wallets/gas-and-asset-management/gas/overview), and swap chains (https://docs.privy.io/wallets/actions/swap/overview) |
| Hedera | Not confirmed | - | - | No Privy page found. Hedera EVM may work through `defineChain` like any EVM chain, but we did not test it. Check the docs. |
| Arc | Not confirmed | - | - | No Privy page found. Check the docs. |
| 0G | Not confirmed | - | - | No Privy page found. Check the docs. |
| Whitechain | Not confirmed | - | - | No Privy page found. Check the docs. |

"Not confirmed" means we found no mention in https://docs.privy.io/llms-full.txt on 2026-10-19. Privy says any EVM chain can be added by hand, but we have not tested these.

## Checked on 2026-10-19

The chain IDs above come from `viem@2.57.5` chain definitions. We called `getChainId()` on each chain's default public RPC:

```
World Chain          config id 480   rpc chainId 480
World Chain Sepolia  config id 4801  rpc chainId 4801
Unichain             config id 130   rpc chainId 130
Unichain Sepolia     config id 1301  rpc chainId 1301
```

Default RPCs in viem 2.57.5 (rate limited, fine for testing):
- World Chain Sepolia: `https://worldchain-sepolia.g.alchemy.com/public`, explorer https://sepolia.worldscan.org
- Unichain Sepolia: `https://sepolia.unichain.org`, explorer https://sepolia.uniscan.xyz

## Notes

- Neither chain is in Privy's **default** network list. You must pass them in `supportedChains`, or wallets start on Ethereum mainnet.
- Test ETH: find faucets in the chain docs, https://docs.world.org/world-chain and https://docs.unichain.org. We did not check faucet URLs here.
- Gas sponsorship (`sendTransaction(tx, {sponsor: true})`) lists both chains and their Sepolia testnets. You must turn it on in Dashboard > Fee sponsorship; this costs credits.
- For World App mini apps, users log in with their World wallet through SIWE: [recipes.md #8](recipes.md#8-world-mini-app-login-siwe-through-world-app).
