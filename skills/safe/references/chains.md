# Safe on ETHGlobal Mumbai sponsor chains

Checked 2026-10-19. Sources:
- Contract registry used by Protocol Kit: https://github.com/safe-global/safe-deployments (v1.37.64, bundled in protocol-kit 8.0.8) and https://github.com/safe-global/safe-modules-deployments (v3.0.11, 4337 module).
- Transaction Service list: API Kit's network list (https://github.com/safe-global/safe-core-sdk/blob/main/packages/api-kit/src/utils/config.ts) and the docs list https://docs.safe.global/advanced/smart-account-supported-networks?service=Transaction+Service . We also called `GET https://api.safe.global/tx-service/<shortName>/api/v1/about/` for each (all returned 200).
- Safe{Wallet} UI chains: the Safe config service `https://safe-config.safe.global/api/v1/chains/`.
- On-chain: `eth_getCode` on each chain's public RPC for SafeL2 1.4.1, SafeProxyFactory 1.4.1, Safe4337Module 0.3.0 and SafeModuleSetup 0.3.0.

Chain IDs and RPCs: use the `sponsor-chains` skill (`npx skills add 0xvikram/backboard-skills --skill sponsor-chains`).

| Chain | ID | Protocol Kit (default 1.4.1) | Transaction Service / API Kit | Safe{Wallet} UI | 4337 module 0.3.0 |
| --- | --- | --- | --- | --- | --- |
| World Chain | 480 | yes (1.3.0, 1.4.1, 1.5.0) | yes, `wc` | yes | yes (registry) |
| World Chain Sepolia | 4801 | yes (1.4.1 only) | **no** | no | on-chain, pass `customContracts` |
| Unichain | 130 | yes (1.3.0, 1.4.1, 1.5.0) | yes, `unichain` | yes | yes (registry) |
| Unichain Sepolia | 1301 | yes (1.4.1 only) | **no** | no | on-chain, pass `customContracts` |
| Arc | 5042 | yes (1.3.0, 1.4.1, 1.5.0) | yes, `arc` | yes | on-chain, pass `customContracts` |
| Arc Testnet | 5042002 | yes (1.3.0, 1.4.1, 1.5.0) | yes, `arc-testnet` | yes | on-chain, pass `customContracts` |
| 0G mainnet | 16661 | yes (1.3.0, 1.4.1, 1.5.0) | yes, `0g` | yes | yes (registry) |
| 0G Galileo testnet | 16602 | **no** (`Invalid multiSend contract address`) | no | no | no |
| Hedera | 295 | only with `safeVersion: "1.3.0"` | no | no | no |
| Hedera testnet | 296 | only with `safeVersion: "1.3.0"` (1.4.1 code exists on-chain but is not in the registry) | no | no | on-chain only, untested |
| Whitechain Sepolia | 1874 | yes (1.3.0, 1.4.1, 1.5.0) | yes, `wch-sepolia` | yes | on-chain, pass `customContracts` |
| Whitechain (legacy L1) | 1875 | **no** (no Safe contracts on-chain) | no | no | no |

"Protocol Kit yes" was tested by predicting a Safe address with `Safe.init({ predictedSafe })` on each chain's public RPC. Recipe 1 printed the same 2-of-3 address on Sepolia, World Chain Sepolia, Unichain Sepolia, Arc Testnet and Whitechain Sepolia.

## What to use where

- **Full multisig flow with the Transaction Service and the Safe UI** (recipes 2, 6, 7): World Chain, Unichain, Arc, Arc Testnet, 0G mainnet, Whitechain Sepolia. For a testnet demo with the UI, use **Arc Testnet** or **Whitechain Sepolia** (or Sepolia).
- **Contracts only** (recipes 1, 3, 4): World Chain Sepolia and Unichain Sepolia. Collect signatures yourself (recipe 3); there is no app.safe.global UI for them.
- **ERC-4337** (recipe 5): needs a bundler on the chain. Pimlico lists World Chain, Unichain and Arc (mainnet + testnet): https://docs.pimlico.io/guides/supported-chains . Tested keyless gas estimation + signing with `safeModulesVersion: "0.3.0"` on World Chain Sepolia, Unichain Sepolia and Arc Testnet (with `customContracts`). No bundler checked for 0G, Hedera or Whitechain.
- **Hedera**: Safe 1.3.0 contracts only, no Transaction Service, no UI. Pass `safeDeploymentConfig: { safeVersion: "1.3.0" }` (prediction tested on 295 and 296; deployment not tested). 1.3.0 cannot be used with Safe4337Pack (needs 1.4.1+). Hedera JSON-RPC has its own rules for gas and accounts: check https://docs.hedera.com before deploying.
- **0G**: mainnet only. Galileo testnet (16602) has no registered Safe contracts.
- **Whitechain**: use Whitechain Sepolia (1874). The legacy L1 (1875) has no Safe contracts; the Whitechain L2 mainnet is not live.

## Addresses (canonical, same on all chains above that have them)

From safe-deployments / safe-modules-deployments; confirmed on-chain on the testnets.

| Contract | Address |
| --- | --- |
| SafeL2 1.4.1 | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` |
| SafeProxyFactory 1.4.1 | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |
| MultiSendCallOnly 1.4.1 | `0x9641d764fc13c8B624c04430C7356C1C7C8102e2` |
| GnosisSafeL2 1.3.0 (canonical) | `0x3E5c63644E683549055b9Be8653de26E0B4CD36E` |
| Safe4337Module 0.3.0 | `0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226` |
| SafeModuleSetup 0.3.0 | `0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47` |
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |

Lists change often (API Kit and Protocol Kit add chains in patch releases). Before the event, re-check with `npm view @safe-global/protocol-kit version` and the links above.
