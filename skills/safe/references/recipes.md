# Safe recipes

All code was type-checked on 2026-10-19 with @safe-global/protocol-kit@8.0.8, api-kit@5.0.4, relay-kit@6.1.2, types-kit@4.0.1, viem@2.57.7 (and safe-apps-sdk@9.1.0, safe-apps-provider@0.18.6, wagmi@3.7.7 for recipe 6). Setup and `.env`: [quickstart.md](quickstart.md). Run any file with `npx tsx <file>.ts`.

Shared rules:
- Addresses passed to viem must be typed `` `0x${string}` `` (protocol-kit 8 removed the loose `string` typing).
- `MetaTransactionData.value` is a **string** of wei (`"0"`, `"1"`), not a bigint.
- `chainId` for `SafeApiKit` is a **bigint** (`11155111n`).

## 1. Create a multisig and predict its address

Goal: a 2-of-3 Safe with the same address on several chains. Prediction needs no key, no gas and no deployment.
Docs: https://docs.safe.global/sdk/protocol-kit/guides/safe-deployment , https://docs.safe.global/sdk/protocol-kit/guides/multichain-safe-deployment

```ts
import Safe, { type PredictedSafeProps } from "@safe-global/protocol-kit"
import { arcTestnet, sepolia, unichainSepolia, whitechainSepolia, worldchainSepolia } from "viem/chains"

const predictedSafe: PredictedSafeProps = {
  safeAccountConfig: {
    owners: [
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
      "0x3333333333333333333333333333333333333333",
    ],
    threshold: 2,
  },
  safeDeploymentConfig: { saltNonce: "42", safeVersion: "1.4.1" },
}

for (const chain of [sepolia, worldchainSepolia, unichainSepolia, arcTestnet, whitechainSepolia]) {
  // No signer needed just to predict
  const kit = await Safe.init({ provider: chain.rpcUrls.default.http[0], predictedSafe })
  console.log(chain.name.padEnd(20), await kit.getAddress(), "deployed:", await kit.isSafeDeployed())
}
```

Notes:
- Tested live: printed the same address on Sepolia, World Chain Sepolia, Unichain Sepolia, Arc Testnet and Whitechain Sepolia.
- To deploy, pass a `signer` and follow quickstart step 5 (`createSafeDeploymentTransaction`, send it, then `connect({ safeAddress })`). Any account can pay for the deploy; it does not have to be an owner.
- Same address needs the same owners, threshold, `saltNonce`, Safe version and contract set. Hedera only has Safe 1.3.0, so its address differs (chains.md).
- Change owners later with `createAddOwnerTx`, `createRemoveOwnerTx`, `createChangeThresholdTx` (https://docs.safe.global/reference-sdk-protocol-kit/safe-info/createaddownertx). They return a Safe transaction that still needs the threshold of signatures.

## 2. Propose, confirm, execute with the Transaction Service

Goal: owner 1 proposes, owner 2 confirms (from anywhere, also from app.safe.global), then someone executes. Needs a deployed Safe with threshold 2 and a `SAFE_API_KEY`.
Docs: https://docs.safe.global/sdk/api-kit/guides/propose-and-confirm-transactions , https://docs.safe.global/sdk/protocol-kit/guides/execute-transactions

```ts
import "dotenv/config"
import SafeApiKit from "@safe-global/api-kit"
import Safe from "@safe-global/protocol-kit"
import { OperationType, type MetaTransactionData } from "@safe-global/types-kit"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"

const RPC_URL = process.env.RPC_URL ?? sepolia.rpcUrls.default.http[0]
const SAFE_ADDRESS = process.env.SAFE_ADDRESS!            // a deployed Safe, threshold 2
const OWNER_1_PRIVATE_KEY = process.env.OWNER_1_PRIVATE_KEY as `0x${string}`
const OWNER_2_PRIVATE_KEY = process.env.OWNER_2_PRIVATE_KEY as `0x${string}`
const owner1 = privateKeyToAccount(OWNER_1_PRIVATE_KEY)

const apiKit = new SafeApiKit({ chainId: BigInt(sepolia.id), apiKey: process.env.SAFE_API_KEY })

// Owner 1 creates, signs and proposes
const kit1 = await Safe.init({ provider: RPC_URL, signer: OWNER_1_PRIVATE_KEY, safeAddress: SAFE_ADDRESS })
const tx: MetaTransactionData = {
  to: owner1.address, // send 1 wei back to owner 1 (any address works)
  value: "1",
  data: "0x",
  operation: OperationType.Call,
}
const safeTransaction = await kit1.createTransaction({ transactions: [tx] })
const safeTxHash = await kit1.getTransactionHash(safeTransaction)
const sig1 = await kit1.signHash(safeTxHash)
await apiKit.proposeTransaction({
  safeAddress: SAFE_ADDRESS,
  safeTransactionData: safeTransaction.data,
  safeTxHash,
  senderAddress: owner1.address,
  senderSignature: sig1.data,
})
console.log("Proposed", safeTxHash, "(also visible in app.safe.global > Transactions > Queue)")

// Owner 2 (normally another machine / person) finds it and confirms
const pending = (await apiKit.getPendingTransactions(SAFE_ADDRESS)).results
console.log("Pending:", pending.map((t) => t.safeTxHash))
const kit2 = await Safe.init({ provider: RPC_URL, signer: OWNER_2_PRIVATE_KEY, safeAddress: SAFE_ADDRESS })
const sig2 = await kit2.signHash(safeTxHash)
await apiKit.confirmTransaction(safeTxHash, sig2.data)

// Anyone with gas executes once the threshold is met
const ready = await apiKit.getTransaction(safeTxHash)
console.log("Confirmations:", ready.confirmations?.length, "/", ready.confirmationsRequired)
const result = await kit1.executeTransaction(ready) // owner 1 pays gas
console.log("Executed:", result.hash)
```

`.env` for this recipe: `SAFE_API_KEY`, `SAFE_ADDRESS`, `OWNER_1_PRIVATE_KEY`, `OWNER_2_PRIVATE_KEY`, optional `RPC_URL`.

Notes:
- Only chains with a Transaction Service work here: Sepolia, World Chain (480), Unichain (130), Arc (5042), Arc Testnet (5042002), 0G (16661), Whitechain Sepolia (1874) among the hackathon chains. Otherwise `new SafeApiKit` throws `Network with chainId ... not found`. Use recipe 3 there.
- Proposed transactions show up in the Safe{Wallet} queue, so a human owner can confirm in the UI (good for "agent proposes, human approves" demos; see https://docs.safe.global/home/ai-agent-quickstarts/human-approval).
- Nonces: each new `createTransaction` uses the next on-chain nonce. To queue several, pass `options: { nonce }` (https://docs.safe.global/reference-sdk-protocol-kit/transactions/createtransaction), or read `await apiKit.getNextNonce(SAFE_ADDRESS)`.
- Not run end to end (needs a real API key and a funded 2-owner Safe). Type-checked only.

## 3. Sign and execute without the Transaction Service

Goal: a multisig flow on chains with Safe contracts but no Transaction Service (World Chain Sepolia, Unichain Sepolia, Hedera), or when you want your own backend to hold the pending transaction.
Docs: https://docs.safe.global/sdk/protocol-kit/guides/signatures/transactions

```ts
import "dotenv/config"
import Safe from "@safe-global/protocol-kit"
import { OperationType, SigningMethod } from "@safe-global/types-kit"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { worldchainSepolia } from "viem/chains"

const RPC_URL = process.env.RPC_URL ?? worldchainSepolia.rpcUrls.default.http[0]
// Throwaway keys if unset, so you can dry-run against a predicted (undeployed) Safe
const KEY_1 = (process.env.OWNER_1_PRIVATE_KEY ?? generatePrivateKey()) as `0x${string}`
const KEY_2 = (process.env.OWNER_2_PRIVATE_KEY ?? generatePrivateKey()) as `0x${string}`
const owners = [privateKeyToAccount(KEY_1).address, privateKeyToAccount(KEY_2).address]

const SAFE_ADDRESS = process.env.SAFE_ADDRESS // set this for a deployed 2-of-2 Safe
const config = SAFE_ADDRESS
  ? { safeAddress: SAFE_ADDRESS }
  : { predictedSafe: { safeAccountConfig: { owners, threshold: 2 } } }

let kit = await Safe.init({ provider: RPC_URL, signer: KEY_1, ...config })
let safeTx = await kit.createTransaction({
  transactions: [{ to: owners[0], value: "1", data: "0x", operation: OperationType.Call }], // 1 wei
})

safeTx = await kit.signTransaction(safeTx, SigningMethod.ETH_SIGN_TYPED_DATA_V4) // owner 1 signs
kit = await kit.connect({ signer: KEY_2 })                                         // switch signer
safeTx = await kit.signTransaction(safeTx, SigningMethod.ETH_SIGN_TYPED_DATA_V4) // owner 2 signs
console.log("Safe:", await kit.getAddress(), "signatures:", safeTx.signatures.size)

// To pass the tx between people instead: share safeTx.data + each safeTx.encodedSignatures(),
// or each owner calls kit.signHash(await kit.getTransactionHash(safeTx)) and you add them with safeTx.addSignature(sig).
if (process.env.EXECUTE === "1") {
  const res = await kit.executeTransaction(safeTx) // owner 2 pays gas; Safe must be deployed and funded
  console.log("Executed:", res.hash)
}
```

Notes:
- Tested live on World Chain Sepolia against a predicted Safe: both signatures were added (`signatures: 2`). Execution was not run.
- `SigningMethod` comes from `@safe-global/types-kit`. Some reference pages still import it from protocol-kit, which fails since v6 (errors.md).
- Owners can sign at different times: store `safeTx.data` (all fields, including `nonce`) in your DB, recreate it with `createTransaction({ transactions: [...], options: { nonce } })`, and `addSignature` each one.

## 4. Batch calls

Goal: "approve + action" (or any list of calls) in one Safe transaction and one signature round.
Docs: https://docs.safe.global/reference-sdk-protocol-kit/transactions/createtransaction

```ts
import "dotenv/config"
import Safe from "@safe-global/protocol-kit"
import { OperationType, type MetaTransactionData } from "@safe-global/types-kit"
import { encodeFunctionData, erc20Abi, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"

const RPC_URL = process.env.RPC_URL ?? sepolia.rpcUrls.default.http[0]
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`
const owner = privateKeyToAccount(PRIVATE_KEY)
const TOKEN = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" // USDC on Sepolia (6 decimals)
const SPENDER = "0x000000000000000000000000000000000000dEaD" // replace with your contract

const SAFE_ADDRESS = process.env.SAFE_ADDRESS
const kit = await Safe.init({
  provider: RPC_URL,
  signer: PRIVATE_KEY,
  ...(SAFE_ADDRESS
    ? { safeAddress: SAFE_ADDRESS }
    : { predictedSafe: { safeAccountConfig: { owners: [owner.address], threshold: 1 } } }),
})

const transactions: MetaTransactionData[] = [
  {
    to: TOKEN,
    value: "0",
    data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [SPENDER, parseUnits("5", 6)] }),
    operation: OperationType.Call,
  },
  {
    to: TOKEN,
    value: "0",
    data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [SPENDER, parseUnits("1", 6)] }),
    operation: OperationType.Call,
  },
]
// 2+ transactions become one DelegateCall to MultiSendCallOnly (onlyCalls defaults to true)
const safeTx = await kit.createTransaction({ transactions, onlyCalls: true })
console.log("Safe:", await kit.getAddress(), "batch to:", safeTx.data.to, "operation:", safeTx.data.operation)

if (process.env.EXECUTE === "1") {
  // Threshold 1 and the signer is an owner: executeTransaction signs and sends (signer pays gas)
  const res = await kit.executeTransaction(safeTx)
  console.log("Executed:", res.hash)
}
```

Notes:
- Tested live on Sepolia (predicted Safe): the batch targets MultiSendCallOnly 1.4.1 `0x9641d764fc13c8B624c04430C7356C1C7C8102e2` with `operation: 1` (DelegateCall). That is expected for batches.
- One transaction in the array is sent as a normal call, not through MultiSend.
- The same `transactions` array works in recipe 2 (propose a batch), recipe 5 (`safe4337Pack.createTransaction`) and recipe 6 (`sdk.txs.send`).

## 5. Safe as a 4337 smart account with sponsored gas

Goal: a 1-owner Safe that is deployed on its first user operation, with gas paid by a paymaster. Needs `npm i --save-exact @safe-global/relay-kit@6.1.2` and a bundler/paymaster key (Pimlico here, `PIMLICO_API_KEY`; get it at https://dashboard.pimlico.io).
Docs: https://docs.safe.global/sdk/relay-kit/guides/4337-safe-sdk , https://docs.safe.global/sdk/relay-kit/reference/safe-4337-pack

```ts
import "dotenv/config"
import { Safe4337Pack } from "@safe-global/relay-kit"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"

const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`
const chainId = sepolia.id
const RPC_URL = process.env.RPC_URL ?? sepolia.rpcUrls.default.http[0]
const pimlicoUrl = `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${PIMLICO_API_KEY}`
const owner = privateKeyToAccount(PRIVATE_KEY)

const safe4337Pack = await Safe4337Pack.init({
  provider: RPC_URL,
  signer: PRIVATE_KEY,
  bundlerUrl: pimlicoUrl,
  safeModulesVersion: "0.3.0", // EntryPoint v0.7. The SDK default is 0.2.0 (EntryPoint v0.6)
  options: { owners: [owner.address], threshold: 1, saltNonce: "0" }, // new Safe, deployed with the first op
  paymasterOptions: {
    isSponsored: true,
    paymasterUrl: pimlicoUrl,
    // sponsorshipPolicyId: process.env.PIMLICO_POLICY_ID, // if your Pimlico key requires a policy
  },
})
console.log("Safe (counterfactual):", await safe4337Pack.protocolKit.getAddress())

// One user operation, several calls (batched)
const safeOperation = await safe4337Pack.createTransaction({
  transactions: [
    { to: owner.address, value: "0", data: "0x" },
    { to: owner.address, value: "0", data: "0x" },
  ],
})
const signed = await safe4337Pack.signSafeOperation(safeOperation)
const userOpHash = await safe4337Pack.executeTransaction({ executable: signed })
console.log("userOpHash:", userOpHash)

let receipt = null
while (!receipt) {
  await new Promise((r) => setTimeout(r, 2000))
  receipt = await safe4337Pack.getUserOperationReceipt(userOpHash)
}
console.log("Mined in tx:", receipt.receipt.transactionHash, "success:", receipt.success)
```

Notes:
- **Set `safeModulesVersion: "0.3.0"`.** The SDK default is still `0.2.0` (EntryPoint v0.6), and the 0.2.0 module is not deployed on any hackathon sponsor chain: init throws `Safe4337Module and/or SafeModuleSetup not available for chain 480 and modules version 0.2.0` (tested).
- Testnets missing from the module registry (World Chain Sepolia 4801, Unichain Sepolia 1301, Arc Testnet 5042002, Whitechain Sepolia 1874): the 0.3.0 contracts are on-chain at the canonical addresses (checked with `eth_getCode`), so pass them yourself:
  ```ts
  customContracts: {
    safe4337ModuleAddress: "0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226",
    safeModulesSetupAddress: "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47",
  },
  ```
  Addresses from https://github.com/safe-global/safe-modules-deployments (`safe-4337-module/v0.3.0`). With this, init + `createTransaction` + `signSafeOperation` passed against Pimlico's bundler on 4801, 1301 and 5042002 (Whitechain has no Pimlico bundler).
- No paymaster: drop `paymasterOptions`; the Safe pays gas in native token, so send funds to the predicted address first.
- ERC-20 paymaster: `paymasterOptions: { paymasterUrl, paymasterAddress, paymasterTokenAddress, amountToApprove? }` (no `isSponsored`). For sponsored mode the type only allows `isSponsored`, `paymasterUrl`, `sponsorshipPolicyId`, `paymasterContext`; the docs example that also passes `paymasterAddress` does not type-check (errors.md).
- Existing Safe: `options: { safeAddress }` works only if the Safe is 1.4.1+ and has the 4337 module enabled and set as fallback handler.
- Sponsored ops were not run end to end (need a real Pimlico key). Gas estimation and signing were tested keyless (TESTED.md).

## 6. Your dApp as a Safe App

Goal: open your app inside Safe{Wallet} (Apps in the sidebar > add custom app > paste your URL) so the Safe is the connected account and every write becomes a Safe transaction for the owners to sign. Needs `npm i --save-exact @safe-global/safe-apps-sdk@9.1.0 @safe-global/safe-apps-provider@0.18.6`.
Docs: https://github.com/safe-global/safe-apps-sdk/tree/main/packages/safe-apps-sdk , https://github.com/safe-global/safe-apps-sdk/tree/main/packages/safe-apps-provider

6a. Plain viem:

```ts
import SafeAppsSDK from "@safe-global/safe-apps-sdk"
import { SafeAppProvider } from "@safe-global/safe-apps-provider"
import { createWalletClient, custom, encodeFunctionData, erc20Abi, parseUnits } from "viem"

const sdk = new SafeAppsSDK({ allowedDomains: [/^https:\/\/app\.safe\.global$/] })

export async function connectSafe() {
  // Resolves only inside the Safe{Wallet} iframe; add your own timeout for normal browser tabs
  const safe = await sdk.safe.getInfo() // { safeAddress, chainId, owners, threshold, ... }
  const provider = new SafeAppProvider(safe, sdk) // EIP-1193 provider
  const walletClient = createWalletClient({
    account: safe.safeAddress as `0x${string}`,
    transport: custom(provider),
  })
  return { safe, walletClient }
}

// Propose a batch: owners approve it in the Safe UI; you get a safeTxHash, not a tx hash
export async function approveAndTransfer(token: `0x${string}`, to: `0x${string}`) {
  const { safeTxHash } = await sdk.txs.send({
    txs: [
      { to: token, value: "0", data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [to, parseUnits("5", 6)] }) },
      { to: token, value: "0", data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, parseUnits("1", 6)] }) },
    ],
  })
  const details = await sdk.txs.getBySafeTxHash(safeTxHash) // status, confirmations, txHash once executed
  return { safeTxHash, status: details.txStatus, txHash: details.txHash }
}
```

6b. wagmi (also `npm i --save-exact wagmi@3.7.7 @tanstack/react-query`); docs https://wagmi.sh/core/api/connectors/safe :

```ts
import { createConfig, http } from "wagmi"
import { sepolia, worldchain } from "wagmi/chains"
import { injected, safe } from "wagmi/connectors"

export const config = createConfig({
  chains: [sepolia, worldchain],
  connectors: [
    safe({ allowedDomains: [/^https:\/\/app\.safe\.global$/] }), // full origin, incl. https://
    injected(),
  ],
  transports: { [sepolia.id]: http(), [worldchain.id]: http() },
})
```

Notes:
- `allowedDomains` regexes are tested against the full origin, e.g. `https://app.safe.global`. The wagmi docs example `/^app\.safe\.global$/` never matches, so the app never connects (checked in the SDK source, errors.md).
- Writes return a `safeTxHash`, not a chain tx hash. Wait for owners, then read `getBySafeTxHash(...).txHash`.
- Safe{Wallet} loads `<your-app>/manifest.json` (name, description, iconPath) and needs CORS on it (`Access-Control-Allow-Origin: *`). See https://github.com/safe-global/safe-apps-sdk/blob/main/guides/drain-safe-app/01-bootstrap-the-app.md
- Outside the Safe iframe (normal tab), users connect a Safe through WalletConnect from Safe{Wallet}; use your normal WalletConnect / Reown setup.
- Browser-only: type-checked, and the wagmi config was built in Node. Not run inside Safe{Wallet}.

## 7. Read Safes and history from the Transaction Service

Goal: dashboards, "which Safes does this user own", show the queue.
Docs: https://docs.safe.global/reference-sdk-api-kit/overview

```ts
import "dotenv/config"
import SafeApiKit from "@safe-global/api-kit"

const apiKit = new SafeApiKit({ chainId: 480n, apiKey: process.env.SAFE_API_KEY }) // World Chain
const OWNER = process.env.OWNER_ADDRESS!
const SAFE_ADDRESS = process.env.SAFE_ADDRESS!

const { safes } = await apiKit.getSafesByOwner(OWNER)
console.log("Safes owned:", safes)

const info = await apiKit.getSafeInfo(SAFE_ADDRESS)
console.log("Owners:", info.owners, "threshold:", info.threshold, "nonce:", info.nonce)

const pending = await apiKit.getPendingTransactions(SAFE_ADDRESS)
console.log("Queued:", pending.count)

const history = await apiKit.getMultisigTransactions(SAFE_ADDRESS)
for (const tx of history.results) console.log(tx.nonce, tx.isExecuted, tx.safeTxHash)
```

Notes:
- Raw REST (no SDK) is also fine: `GET https://api.safe.global/tx-service/<shortName>/api/v1/safes/<address>/` with header `Authorization: Bearer <SAFE_API_KEY>`. Short names: `sep`, `wc`, `unichain`, `arc`, `arc-testnet`, `0g`, `wch-sepolia` (from API Kit's network list). API reference per chain: https://docs.safe.global/core-api/transaction-service-reference
- A brand-new Safe can take a few seconds to be indexed; `getSafeInfo` returns `Not Found` until then.
- Type-checked only (needs a key). Unauthenticated `GET .../tx-service/wc/api/v2/owners/<addr>/safes/` returned 200 in our test.
