# Reown AppKit and the ETHGlobal Mumbai sponsor chains

AppKit supports any EVM chain that viem knows about: "You can find all the networks supported by Viem within the `@reown/appkit/networks` path" (https://docs.reown.com/appkit/react/core/installation.md). It also supports custom chains via `defineChain` (https://docs.reown.com/appkit/networks/custom-networks.md).

"Supported" has layers, though (https://docs.reown.com/appkit/networks/overview.md):

1. **Connect + sign + send with an external wallet** (MetaMask, Rabby, mobile wallets over WalletConnect): works on any chain in your `networks` list, as long as the wallet supports that chain.
2. **Reown's RPC (Blockchain API)** for balances and default reads: a closed list, https://docs.reown.com/cloud/blockchain-api.md. Chains not on it fall back to viem's public RPC. Put your own RPC in `customRpcUrls` (recipes.md #4).
3. **Email/social (embedded) wallets** only transact reliably on Blockchain-API chains.

Exports below were checked in the installed `@reown/appkit@1.8.24` (viem 2.57.7). Each default RPC answered the expected `eth_chainId` on 2026-10-19.

| Chain | Testnet export (ID) | Mainnet export (ID) | Reown RPC (Blockchain API) | Email/social wallets |
| - | - | - | - | - |
| World Chain | `worldchainSepolia` (4801) | `worldchain` (480) | No | Login yes; transactions not guaranteed |
| Unichain | `unichainSepolia` (1301) | `unichain` (130) | **Yes** (listed, "availability not guaranteed") | Yes |
| Hedera | `hederaTestnet` (296) | `hedera` (295) | No | Login yes; transactions not guaranteed |
| Arc | `arcTestnet` (5042002) | `arc` (5042) | No | Login yes; transactions not guaranteed |
| 0G | `zeroGTestnet` (16602, Galileo) | `zeroGMainnet` (16661) | No | Login yes; transactions not guaranteed |
| Whitechain | `whitechainSepolia` (1874) | `whitechain` (1875, legacy L1) | No | Login yes; transactions not guaranteed |

Exports to avoid:
- `zeroG` is 16600, the retired "0G Newton Testnet". `zeroGGalileoTestnet` is 16601, which is deprecated. Use `zeroGTestnet` (16602).
- `whitechainTestnet` is 2625, which is outdated. Use `whitechainSepolia` (1874). Whitechain's L2 mainnet isn't live yet.

Copy-paste: recipe 4 in [recipes.md](recipes.md#4-sponsor-chains-and-your-own-rpc).

Chain-specific notes:
- **World Chain**: for a Mini App inside World App, use World's MiniKit wallet, not AppKit. AppKit is for a regular web app on World Chain.
- **Hedera**: the JSON-RPC relay (`hashio.io`) is what viem's `hedera`/`hederaTestnet` use. The wallet must support Hedera's EVM chain IDs. Native Hedera (HTS, accounts as `0.0.x`) is outside AppKit.
- **Arc**: the export's `nativeCurrency` is USDC with 18 decimals (the native gas balance). The USDC ERC-20 on Arc may use different decimals, so read Arc's docs before you show token balances.
- None of these chains (except Unichain) is named anywhere in Reown's docs. Support comes from the viem exports plus the generic EVM path, and was not tested end to end with a real wallet.

More chain facts (faucets, explorers, RPCs): `npx skills add 0xvikram/backboard-skills --skill sponsor-chains`.
