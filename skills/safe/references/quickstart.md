# Safe quickstart (full)

Goal: from an empty folder to a deployed Safe on Sepolia, with an API key ready for the Transaction Service.
Based on: https://docs.safe.global/sdk/protocol-kit/guides/safe-deployment and https://docs.safe.global/core-api/how-to-use-api-keys (read 2026-10-19).

## 1. What you need

- Node 20 or newer (`engines: node >=20` in the SDK packages). Tested on Node 24.
- A throwaway owner key with a little Sepolia ETH for the deploy (any Sepolia faucet; see the `sponsor-chains` skill for sponsor-chain faucets).
- A Safe API key, only for the API Kit (Transaction Service). Steps below.

## 2. Get a Safe API key (for API Kit)

1. Go to the developer dashboard: https://developer.safe.global
2. Create an account and sign in.
3. Open **API Keys** and generate a key. The key is a JWT; you can set an expiry and revoke it there.
4. Put it in `.env` as `SAFE_API_KEY`.

Notes from the docs:
- `new SafeApiKit({ chainId })` throws without `apiKey` when it uses the default `api.safe.global` URL (API Kit 4+).
- Raw HTTP calls without a key work for exploration only (2 requests/second, 5,000 per month). With a key you send `Authorization: Bearer <key>`. Plans: https://safe.global/api
- Limits are per account, not per key. `401` = bad key, `429` = rate limit or monthly quota.

Protocol Kit alone (deploy, sign, execute) needs no Safe API key, only an RPC URL.

## 3. Install

```bash
mkdir safe-hack && cd safe-hack
npm init -y && npm pkg set type=module
npm i --save-exact @safe-global/protocol-kit@8.0.8 @safe-global/api-kit@5.0.4 @safe-global/types-kit@4.0.1 viem@2.57.7 dotenv@17.2.3
npm i -D tsx typescript @types/node
```

Add `@safe-global/relay-kit@6.1.2` only for the ERC-4337 recipe. Optional `tsconfig.json` for type-checking (`npx tsc --noEmit`):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  }
}
```

## 4. Keys and `.env`

```bash
node --input-type=module -e "import { generatePrivateKey } from 'viem/accounts'; console.log(generatePrivateKey())"
```

```bash
# .env  (never commit this file; add it to .gitignore)
PRIVATE_KEY=<TEST_OWNER_KEY>
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
SAFE_API_KEY=<YOUR_SAFE_API_KEY>
```

`RPC_URL` is optional; the script falls back to viem's default Sepolia RPC. Public RPCs rate-limit, so use your own RPC provider URL if calls start failing.

## 5. `index.ts`: predict, then deploy

```ts
import "dotenv/config"
import Safe, { type PredictedSafeProps } from "@safe-global/protocol-kit"
import { createPublicClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined
if (!PRIVATE_KEY) throw new Error("Set PRIVATE_KEY in .env (test key only)")
const owner = privateKeyToAccount(PRIVATE_KEY)
const RPC_URL = process.env.RPC_URL ?? sepolia.rpcUrls.default.http[0]

// 1-of-1 Safe owned by your key. Add more owners and raise threshold for a real multisig.
const predictedSafe: PredictedSafeProps = {
  safeAccountConfig: { owners: [owner.address], threshold: 1 },
  safeDeploymentConfig: { saltNonce: "0" }, // change to get a different address
}

const protocolKit = await Safe.init({ provider: RPC_URL, signer: PRIVATE_KEY, predictedSafe })
const safeAddress = await protocolKit.getAddress()
console.log("Predicted Safe:", safeAddress)

if (await protocolKit.isSafeDeployed()) {
  console.log("Already deployed")
} else if (process.env.DEPLOY === "1") {
  // The owner key pays gas for the deployment (needs test ETH on this chain)
  const deployTx = await protocolKit.createSafeDeploymentTransaction()
  const client = await protocolKit.getSafeProvider().getExternalSigner()
  if (!client) throw new Error("No signer")
  const hash = await client.sendTransaction({
    to: deployTx.to as `0x${string}`,
    value: BigInt(deployTx.value),
    data: deployTx.data as `0x${string}`,
    chain: sepolia,
  })
  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) })
  await publicClient.waitForTransactionReceipt({ hash })
  const safe = await protocolKit.connect({ safeAddress })
  console.log("Deployed:", hash, "owners:", await safe.getOwners(), "threshold:", await safe.getThreshold())
} else {
  console.log("Not deployed yet. Run with DEPLOY=1 to deploy (owner pays gas).")
}
```

## 6. Run

```bash
npx tsx index.ts            # prints the predicted address; no gas, no API key
DEPLOY=1 npx tsx index.ts   # deploys; the owner must hold Sepolia ETH
```

Expected first output:

```
Predicted Safe: 0x...
Not deployed yet. Run with DEPLOY=1 to deploy (owner pays gas).
```

Then open https://app.safe.global, pick Sepolia, and load the address. Explorer: `https://sepolia.etherscan.io/address/<safeAddress>`.

## 7. Notes

- The address is deterministic: same owners + threshold + `saltNonce` + Safe version gives the same address on every chain where the canonical contracts exist (recipe 1).
- You do not have to deploy first. A Safe can receive funds at its predicted address before it exists.
- The official deploy snippet calls `client.waitForTransactionReceipt` on the signer. That does not type-check in protocol-kit 8 (`ExternalSigner` has no public actions), so this file uses a viem public client. See errors.md.
- Default Safe version is 1.4.1 (`DEFAULT_SAFE_VERSION` in protocol-kit). On Hedera use `safeVersion: "1.3.0"` (chains.md).
- To deploy for another chain, change `sepolia` to that viem chain (`worldchainSepolia`, `unichainSepolia`, `arcTestnet`, `whitechainSepolia`, ...) and use an RPC for it.
