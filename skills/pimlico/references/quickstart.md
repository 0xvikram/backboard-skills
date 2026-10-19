# Pimlico quickstart (full)

Goal: a Safe smart account on Sepolia that sends its first transaction with gas paid by Pimlico's verifying paymaster.
Based on: https://docs.pimlico.io/guides/tutorials/tutorial-1 (code: https://github.com/pimlicolabs/docs/blob/main/docs/snippets/tutorial-1.ts).

## 1. Get an API key

Dashboard (no install):
1. Open https://dashboard.pimlico.io/ and sign up or log in.
2. Click **API Keys** in the sidebar.
3. Click **Create API key**, copy it into `.env` right away.

Or with the Pimlico CLI ([docs](https://docs.pimlico.io/references/platform/cli)):
```bash
npm install -g @pimlico/cli
pimlico telemetry disable   # the CLI sends usage telemetry by default
pimlico login               # opens the browser; tick the `write:keys` permission
pimlico keys create --name my-hack
```
`keys create` shows the key only once. Source: https://docs.pimlico.io/guides/create-api-key

Costs: testnet sponsorship is free. Mainnet sponsorship needs a Pimlico balance ([source](https://docs.pimlico.io/references/paymaster/verifying-paymaster/common-errors)).

## 2. Project setup

```bash
mkdir my-aa && cd my-aa
npm init -y && npm pkg set type=module
npm i --save-exact permissionless@0.5.0 viem@2.57.7 dotenv@17.2.3
npm i -D tsx typescript @types/node
```
`type=module` is needed for top-level `await`. permissionless 0.5.0 needs viem `^2.44.4`.

`.env`:
```bash
PIMLICO_API_KEY=<YOUR_API_KEY>
# PRIVATE_KEY is added by the script on first run if missing (test key only)
```
Add `.env` to `.gitignore`.

## 3. index.ts

```ts
import "dotenv/config"
import { appendFileSync } from "node:fs"
import { createSmartAccountClient } from "permissionless"
import { toSafeSmartAccount } from "permissionless/accounts"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { createPublicClient, http, type Hex } from "viem"
import { entryPoint07Address } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"

const apiKey = process.env.PIMLICO_API_KEY
if (!apiKey) throw new Error("Missing PIMLICO_API_KEY")

// Owner key of the smart account. Made once and saved to .env (test key only).
const privateKey =
  (process.env.PRIVATE_KEY as Hex | undefined) ??
  (() => {
    const pk = generatePrivateKey()
    appendFileSync(".env", `\nPRIVATE_KEY=${pk}\n`)
    return pk
  })()

const publicClient = createPublicClient({ chain: sepolia, transport: http() })

const pimlicoUrl = `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${apiKey}`

// Bundler + paymaster client (one URL serves both)
const pimlicoClient = createPimlicoClient({
  transport: http(pimlicoUrl),
  entryPoint: { address: entryPoint07Address, version: "0.7" },
})

const account = await toSafeSmartAccount({
  client: publicClient,
  owners: [privateKeyToAccount(privateKey)],
  entryPoint: { address: entryPoint07Address, version: "0.7" },
  version: "1.4.1",
})
console.log("Smart account:", account.address)

const smartAccountClient = createSmartAccountClient({
  account,
  chain: sepolia,
  bundlerTransport: http(pimlicoUrl),
  paymaster: pimlicoClient, // Pimlico pays the gas (free on testnets)
  userOperation: {
    estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
  },
})

const txHash = await smartAccountClient.sendTransaction({
  to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
  value: 0n,
  data: "0x1234",
})
console.log(`Included: https://sepolia.etherscan.io/tx/${txHash}`)
```

Changes from the official tutorial: it uses `appendFileSync` instead of `writeFileSync(".env", ...)` (the original overwrites `.env` and deletes your API key line), and viem's default Sepolia RPC instead of a hard-coded one.

## 4. Run

```bash
npx tsx index.ts
```
Expected: the smart account address, then an explorer link. That one transaction:
- deployed the Safe (accounts are counterfactual: the address exists before the contract),
- checked the owner's signature,
- had Pimlico's paymaster pay the gas,
- ran your call.

## What each piece does

| Piece | Role |
| --- | --- |
| `publicClient` | Normal viem reads (nonce, code, balances) |
| `createPimlicoClient` | Talks to Pimlico: gas prices, paymaster (`pm_*`), `pimlico_*` methods |
| `toSafeSmartAccount` | Builds the account object (address, signing, call encoding) |
| `createSmartAccountClient` | Like a viem WalletClient; `sendTransaction` builds, sponsors, signs and submits a user operation, then waits for the tx hash |
| `entryPoint07Address` | The ERC-4337 EntryPoint v0.7 (`0x0000000071727De22E5E9d8BAf0edAc6f37da032`) |

Endpoint format: `https://api.pimlico.io/v2/<chainId or slug>/rpc?apikey=<KEY>` ([source](https://docs.pimlico.io/guides/supported-chains)).

## Without an API key?

Pimlico has a public bundler at `https://public.pimlico.io/v2/<chainId>/rpc` (20 requests/min/IP, [docs](https://docs.pimlico.io/references/bundler/public-endpoint)). In our test (2026-10-19) its paymaster refused with `Sponsorship policy ID is required for this API key`, so for gasless use, get a free key. The public bundler still works if the smart account holds native gas itself.

## Shipping a frontend

The API key sits in the URL. In a browser app, restrict it on the API Keys page (allowed origins, IPs, methods), add a sponsorship policy, or call Pimlico through your own backend proxy. Source: https://docs.pimlico.io/guides/how-to/security/protect-api-keys
