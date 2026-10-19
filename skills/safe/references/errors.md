# Safe errors and gotchas

Messages marked "seen" were reproduced on 2026-10-19 with protocol-kit 8.0.8, api-kit 5.0.4, relay-kit 6.1.2, viem 2.57.7.

## 1. `apiKey is mandatory when txServiceUrl is not defined` (seen)

`new SafeApiKit({ chainId })` without `apiKey`. Since API Kit 4 the default `api.safe.global` service needs a key (also when you pass a `txServiceUrl` on `api.safe.global` or `api.5afe.dev`).
Fix: create a key at https://developer.safe.global (API Keys) and pass `apiKey: process.env.SAFE_API_KEY`. A self-hosted service with `txServiceUrl` needs no key.
Source: https://docs.safe.global/core-api/how-to-use-api-keys , https://github.com/safe-global/safe-core-sdk/blob/main/packages/api-kit/src/SafeApiKit.ts

## 2. `Network with chainId 4801 not found` (seen)

API Kit has no Transaction Service URL for that chain. Seen for World Chain Sepolia (4801); the same applies to Unichain Sepolia (1301), Hedera (295/296), 0G Galileo (16602).
Fix: sign locally and execute with Protocol Kit only (recipes.md #3), or run your own Transaction Service and pass `txServiceUrl`. Supported list: https://docs.safe.global/advanced/smart-account-supported-networks?service=Transaction+Service

## 3. `Invalid multiSend contract address` on `Safe.init` (seen)

Protocol Kit has no registered Safe contracts for that chain and Safe version. Seen on 0G Galileo testnet (16602), old Whitechain L1 (1875), Hedera with the default 1.4.1, and World Chain Sepolia / Unichain Sepolia with `safeVersion: "1.3.0"`.
Fix: use a version that is deployed there (Hedera: `safeDeploymentConfig: { safeVersion: "1.3.0" }`), switch chain, or pass your own addresses with `contractNetworks` (https://docs.safe.global/reference-sdk-protocol-kit/initialization/init). Check deployments: https://github.com/safe-global/safe-deployments

## 4. `Safe4337Module and/or SafeModuleSetup not available for chain 480 and modules version 0.2.0` (seen)

`Safe4337Pack.init` defaults to module 0.2.0 (EntryPoint v0.6). It is not deployed on the sponsor chains.
Fix: `safeModulesVersion: "0.3.0"`. If you then see the same error with `0.3.0` (seen on 4801, 1301, 5042002), the module is on-chain but not in the registry: pass `customContracts: { safe4337ModuleAddress: "0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226", safeModulesSetupAddress: "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47" }`. Check with `eth_getCode` first.
Source: https://docs.safe.global/sdk/relay-kit/guides/4337-safe-sdk , https://github.com/safe-global/safe-modules-deployments

## 5. `The method "pm_getPaymasterStubData" does not exist / is not available` (seen)

Sponsored `Safe4337Pack` pointed at a bundler URL without paymaster access (we used Pimlico's keyless public endpoint).
Fix: use a real paymaster URL with an API key, e.g. `https://api.pimlico.io/v2/<chainId>/rpc?apikey=<YOUR_API_KEY>`, and add `sponsorshipPolicyId` if your key needs a policy. Pimlico: https://docs.pimlico.io/guides/create-api-key

## 6. `SafeProxy contract is not deployed on the current network` (seen)

`Safe.init({ safeAddress })` with an address that has no Safe on this RPC's chain (wrong chain, typo, or not deployed yet).
Fix: check the RPC chain; for an undeployed Safe use `predictedSafe` instead of `safeAddress` (quickstart.md).

## 7. Doc snippets that fail type-check with the current SDK (seen)

- `import { SigningMethod } from '@safe-global/protocol-kit'` -> `TS2614 has no exported member 'SigningMethod'`. Moved in v6: `import { SigningMethod } from '@safe-global/types-kit'` (https://docs.safe.global/sdk/protocol-kit/guides/migrate-to-v6). Some reference pages still show the old import.
- Deploy guide: `client.waitForTransactionReceipt(...)` on `getExternalSigner()` -> `Property 'waitForTransactionReceipt' does not exist on type 'ExternalSigner'`. Use a viem `createPublicClient(...).waitForTransactionReceipt`. Also `to: deploymentTransaction.to` needs `as \`0x${string}\``.
- `new SafeApiKit({ chainId: 1, ... })` -> `Type 'number' is not assignable to type 'bigint'`. Use `1n` (or `BigInt(chain.id)`).
- Sponsored `paymasterOptions` with `paymasterAddress` / `paymasterTokenAddress` -> `TS2353 ... 'paymasterAddress' does not exist`. Sponsored mode takes only `isSponsored`, `paymasterUrl`, `sponsorshipPolicyId`, `paymasterContext`.
- The propose guide calls `service.getTransaction(...)` (the client is named `apiKit`) and declares `const safeTxHash` in two steps, so pasting both into one file fails.
Reason: protocol-kit 8 / api-kit 5 / relay-kit 6 removed the loose `string` address typing and made `chainId` a bigint (https://github.com/safe-global/safe-core-sdk/blob/main/packages/protocol-kit/CHANGELOG.md). The skill follows the SDK.

## 8. `TransactionExecutionError: The total cost (gas * gas fee + value) ... exceeds the balance` (seen)

The deploying account (or the executing owner) has no gas on that chain. A Safe tx is paid by whoever calls `executeTransaction`, not by the Safe (unless you use 4337 or a refund).
Fix: fund the signer with testnet gas. For the Safe's own balance, send funds to the Safe address. With 4337 (recipe 5) the Safe or a paymaster pays.

## 9. Safe App never connects / `sdk.safe.getInfo()` hangs

- Opened in a normal tab: the Safe Apps SDK only answers inside the Safe{Wallet} iframe. Add a timeout and a normal wallet fallback.
- `allowedDomains` does not match: the regex is tested against the full origin (`https://app.safe.global`). The wagmi example `/^app\.safe\.global$/` never matches; use `/^https:\/\/app\.safe\.global$/`. Source: `isValidMessage` in https://github.com/safe-global/safe-apps-sdk/blob/main/packages/safe-apps-sdk/src/communication/index.ts
- App will not add: Safe{Wallet} fetches `/manifest.json` cross-origin, so serve it with `Access-Control-Allow-Origin: *` (https://github.com/safe-global/safe-apps-sdk/blob/main/guides/drain-safe-app/01-bootstrap-the-app.md).

## 10. `401`, `429`, `Not Found` from the Transaction Service

- `401 Unauthorized`: bad or expired API key. `429 Too Many Requests` / `Monthly quota exceeded.`: rate limit (per account, not per key). Source: https://docs.safe.global/core-api/api-authentication
- `Not Found` (seen with `getSafeInfo` on an unknown address): the Safe is not indexed on that chain yet, or it is the wrong chain. New Safes take a short time to appear.

## Also

- `[@gelatonetwork/relay-sdk] This package is deprecated` is printed when you import `@safe-global/relay-kit`. It comes from the deprecated `GelatoRelayPack` dependency (relay-kit 6.1.0) and is harmless for `Safe4337Pack`.
- The SDK packages declare `engines: { node: ">=20" }`; use Node 20 or newer.
