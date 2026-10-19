# Pimlico on ETHGlobal Mumbai sponsor chains

Source for every row: https://docs.pimlico.io/guides/supported-chains (read 2026-10-19). Chain lists change; re-check there.
Endpoint: `https://api.pimlico.io/v2/<chainId>/rpc?apikey=<YOUR_API_KEY>` (the slug also works).

| Chain | Chain ID | Pimlico slug | viem import | Bundler + paymaster (EntryPoint 0.7) | Status |
| --- | --- | --- | --- | --- | --- |
| World Chain | 480 | `worldchain` | `worldchain` | yes | Supported |
| World Chain Sepolia | 4801 | `worldchain-sepolia` | `worldchainSepolia` | yes | Supported |
| Unichain | 130 | `unichain` | `unichain` | yes | Supported |
| Unichain Sepolia | 1301 | `unichain-testnet` | `unichainSepolia` | yes | Supported |
| Arc Mainnet | 5042 | `arc` | `arc` | yes | Supported |
| Arc Testnet | 5042002 | `arc-testnet` | `arcTestnet` | yes | Supported |
| Hedera | – | – | – | – | Not listed by Pimlico |
| 0G | – | – | – | – | Not listed by Pimlico |
| Whitechain | – | – | – | – | Not listed by Pimlico |

All six supported chains also list EIP-7702 support. EntryPoint 0.8 is listed on all except World Chain Sepolia (0.6, 0.7 and 0.9 there). EntryPoint 0.9 has bundler but no paymaster on all of them.

## Which account to use (EntryPoint 0.7)

| Chain | Safe 1.4.1 | Simple Account | Kernel 0.3.x | Kernel 0.2.x |
| --- | --- | --- | --- | --- |
| World Chain | yes | yes | yes | no |
| World Chain Sepolia | yes | yes | **no** | no |
| Unichain / Unichain Sepolia | yes | yes | yes | no |
| Arc / Arc Testnet | yes | yes | **no** (docs) | listed (but Kernel 0.2.x needs EntryPoint 0.6 in permissionless) |

Default for these chains: **Safe 1.4.1** or **Simple Account**. Same code as Sepolia, only `chain` changes (recipes.md #5).

## What we checked live (2026-10-19, keyless public bundler, nothing sent)

On World Chain Sepolia, Unichain Sepolia and Arc Testnet, with permissionless@0.5.0 / viem@2.57.7:
- `pimlicoClient.getUserOperationGasPrice()` returned prices.
- `eth_supportedEntryPoints` returned the 0.7 EntryPoint `0x0000000071727De22E5E9d8BAf0edAc6f37da032`.
- A batched user operation (2 calls, including account deployment) passed bundler gas estimation for Safe 1.4.1 and Simple Account.
- Kernel 0.3.1: estimation passed on Unichain Sepolia and (although the docs table says no) on Arc Testnet; on World Chain Sepolia the account address came back `0x000…000` and estimation failed. Follow the docs table, not our result.
- Sponsorship (paymaster) itself was not run: it needs a real API key.

## Chain notes

- **Arc**: the native gas token is USDC (`arcTestnet.nativeCurrency.symbol === "USDC"` in viem). With Pimlico sponsoring, users need no gas token. For self-paid gas or faucets, check Arc's docs.
- **World Chain**: the ERC-20 paymaster lists USDC and WLD on mainnet, USDC and PIM on Sepolia ([supported tokens](https://docs.pimlico.io/guides/how-to/erc20-paymaster/supported-tokens)). Call `getTokenQuotes` first; the keyless endpoint returned none for Sepolia in our test. If you build a World App mini app, check World's own docs for how transactions are sent inside the app; this skill covers your own smart accounts.
- **Unichain**: no ERC-20 paymaster tokens listed; use sponsorship.
- Not listed: Hedera, 0G, Whitechain. You will get `chain ... is not supported`. Ask Pimlico (https://t.me/pimlicoHQ) or use another tool.
