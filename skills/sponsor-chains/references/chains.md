# Sponsor chains: connect and deploy reference (ETHGlobal Mumbai, 5-7 Nov 2026)

Checked 19 Oct 2026 against the official docs linked below. Testnets change: confirm the chain ID and RPC from the linked page before deploying.

viem exports were checked in viem **2.57.7** (latest on npm, 19 Oct 2026) by installing it and reading `node_modules/viem/_esm/chains`. Import any of them with `import { <name> } from 'viem/chains'`.

Shared snippets (replace the values with the ones in each chain's table):

```ts
// viem: chain not exported, or you want a different RPC
import { defineChain, createPublicClient, http } from 'viem'
const myChain = defineChain({
  id: 1301, name: 'Unichain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia.unichain.org'] } },
  blockExplorers: { default: { name: 'Uniscan', url: 'https://sepolia.uniscan.xyz' } },
  testnet: true,
})
const client = createPublicClient({ chain: myChain, transport: http() })

// ethers v6
import { JsonRpcProvider, Wallet } from 'ethers'
const provider = new JsonRpcProvider('https://sepolia.unichain.org', 1301)
const wallet = new Wallet(process.env.PRIVATE_KEY!, provider)
```

```ts
// hardhat.config.ts (Hardhat 3 needs type: "http"; drop that line on Hardhat 2)
networks: {
  target: { type: "http", url: "<RPC>", chainId: <ID>, accounts: [process.env.PRIVATE_KEY!] },
}
```

```toml
# foundry.toml
[rpc_endpoints]
target = "<RPC>"
# forge create src/X.sol:X --rpc-url target --private-key $PRIVATE_KEY --broadcast
```

---

## 1. World Chain

OP Stack L2 in the Superchain, "a blockchain for humans" (World ID, free gas allowance planned for verified humans, World App Mini Apps).

| | Mainnet | Testnet (World Chain Sepolia) |
|---|---|---|
| Chain ID | 480 (`0x1e0`) | 4801 (`0x12c1`) |
| Public RPC | `https://worldchain-mainnet.g.alchemy.com/public` | `https://worldchain-sepolia.g.alchemy.com/public` |
| Explorer | `https://worldscan.org` | `https://worldchain-sepolia.explorer.alchemy.com` (viem also lists `https://sepolia.worldscan.org`) |
| Gas token | ETH (Not confirmed on the World docs page, which does not name it; viem's definition says ETH) | same |
| Block time / gas limit | 2 s / 80M | 2 s / 30M |
| viem export | `worldchain` | `worldchainSepolia` |
| Bridge | Alchemy bridge (native OP Stack bridge) | `https://worldchain-sepolia.bridge.alchemy.com` |

**Faucets:** official docs list only Alchemy: `https://www.alchemy.com/faucets/world-chain-sepolia` (Alchemy's page requires about 0.001 ETH on Ethereum mainnet plus some mainnet activity; that rule comes from Alchemy, not from World). Other route: bridge Sepolia ETH over the bridge above.

**Foundry:** the official guide uses `forge create ... --rpc-url https://worldchain-sepolia.g.alchemy.com/public` and `--verify --etherscan-api-key <key>` (Worldscan or Blockscout). The docs give no verifier URL.

**Gotchas**
- The public RPC is Alchemy's shared endpoint, and the docs publish no rate limit for it. For a demo, get a free Alchemy key.
- Priority Blockspace for Humans and the gas stipend for verified humans are described as "being worked on" or "coming soon". Do not plan a demo around free gas unless World's team confirms it at the event.
- World ID and MiniKit transactions (`sendTransaction` in Mini Apps) are a separate integration from deploying a contract. See the Mini Apps docs.
- Withdrawals to L1 take about 7 days (OP Stack), so don't put an L2-to-L1 withdrawal in a demo.

Sources: https://docs.world.org/world-chain/quick-start/info · https://docs.world.org/world-chain/quick-start/features · https://docs.world.org/world-chain/developers/deploy · https://docs.world.org/world-chain/quick-start/fund-wallet

---

## 2. Unichain

Uniswap's OP Stack L2 (Superchain), built for DeFi.

| | Mainnet | Testnet (Unichain Sepolia) |
|---|---|---|
| Chain ID | 130 (`0x82`) | 1301 (`0x515`) |
| Public RPC | `https://mainnet.unichain.org` | `https://sepolia.unichain.org` |
| Explorer | `https://uniscan.xyz` | `https://sepolia.uniscan.xyz` |
| Gas token | ETH | ETH |
| viem export | `unichain` | `unichainSepolia` |

**Faucets (official list, in order):**
1. Superchain Faucet: `https://app.optimism.io/faucet` (0.05 test ETH on one network every 24 h; more if you verify an onchain identity)
2. Circle: `https://faucet.circle.com/` (test **USDC**, not ETH; one claim per network per hour)
3. QuickNode: `https://faucet.quicknode.com/unichain/sepolia` (one claim per 12 h)
4. thirdweb: `https://thirdweb.com/unichain-sepolia-testnet` (one claim per 24 h)

Other route: send Sepolia ETH to the canonical bridge (see "Get funds on Unichain").

**Gotchas**
- "Both public RPC URLs are rate limited and not intended for production." The docs give no numbers. Use a provider key for anything that polls.
- The docs publish no WebSocket endpoint. Not confirmed.
- For Uniswap v4 hooks or pool contracts, check the Uniswap contract-address pages for Unichain Sepolia. They are not covered here.
- `docs.unichain.org` now redirects to `developers.uniswap.org/docs/unichain`.

Sources: https://developers.uniswap.org/docs/unichain (and `/technical-information/network-information`, `/tools/faucets`, `/getting-started/get-funds-on-unichain`)

---

## 3. Hedera

A public proof-of-stake network (hashgraph, aBFT). It has a native API and SDKs (HAPI: accounts `0.0.x`, HTS tokens, HCS topics) and an EVM that you reach through the JSON-RPC Relay. Hashio is the public relay.

### EVM / JSON-RPC side

| | Mainnet | Testnet | Previewnet |
|---|---|---|---|
| Chain ID | 295 (`0x127`) | 296 (`0x128`) | 297 (`0x129`) |
| Hashio RPC | `https://mainnet.hashio.io/api` | `https://testnet.hashio.io/api` | `https://previewnet.hashio.io/api` |
| Alt RPC (listed in the docs) | `https://295.rpc.thirdweb.com` | `https://296.rpc.thirdweb.com` | `https://297.rpc.thirdweb.com` |
| Explorer | `https://hashscan.io/mainnet` | `https://hashscan.io/testnet` | `https://hashscan.io/previewnet` (Not confirmed; follows HashScan's URL pattern) |
| Gas token | HBAR | HBAR | HBAR |
| viem export | `hedera` | `hederaTestnet` | `hederaPreviewnet` |

Local: Solo runs a full local network with a relay at `http://localhost:37546` (chain 298).

**Faucet:** `https://portal.hedera.com/faucet`. Paste any EVM address, with no login needed, and receive **100 testnet HBAR**. The docs state no cooldown (Not confirmed). The Hedera Portal (`https://portal.hedera.com`) also creates a funded testnet account (1000 HBAR) with an ECDSA key. The Faucet API (needs a Portal personal access token) is for scripts and CI.

### Native SDK side
- JS SDK: `npm i @hiero-ledger/sdk` (the docs show `^2.87.0`). Java: `com.hedera.hashgraph:sdk`. Go: `github.com/hiero-ledger/hiero-sdk-go/v2`. Python: `hiero_sdk_python`.
- Env vars used in the docs: `OPERATOR_ID=0.0.xxxx` and `OPERATOR_KEY=<DER-encoded ECDSA private key, starts with 303...>`.
- Mirror node REST API covers history, logs and account lookups. Hedera does not use Ethereum's `stateRoot`; the docs say to query mirror nodes instead.

### Gotchas (these cause most Hedera bugs)
- **Decimals: 8 vs 18.** HBAR has 8 decimals natively (1 HBAR = 10^8 tinybar). Through the JSON-RPC relay, `msg.value`, balances and `gasPrice` use 18 decimals (weibar). 1 tinybar = 10^10 weibar. Fees are always computed in tinybar. Inside Solidity, convert with `wei / 1e10`; anything below 10^10 wei truncates to 0 tinybar. HTS tokens have at most 8 decimals.
- **Two address forms.** Account ID `0.0.1234` versus EVM address. The "long-zero" address (12 zero bytes followed by the account number) **does not work with `ecrecover`**. Only an ECDSA account created with an alias (`setECDSAKeyWithAlias()`) has an "EVM Address from Public Key" that behaves like a normal EVM account. In Hardhat or MetaMask, use the EVM address, not `0.0.x`. You cannot add an alias to an existing account.
- **ED25519 vs ECDSA.** Hedera's native ED25519 keys cannot sign EVM transactions or pass `ecrecover`; use the system contract `0x167` (`isAuthorized` / `isAuthorizedRaw`, HIP-632) instead. **Use ECDSA (secp256k1) keys for any EVM tooling.**
- **Hollow accounts.** The faucet, or sending HBAR to a new EVM address, auto-creates a hollow account (an account ID with an alias but no key). It can receive funds but **cannot send or change properties** until it pays a fee as the payer, signed by the matching ECDSA key. After that it is a normal account.
- **HTS token association.** An account must associate a token before it can receive it, unless `maxAutoAssociations` allows it. That value defaults to -1 (unlimited) for auto-created and completed hollow accounts, and 0 means manual association. The sender pays the auto-association fee.
- **Key rotation keeps the address.** You can rotate keys without changing the account, so never assume a fixed mapping from key to address. If you rotate the key, the alias no longer matches it.
- Sending HBAR straight to a contract's account (not through `contractCall`) does **not** trigger `receive`/`fallback`.
- **Hashio** is "for development and testing purposes only". The docs give no numeric rate limit, but they warn that deploying several large contracts can hit rate limits. If deploys fail, slow down or switch to thirdweb, QuickNode or Validation Cloud.
- Some JSON-RPC methods return fixed values: uncle methods return null or `0x0`, and `stateRoot` is empty or zero. `debug_*` methods are off on public relays. `eth_subscribe` (WebSocket) and filters are supported.
- The docs give no gas-refund rule or Foundry-specific flags (for example `--legacy`). Not confirmed.

Sources: https://docs.hedera.com/hedera/core-concepts/smart-contracts/json-rpc-relay · https://docs.hedera.com/evm/development/json-rpc · https://docs.hedera.com/evm/quickstart/get-test-hbar · https://docs.hedera.com/hedera/core-concepts/smart-contracts/understanding-hederas-evm-differences-and-compatibility/for-evm-developers-migrating-to-hedera (and its decimal-handling, accounts-and-keys and json-rpc-differences sub-pages) · https://docs.hedera.com/hedera/core-concepts/accounts/account-properties · https://docs.hedera.com/hedera/getting-started-hedera-native-developers/create-an-account · https://docs.hedera.com/native/tokens/associate

---

## 4. Arc (Circle)

Circle's EVM L1 for stablecoin finance. USDC is the native gas token and finality takes under a second. The docs say Arc is live on both Testnet and Mainnet.

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | 5042 (`0x13b2`) | 5042002 (`0x4cef52`) |
| Primary RPC | `https://rpc.mainnet.arc.io` | `https://rpc.testnet.arc.io` |
| Other RPCs | `rpc.blockdaemon.mainnet.arc.io`, `rpc.drpc.mainnet.arc.io`, `rpc.quicknode.mainnet.arc.io`, Alchemy `arc-mainnet.g.alchemy.com/v2/<KEY>` | `rpc.blockdaemon.testnet.arc.io`, `rpc.drpc.testnet.arc.io`, `rpc.quicknode.testnet.arc.io` |
| WebSocket | Alchemy, `wss://rpc.blockdaemon.mainnet.arc.io/websocket`, `wss://rpc.quicknode.mainnet.arc.io` | `wss://rpc.testnet.arc.io` (plus Blockdaemon, dRPC and QuickNode) |
| Explorer | `https://explorer.arc.io` | `https://explorer.testnet.arc.io` |
| Gas token | USDC (18 decimals natively) | USDC (18 decimals natively) |
| viem export | `arc` | `arcTestnet` |

**Faucet:** `https://faucet.circle.com` (choose Arc Testnet). The docs state no amount. Not confirmed.

**Key addresses** (from Contract Addresses)
- USDC ERC-20 interface (6 decimals): `0x3600000000000000000000000000000000000000`, the same on both networks
- EURC testnet: `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`; mainnet: `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1`
- CCTP domain **26**. Testnet TokenMessengerV2 `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`, MessageTransmitterV2 `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275`
- Gateway testnet: GatewayWallet `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`, GatewayMinter `0x0022222ABE238Cc2C7Bb1f21003F0a260052475B`
- Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`; Multicall3 `0xcA11bde05977b3631167028862bE2a173976CA11`

**Foundry:** the docs use **Arc Foundry**, Circle's fork of Foundry with `arc-forge`, `arc-cast` and `arc-anvil` binaries from `github.com/circlefin/arc-foundry/releases`. It ships prebuilt binaries for macOS Apple Silicon and Linux; Intel Macs must build from source.
```sh
arc-forge create src/Counter.sol:Counter --rpc-url https://rpc.testnet.arc.io --private-key $PRIVATE_KEY --broadcast
arc-forge verify-contract $ADDR src/Counter.sol:Counter --chain-id 5042002 --verifier blockscout --verifier-url https://explorer.testnet.arc.io/api/
```
The docs do not say whether stock `forge` and Hardhat work. Not confirmed. They target the Osaka EVM baseline, so most contracts deploy unchanged.

**Gotchas**
- **One USDC balance has two decimal scales.** The native balance (`msg.value`, `eth_getBalance`) uses 18 decimals, and the ERC-20 at `0x3600…` uses 6. Divide by 10^12 to display. Never credit balances from the 6-decimal value: `balanceOf` truncates sub-cent amounts and can show 0.
- **A transaction with `maxFeePerGas` below 20 gwei is silently dropped**, with no error and no receipt. Set the fee floor explicitly.
- `PREVRANDAO` always returns 0, so there is no onchain randomness; use an oracle or VRF.
- Blob (type-3) transactions are rejected, and the EIP-4788 beacon-roots contract is absent.
- Sending value to `address(0)` reverts. Transfers involving a blocklisted address revert and still use gas.
- All native USDC moves emit a `Transfer` log from the system emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE`. Index that address, not just the ERC-20.
- Wallets without custom-gas-token support may label the balance "ETH". It is still USDC.
- The base fee goes to the block producer, not burned. Timestamps have 1-second granularity, so order events by block number.
- `SELFDESTRUCT` reverts in edge cases: beneficiary is the contract itself, is `0x0`, is blocklisted, or has already self-destructed.

Sources: https://docs.arc.io/arc/references/connect-to-arc · https://docs.arc.io/arc/references/evm-compatibility (canonical: `/arc/references/evm-differences`) · https://docs.arc.io/arc/references/contract-addresses · https://docs.arc.io/arc/tutorials/deploy-on-arc · https://docs.arc.io/arc/tutorials/install-arc-foundry (`docs.arc.network` redirects to `docs.arc.io`)

---

## 5. 0G (0G Chain, Storage, Compute)

An EVM L1 for decentralised AI. On top of the chain run 0G Storage (file and KV storage with an indexer) and the 0G Compute network (paid inference with OpenAI-compatible endpoints). There is also 0G DA.

| | Mainnet | Testnet (Galileo) |
|---|---|---|
| Chain ID | 16661 (`0x4115`) | **16602** (`0x40da`) |
| Public RPC | `https://evmrpc.0g.ai` | `https://evmrpc-testnet.0g.ai` |
| Explorer | `https://chainscan.0g.ai` (also `https://explorer.0g.ai/mainnet/home`) | `https://chainscan-galileo.0g.ai` |
| Storage explorer | Not confirmed | `https://storagescan-galileo.0g.ai` |
| Storage indexer (turbo) | `https://indexer-storage-turbo.0g.ai` | `https://indexer-storage-testnet-turbo.0g.ai` |
| Gas token | 0G | 0G |
| viem export | `zeroGMainnet` | **`zeroGTestnet`** (id 16602) |

**viem trap:** `zeroGGalileoTestnet` (id 16601, symbol A0GI) is deprecated, and so is `zeroG` (16600, the old Newton testnet). Both point at the same RPC but carry the wrong chain ID, so signed transactions get rejected. Use `zeroGTestnet`.

**Faucets:** official `https://faucet.0g.ai`, and Google Cloud `https://cloud.google.com/application/web3/faucet/0g/galileo`. Limit: **0.1 0G per wallet per day**. You can ask for more in the 0G Discord.

**Hardhat / Foundry (from the docs):** compile for **Cancun**.
```ts
solidity: { version: "0.8.19", settings: { evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } } },
networks: { zgTestnet: { type: "http", url: "https://evmrpc-testnet.0g.ai", chainId: 16602, accounts: [process.env.PRIVATE_KEY!] } },
etherscan: { apiKey: { zgTestnet: "placeholder" }, customChains: [{ network: "zgTestnet", chainId: 16602,
  urls: { apiURL: "https://chainscan-galileo.0g.ai/open/api", browserURL: "https://chainscan-galileo.0g.ai" } }] },
```
```toml
[profile.default]
evm_version = "cancun"
[rpc_endpoints]
testnet = "https://evmrpc-testnet.0g.ai"
mainnet = "https://evmrpc.0g.ai"
# verify: forge verify-contract <addr> <path:Name> --chain-id 16602 --verifier custom --verifier-url https://chainscan-galileo.0g.ai/open/api
```
For mainnet verification, use `https://chainscan.0g.ai/open/api`.

**Storage SDK:** `npm i @0gfoundation/0g-storage-ts-sdk ethers`. Use `Indexer(INDEXER).upload(file, RPC, signer)` and `indexer.download(rootHash, path, true)`.
**Compute SDK/CLI:** `pnpm add -g @0gfoundation/0g-compute-ts-sdk` installs the `0g-compute-cli` command (needs Node 20 or later). Pick a network with `0g-compute-cli setup-network`. Get a bearer token with `inference get-secret --provider <addr>`, then point an OpenAI client at `${service.url}/v1/proxy`.

**Testnet storage contracts** ("may change during testnet"): Flow `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296`, Mine `0x00A9E9604b0538e06b268Fb297Df333337f9593b`, Reward `0xA97B57b4BdFEA2D0a25e535bd849ad4e6C440A69`, DAEntrance `0xE75A073dA5bb7b0eC622170Fd268f35E675a957B`

**Gotchas**
- If you get "invalid opcode" errors, the docs suggest dropping to an older solc (for example 0.8.26 to 0.8.19) and keeping `evmVersion: cancun`.
- **Compute is expensive against the faucet:** creating a ledger needs at least **3 0G**, and each provider sub-account needs at least 1 0G locked. The faucet gives 0.1 0G per day, so ask 0G's team or Discord for tokens early.
- The public RPCs are "for development purposes" only. The docs recommend QuickNode, thirdweb, Ankr or dRPC for production.
- Storage SDK: call `file.merkleTree()` before `upload`, then `file.close()`. `indexer.download()` uses `fs` and **does not work in browsers** (use `StorageNode.downloadSegmentByTxSeq()`), and the SDK needs Node polyfills when bundled. Files over 4 GB return arrays (`rootHashes`). With encryption, a wrong key does not throw: `downloadToBlob` returns the raw ciphertext.

Sources: https://docs.0g.ai/developer-hub/testnet/testnet-overview · https://docs.0g.ai/developer-hub/mainnet/mainnet-overview · https://docs.0g.ai/developer-hub/building-on-0g/contracts-on-0g/deploy-contracts · https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk · https://docs.0g.ai/developer-hub/building-on-0g/compute-network/inference

---

## 6. Whitechain

WhiteBIT's chain, now being rebuilt as an EVM-compatible OP Stack L2 that settles on Ethereum. WBT is the gas token. **The L2 Mainnet is not live yet.** The old L1 mainnet is still running and will be migrated.

| | L2 Mainnet | L2 Testnet (Whitechain Sepolia) | Legacy L1 mainnet |
|---|---|---|---|
| Chain ID | "TBD, published before Mainnet launch" | **1874** (`0x752`) | 1875 (`0x753`) |
| Public RPC | Not yet available | `https://rpc.testnet.whitechain.io`; WebSocket `wss://rpc.testnet.whitechain.io/ws` | `https://rpc.whitechain.io` (moves to a `legacy` hostname at cut-over) |
| Explorer | Not yet available | `https://explorer.testnet.whitechain.io` (Blockscout) | `https://explorer.whitechain.io` (same cut-over caveat) |
| Gas token | WBT | WBT (18 decimals) | WBT |
| L1 / settlement | Ethereum | Ethereum Sepolia (11155111) | n/a |
| viem export | none yet | **`whitechainSepolia`** | `whitechain` |

**viem trap:** `whitechainTestnet` (id 2625, `rpc-testnet.whitechain.io`) is not in the current official docs. It looks like the old L1 testnet. Use `whitechainSepolia`.

**Faucet:** `https://faucet.testnet.whitechain.io`. It gives 0.5 WBT per 24 h (rolling window) and requires a **GitHub account at least 30 days old** (OAuth). It checks wallet, IP and GitHub account separately, so **many hackers on the venue Wi-Fi share one IP and may hit the IP limit.** Claim from a phone hotspot or claim before the event.

**Hardhat (official template):**
```ts
networks: { whitechainSepolia: { type: "http", url: "https://rpc.testnet.whitechain.io", accounts: [process.env.PRIVATE_KEY!], chainId: 1874 } },
verify: { sourcify: { enabled: true } },
```
Foundry: the docs link a template at `github.com/whitechain-labs/templates/tree/main/Foundry`. The docs show no Foundry config. Not confirmed.

**Gotchas**
- **Public RPC limit: 50 requests/s sustained per IP, with a burst of up to 500. Over that you get `429` with `Retry-After: 1`.** A JSON-RPC batch counts as one request. There is a single provider and no third-party RPC yet, so a shared venue IP can be throttled. Batch calls and back off on 429.
- Block time is 1 s. EIP-1559 fees with a **5 gwei base-fee floor**, plus an L1 data fee (OP Stack). Flashblocks and preconfirmations are off.
- Withdrawals to Sepolia take about 1 to 3 h.
- At L2 launch, `rpc.whitechain.io` and `explorer.whitechain.io` will switch from L1 to L2. **Check `eth_chainId`, not the hostname.** The migration date is not announced.
- The testnet comes with no uptime guarantee ("AS IS").

Sources: https://docs.whitechain.io/ · https://docs.whitechain.io/learn/network/reference · https://docs.whitechain.io/learn/network/testnet · https://docs.whitechain.io/learn/get-started/connect-wallet · https://docs.whitechain.io/learn/get-started/get-testnet-wbt · https://docs.whitechain.io/learn/general/migration · https://docs.whitechain.io/build/deploy/deploy-with-hardhat

---

## Quick lookup (testnets)

| Chain | Chain ID | RPC | viem | Gas | Faucet |
|---|---|---|---|---|---|
| World Chain Sepolia | 4801 / 0x12c1 | worldchain-sepolia.g.alchemy.com/public | `worldchainSepolia` | ETH | alchemy.com/faucets/world-chain-sepolia |
| Unichain Sepolia | 1301 / 0x515 | sepolia.unichain.org | `unichainSepolia` | ETH | app.optimism.io/faucet |
| Hedera Testnet | 296 / 0x128 | testnet.hashio.io/api | `hederaTestnet` | HBAR (8 native / 18 in RPC) | portal.hedera.com/faucet |
| Arc Testnet | 5042002 / 0x4cef52 | rpc.testnet.arc.io | `arcTestnet` | USDC (18 native / 6 ERC-20) | faucet.circle.com |
| 0G Galileo | 16602 / 0x40da | evmrpc-testnet.0g.ai | `zeroGTestnet` | 0G | faucet.0g.ai |
| Whitechain Sepolia | 1874 / 0x752 | rpc.testnet.whitechain.io | `whitechainSepolia` | WBT | faucet.testnet.whitechain.io |
