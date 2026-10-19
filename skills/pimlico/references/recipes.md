# Pimlico recipes

All recipes use permissionless@0.5.0 + viem@2.57.7, EntryPoint 0.7, ESM (`"type": "module"`). They all start from the same three clients as [quickstart.md](quickstart.md): `publicClient`, `pimlicoClient`, `smartAccountClient`. Every code block below was type-checked with TypeScript 7.0.2 and 5.9.3 on 2026-10-19.

Shared setup used by recipes 2, 3 and 6 (swap the account line for the one you pick in recipe 1):

```ts
import { createSmartAccountClient } from "permissionless"
import { toSafeSmartAccount } from "permissionless/accounts"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { createPublicClient, http, type Hex } from "viem"
import { entryPoint07Address } from "viem/account-abstraction"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"

const pimlicoUrl = `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
const publicClient = createPublicClient({ chain: sepolia, transport: http() })
const pimlicoClient = createPimlicoClient({
  transport: http(pimlicoUrl),
  entryPoint: { address: entryPoint07Address, version: "0.7" },
})
const account = await toSafeSmartAccount({
  client: publicClient,
  owners: [privateKeyToAccount(process.env.PRIVATE_KEY as Hex)],
  entryPoint: { address: entryPoint07Address, version: "0.7" },
  version: "1.4.1",
})
const smartAccountClient = createSmartAccountClient({
  account,
  chain: sepolia,
  bundlerTransport: http(pimlicoUrl),
  paymaster: pimlicoClient,
  userOperation: {
    estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
  },
})
```

---

## 1. Pick a smart account (Safe, Simple, Kernel)

Goal: create the account object. Any of these plugs into `createSmartAccountClient({ account, ... })`.

```ts
import { toKernelSmartAccount, toSafeSmartAccount, toSimpleSmartAccount } from "permissionless/accounts"
import { createPublicClient, http } from "viem"
import { entryPoint07Address } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"

const publicClient = createPublicClient({ chain: sepolia, transport: http() })
const owner = privateKeyToAccount(generatePrivateKey()) // demo only; load a saved key in real code
const entryPoint = { address: entryPoint07Address, version: "0.7" } as const

const safe = await toSafeSmartAccount({
  client: publicClient,
  owners: [owner],
  entryPoint,
  version: "1.4.1",
  saltNonce: 0n, // keep the same value to get the same address later
})

const simple = await toSimpleSmartAccount({
  client: publicClient,
  owner, // note: `owner`, not `owners`
  entryPoint,
})

const kernel = await toKernelSmartAccount({
  client: publicClient,
  owners: [owner],
  entryPoint,
  version: "0.3.1", // 0.3.x needs EntryPoint 0.7; 0.2.x needs 0.6
  index: 0n,
})

console.log({ safe: safe.address, simple: simple.address, kernel: kernel.address })
```

Notes:
- Safe 1.4.1 and Simple Account are listed for EntryPoint 0.7 on every sponsor chain we checked. Kernel is not: World Chain Sepolia lists no Kernel version, so `toKernelSmartAccount` there returns address `0x000…000`. Check the per-chain table first: https://docs.pimlico.io/guides/supported-chains
- The address depends on owner + salt (`saltNonce` for Safe, `index` for Kernel). Change either and you get a new, empty account.
- To reuse an existing account, pass `address: "0x..."`.

Sources: https://docs.pimlico.io/references/permissionless/how-to/accounts/use-safe-account , https://docs.pimlico.io/references/permissionless/how-to/accounts/use-simple-account , https://docs.pimlico.io/references/permissionless/how-to/accounts/use-kernel-account , https://docs.pimlico.io/references/permissionless/reference/accounts/toKernelSmartAccount

---

## 2. Sponsored (gasless) transaction

Goal: the user signs, Pimlico pays gas. With `paymaster: pimlicoClient` on the client (shared setup), every `sendTransaction` / `writeContract` is sponsored.

```ts
import { getContract, parseAbi } from "viem"

// plain call
const txHash = await smartAccountClient.sendTransaction({
  to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
  value: 0n,
  data: "0x1234",
})

// call your contract
const nft = getContract({
  address: process.env.NFT_ADDRESS as `0x${string}`, // your contract with a mint() function
  abi: parseAbi(["function mint()"]),
  client: { public: publicClient, wallet: smartAccountClient },
})
const mintHash = await nft.write.mint()
```

Sponsor only some operations: leave `paymaster` off the client and pass it per call:
```ts
await smartAccountClient.sendTransaction({
  calls: [{ to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", value: 0n, data: "0x" }],
  paymaster: pimlicoClient,
})
```

Notes:
- `msg.sender` in your contract is the smart account address, not the owner EOA.
- Testnets are free; mainnet needs a Pimlico balance.
- `sendTransaction` waits and returns the transaction hash. Use recipe 3 (`sendUserOperation`) if you want the user operation hash right away.

Sources: https://docs.pimlico.io/guides/tutorials/tutorial-1 , https://docs.pimlico.io/references/permissionless/how-to/paymasters/conditional-sponsoring

---

## 3. Batch several calls

Goal: approve + action (or N mints) in one user operation, one signature, atomic.

```ts
import { parseAbi } from "viem"

const erc20 = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"])
const TOKEN = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" // USDC on Sepolia
const SPENDER = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"

// A: send and wait for the tx hash
const txHash = await smartAccountClient.sendTransaction({
  calls: [
    { to: TOKEN, abi: erc20, functionName: "approve", args: [SPENDER, 1_000_000n] },
    { to: SPENDER, value: 0n, data: "0x1234" },
  ],
})

// B: get the user operation hash, then wait yourself
const userOpHash = await smartAccountClient.sendUserOperation({
  calls: [
    { to: TOKEN, abi: erc20, functionName: "approve", args: [SPENDER, 0n] },
    { to: SPENDER, value: 0n, data: "0x" },
  ],
})
const receipt = await smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash })
console.log("success:", receipt.success, "tx:", receipt.receipt.transactionHash)
```

Notes:
- Each call can be raw (`to`, `value`, `data`) or typed (`to`, `abi`, `functionName`, `args`).
- If any call reverts, the whole batch reverts. Check `receipt.success`; a mined user operation can still have failed.

Sources: https://docs.pimlico.io/guides/tutorials/send-transaction (code: https://github.com/pimlicolabs/docs/blob/main/docs/snippets/send-transaction.ts), https://docs.pimlico.io/references/permissionless/how-to/accounts/use-safe-account

---

## 4. Pay gas in USDC (ERC-20 paymaster)

Goal: the user holds USDC, no ETH, and pays gas in USDC. `prepareUserOperationForErc20Paymaster` adds the exact-amount `approve` to the paymaster for you when it is needed.

```ts
import { createSmartAccountClient } from "permissionless"
import { toSafeSmartAccount } from "permissionless/accounts"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { prepareUserOperationForErc20Paymaster } from "permissionless/experimental/pimlico"
import { createPublicClient, http, parseAbi, type Hex } from "viem"
import { entryPoint07Address } from "viem/account-abstraction"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"

const chain = baseSepolia
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" // Base Sepolia USDC (Circle faucet)
const pimlicoUrl = `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`

const publicClient = createPublicClient({ chain, transport: http() })
const pimlicoClient = createPimlicoClient({
  chain,
  transport: http(pimlicoUrl),
  entryPoint: { address: entryPoint07Address, version: "0.7" },
})
const account = await toSafeSmartAccount({
  client: publicClient,
  owners: [privateKeyToAccount(process.env.PRIVATE_KEY as Hex)],
  entryPoint: { address: entryPoint07Address, version: "0.7" },
  version: "1.4.1",
})

// The smart account must hold USDC first: https://faucet.circle.com (Base Sepolia)
const balance = await publicClient.readContract({
  address: USDC,
  abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
  functionName: "balanceOf",
  args: [account.address],
})
if (balance < 1_000_000n) throw new Error(`Send >= 1 USDC to ${account.address} first`)

const smartAccountClient = createSmartAccountClient({
  account,
  chain,
  bundlerTransport: http(pimlicoUrl),
  paymaster: pimlicoClient,
  userOperation: {
    estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    prepareUserOperation: prepareUserOperationForErc20Paymaster(pimlicoClient),
  },
})

const txHash = await smartAccountClient.sendTransaction({
  calls: [{ to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", value: 0n, data: "0x1234" }],
  paymasterContext: { token: USDC }, // pay gas in USDC
})
```

Notes:
- Fund the counterfactual address (print `account.address`) with test USDC before sending.
- Which tokens work where: https://docs.pimlico.io/guides/how-to/erc20-paymaster/supported-tokens . On sponsor chains the docs list USDC/WLD on World Chain and USDC/PIM on World Chain Sepolia; none are listed for Unichain or Arc. Confirm with `await pimlicoClient.getTokenQuotes({ tokens: [TOKEN] })` — an empty array means not available to your key (on 2026-10-19 the keyless public endpoint returned a quote for Base Sepolia USDC but `[]` for World Chain Sepolia USDC/PIM).
- To estimate before the user has tokens, use `prepareUserOperationForErc20Paymaster(pimlicoClient, { balanceOverride: true })`.
- The helper lives under `permissionless/experimental/pimlico`; the import path may change.
- Prefer one unlimited approval? See https://docs.pimlico.io/guides/how-to/erc20-paymaster/how-to/use-paymaster-with-unlimited-approval

Sources: https://docs.pimlico.io/guides/how-to/erc20-paymaster/how-to/use-paymaster (code: https://github.com/pimlicolabs/docs/blob/main/docs/snippets/erc20-paymaster/use-paymaster-without-unlimited-approval.ts), https://docs.pimlico.io/guides/tutorials/tutorial-2

---

## 5. World Chain, Unichain, Arc testnets

Goal: same code, sponsor chain. Only `chain` changes; the Pimlico URL takes the chain ID.

```ts
import { createSmartAccountClient } from "permissionless"
import { toSafeSmartAccount } from "permissionless/accounts"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { createPublicClient, http, type Chain, type Hex } from "viem"
import { entryPoint07Address } from "viem/account-abstraction"
import { privateKeyToAccount } from "viem/accounts"
import { arcTestnet, unichainSepolia, worldchainSepolia } from "viem/chains"

export async function makeClient(chain: Chain) {
  const pimlicoUrl = `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
  const publicClient = createPublicClient({ chain, transport: http() })
  const pimlicoClient = createPimlicoClient({
    chain,
    transport: http(pimlicoUrl),
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  })
  const account = await toSafeSmartAccount({
    client: publicClient,
    owners: [privateKeyToAccount(process.env.PRIVATE_KEY as Hex)],
    entryPoint: { address: entryPoint07Address, version: "0.7" },
    version: "1.4.1",
  })
  return createSmartAccountClient({
    account,
    chain,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  })
}

// Pick one: worldchainSepolia (4801), unichainSepolia (1301), arcTestnet (5042002)
const chain: Chain = worldchainSepolia
const client = await makeClient(chain)
const txHash = await client.sendTransaction({
  calls: [{ to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", value: 0n, data: "0x" }],
})
console.log(`${chain.name}: ${chain.blockExplorers?.default.url}/tx/${txHash}`)
```

Notes:
- Use Safe or Simple on these chains (Kernel support differs per chain; see [chains.md](chains.md)).
- Arc's native gas token is USDC (viem's `arcTestnet.nativeCurrency.symbol` is `USDC`). With the paymaster on, users need no gas token at all.
- The same Safe owner + salt gives the same address on every chain where the factory is deployed.
- viem's default public RPCs worked for reads in our test. Use your own RPC for anything heavy.

Sources: https://docs.pimlico.io/guides/supported-chains , viem chain definitions (`viem/chains`).

---

## 6. Limit sponsorship with a policy

Goal: cap what you pay (global limit, per-user limit, per-op limit, time window) before you share a demo link.

1. Dashboard > **Sponsorship Policies** (https://dashboard.pimlico.io/sponsorship-policies) > create a policy, set limits, copy its ID. Or `pimlico` CLI with the `write:policies` permission.
2. Pass the ID as paymaster context (shared setup, plus one line):

```ts
const smartAccountClient = createSmartAccountClient({
  account,
  chain: sepolia,
  bundlerTransport: http(pimlicoUrl),
  paymaster: pimlicoClient,
  // every user operation from this client is checked against this policy
  paymasterContext: { sponsorshipPolicyId: process.env.SPONSORSHIP_POLICY_ID! },
  userOperation: {
    estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
  },
})
```

Notes:
- `paymasterContext` takes either `{ sponsorshipPolicyId }` (sponsor mode) or `{ token }` (ERC-20 mode) ([pm_getPaymasterData](https://docs.pimlico.io/references/paymaster/erc20-paymaster/endpoints/pm_getPaymasterData)).
- You can also set it per call: `sendTransaction({ ..., paymasterContext: { sponsorshipPolicyId } })`.
- Webhooks can approve/reject each request: https://docs.pimlico.io/guides/how-to/sponsorship-policies/webhook

Sources: https://docs.pimlico.io/guides/how-to/security/protect-api-keys , https://docs.pimlico.io/references/platform/api/sponsorship-policies

---

## 7. Browser wallet as the owner

Goal: the user's MetaMask / injected wallet (or an embedded wallet's EIP-1193 provider, e.g. Privy) owns the smart account. Owners accept `LocalAccount | EIP1193Provider | WalletClient`.

```ts
/// <reference lib="dom" />
import { createSmartAccountClient } from "permissionless"
import { toSafeSmartAccount } from "permissionless/accounts"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { createPublicClient, createWalletClient, custom, http, type EIP1193Provider } from "viem"
import { entryPoint07Address } from "viem/account-abstraction"
import { sepolia } from "viem/chains"

declare global {
  interface Window { ethereum?: EIP1193Provider }
}

export async function connectSmartAccount(pimlicoUrl: string) {
  if (!window.ethereum) throw new Error("No browser wallet found")
  const [address] = await window.ethereum.request({ method: "eth_requestAccounts" })
  const walletClient = createWalletClient({ account: address!, chain: sepolia, transport: custom(window.ethereum) })

  const publicClient = createPublicClient({ chain: sepolia, transport: http() })
  const pimlicoClient = createPimlicoClient({
    transport: http(pimlicoUrl),
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  })
  const account = await toSafeSmartAccount({
    client: publicClient,
    owners: [walletClient], // the user's wallet signs; the Safe holds funds
    entryPoint: { address: entryPoint07Address, version: "0.7" },
    version: "1.4.1",
  })
  return createSmartAccountClient({
    account,
    chain: sepolia,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  })
}
```

Notes:
- The wallet shows a signature request (typed data / message), not a transaction.
- The API key is visible in the browser: restrict allowed origins on the API Keys page and use a sponsorship policy (recipe 6), or proxy through your backend ([guide](https://docs.pimlico.io/guides/how-to/security/protect-api-keys)).
- Want to sponsor the user's existing wallet instead (no new account)? See `@permissionless/wagmi` (https://docs.pimlico.io/references/permissionless/wagmi) or EIP-7702 (https://docs.pimlico.io/guides/eip7702).
- Embedded-wallet signers (Privy, Dynamic, Magic, Web3Auth, passkeys): https://docs.pimlico.io/guides/how-to/signers/privy and the other pages under `/guides/how-to/signers/` in https://docs.pimlico.io/llms.txt

Source: https://docs.pimlico.io/references/permissionless/reference/accounts/toSafeSmartAccount (owners type), https://docs.pimlico.io/guides/how-to/signers/privy
