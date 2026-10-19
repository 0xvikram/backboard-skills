# Namespace and the ETHGlobal Mumbai sponsor chains

Namespace names are ENS names. They live in one of three places:
- **Offchain**: Namespace's database, under a parent on Ethereum mainnet or Sepolia ENS, read through CCIP Read.
- **L1**: ENS contracts on Ethereum (mainnet 1, Sepolia 11155111).
- **L2**: Namespace registry contracts on Base (8453), Optimism (10), Base Sepolia (84532).

Sources: https://docs.namespace.ninja/getting-started, https://docs.namespace.ninja/developer-guide/sdks/mint-manager/installation#supported-networks, https://docs.namespace.ninja/developer-guide/sdks/indexer-manager

None of the sponsor chains host Namespace names or contracts. What you can do on a sponsor chain is make a name **point to an address there** (an ENS address record), so `alice.yourapp.eth` pays out on World Chain, Unichain, and so on. The Namespace team says it works on any EVM chain; in the docs that is done through address records, including the ENSIP-19 default EVM address (`ChainName.Default`, set by `setDefaultEvmAddress`).

| Chain | Chain IDs (mainnet / testnet) | Offchain SDK `ChainName` | Status |
| - | - | - | - |
| World Chain | 480 / 4801 | `ChainName.WorldChain` (`"world_chain"`) | Address records stated: https://docs.namespace.ninja/developer-guide/sdks/offchain-manager/chainname |
| Unichain | 130 / 1301 | `ChainName.Unichain` (`"unichain"`) | Address records stated (same page) |
| Hedera | 295 / 296 | none (Resolvio lists `hbar`, coin 3030, for a native Hedera account) | Not confirmed in the Namespace SDK. Covered only by the default EVM address; check the docs |
| Arc | 5042 / 5042002 | none | Not confirmed; default EVM address only |
| 0G | 16661 / 16602 (Galileo) | none | Not confirmed; default EVM address only |
| Whitechain | 1874 (Whitechain Sepolia); legacy L1 1875 | none | Not confirmed; default EVM address only |

## Pointing a name at a sponsor-chain address

```ts
import { ChainName } from '@thenamespace/offchain-manager';
await client.addAddressRecord('alice.yourapp.eth', ChainName.WorldChain, '0xYourWorldChainAddress');
await client.addAddressRecord('alice.yourapp.eth', ChainName.Unichain, '0xYourUnichainAddress');
// or one call for every EVM chain, including the ENSIP-19 default:
await client.setDefaultEvmAddress('alice.yourapp.eth', '0xYourAddress');
```

Reading it from an app on that chain (ENS lookups always go through an Ethereum mainnet or Sepolia client):
```ts
import { toCoinType } from 'viem/ens';
import { worldchain } from 'viem/chains';
const addr = await mainnetClient.getEnsAddress({ name: 'alice.yourapp.eth', coinType: toCoinType(worldchain.id) });
```

**Unverified, test it first:** the offchain SDK 1.0.13 stores L2 address records under the plain chain ID (e.g. coin `480` for World Chain, `8453` for Base), while ENSIP-11 / viem `toCoinType` use `0x80000000 | chainId` (`2147484128` for World Chain). We could not write a record without a key, so we did not confirm whether Namespace's gateway maps one to the other. If `getEnsAddress({ coinType: toCoinType(...) })` returns `null` for your L2 record, read the ETH record (`coinType` omitted) or the default EVM address instead, and ask in the Builders Telegram.

Mint-time records in `@thenamespace/mint-manager@2.0.0` use a shorter `ChainName` with no `WorldChain` or `Unichain`; add those records after minting with an ENS resolver call, or use offchain names.

For RPCs, faucets and explorers for these chains, install the `sponsor-chains` skill: `npx skills add 0xvikram/backboard-skills --skill sponsor-chains`.
