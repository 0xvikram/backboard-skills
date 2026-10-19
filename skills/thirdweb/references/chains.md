# thirdweb on ETHGlobal Mumbai sponsor chains

Checked 2026-10-19. Where the data comes from:
- Chain metadata: `https://api.thirdweb.com/v1/chains/<id>`. Chain pages: `https://thirdweb.com/<id>`.
- thirdweb services per chain: `https://api.thirdweb.com/v1/chains/<id>/services`. `connect-sdk` means wallets/SDK,
  `account-abstraction` means the ERC-4337 bundler + paymaster, `rpc-edge` means `https://<id>.rpc.thirdweb.com`, and `pay` means Payments/Bridge.
  This flag list is the source for the AA column. It does **not** say whether a chain supports EIP-7702 sponsorship. For that, check the docs or test on the testnet.
- "RPC read OK" means I called `eth_blockNumber` / `readContract` through thirdweb@5.122.0 with
  `defineChain({ id, rpc })` against the public RPC listed below.

| Chain | ID | Native | Public RPC (from thirdweb chain data) | thirdweb SDK + RPC edge | 4337 AA (sponsored gas) | RPC read OK |
|---|---|---|---|---|---|---|
| World Chain | 480 | ETH | https://worldchain-mainnet.g.alchemy.com/public | yes | enabled | yes (USDC `0x79A0...24d1`) |
| World Chain Sepolia | 4801 | ETH | https://worldchain-sepolia.g.alchemy.com/public | yes | enabled | chainId checked |
| Unichain | 130 | ETH | https://mainnet.unichain.org | yes | **disabled** | yes (USDC `0x078D...7AD6`) |
| Unichain Sepolia | 1301 | ETH | https://sepolia.unichain.org | yes | **disabled** | chainId checked |
| Arc Testnet | 5042002 | USDC | https://rpc.testnet.arc.io (thirdweb's chain data still lists the old `rpc.testnet.arc.network`, which did not resolve) | yes (built in: `arcTestnet` from `thirdweb/chains`) | enabled | yes (USDC `0x3600...0000`) |
| 0G Mainnet ("0G-Aristotle") | 16661 | 0G | https://evmrpc.0g.ai | yes | **disabled** | chainId checked |
| 0G Galileo Testnet | 16602 | 0G | https://evmrpc-testnet.0g.ai | yes | **disabled** | yes |
| Hedera Mainnet | 295 | HBAR | https://mainnet.hashio.io/api | yes | **disabled** | chainId checked |
| Hedera Testnet | 296 | HBAR | https://testnet.hashio.io/api | yes | **disabled** | yes |
| Whitechain | 1875 | WBT | https://rpc.whitechain.io | yes | **disabled** | chainId checked |
| Whitechain Sepolia (current testnet) | 1874 | WBT | https://rpc.testnet.whitechain.io | **not in thirdweb's chain list**: use `defineChain({ id: 1874, rpc: "https://rpc.testnet.whitechain.io" })` | n/a | chainId checked against the live RPC |
| Whitechain Testnet (old, 2625) | 2625 | WBT | https://rpc-testnet.whitechain.io | yes, but Whitechain's docs now point to Whitechain Sepolia (1874) | **disabled** | yes |

## Usage

```ts
import { defineChain } from "thirdweb";
import { arcTestnet } from "thirdweb/chains";

const worldChain = defineChain(480);  // thirdweb RPC edge, needs your client ID
const hederaTestnet = defineChain({ id: 296, rpc: "https://testnet.hashio.io/api" }); // own RPC
```

## Chain notes

- **World Chain:** the only sponsor mainnet here with thirdweb 4337 sponsorship listed as enabled. World ID / Mini App features are World's
  own SDKs, not thirdweb. Docs: https://docs.world.org
- **Arc (Circle):** testnet only. Gas is native USDC with **18 decimals**, while the USDC ERC-20 interface at
  `0x3600000000000000000000000000000000000000` uses 6 decimals. Faucet: https://faucet.circle.com. Explorer: https://testnet.arcscan.app.
  Arc docs moved to docs.arc.io and the RPC hosts moved with them. Use `defineChain({ id: 5042002, rpc: "https://rpc.testnet.arc.io" })`
  if you want Circle's RPC instead of thirdweb's edge.
  Sources: https://docs.arc.io/arc/references/rpc-endpoints, https://docs.arc.io/arc/references/contract-addresses
- **Unichain, 0G, Hedera, Whitechain:** wallets, reads, writes and deploys work through the SDK. thirdweb's 4337 sponsored gas is listed as
  disabled, so users (or your server) pay gas. EIP-7702 support on these chains is not confirmed here. Check the docs:
  https://portal.thirdweb.com/wallets/sponsor-gas
- **Hedera:** this is the JSON-RPC relay (EVM) path. Read the track rules at https://ethglobal.com/events/mumbai/prizes to see whether an EVM/JSON-RPC app fits.
  Native value handling differs from Ethereum (tinybars). Check https://docs.hedera.com before you send HBAR value.
- **0G:** the thirdweb chain data lists the mainnet RPC as `http://evmrpc.0g.ai/`. `https://evmrpc.0g.ai` answered with chainId 16661 in my test.

The service flags change over time. Check again before you build:
```bash
curl -s https://api.thirdweb.com/v1/chains/480/services
```
