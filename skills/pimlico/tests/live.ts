// Live checks for the pimlico skill. No API key, no funds, nothing is sent on-chain.
// Uses Pimlico's keyless public bundler (https://public.pimlico.io/v2/<chainId>/rpc) on the sponsor testnets the skill
// lists, with a throwaway owner key generated at runtime:
//   1. eth_chainId on the chain's public RPC matches viem's chain id
//   2. the bundler lists the EntryPoint 0.7 address and returns gas prices (getUserOperationGasPrice)
//   3. Safe 1.4.1, Simple and Kernel 0.3.1 counterfactual addresses are predicted (non-zero, stable for the same owner)
//   4. a batched user operation (raw call + typed ERC-20 approve, with account deployment) passes bundler gas
//      estimation via prepareUserOperation — with a balance state override, since the account is empty
// Exit 0 = pass, 1 = real failure, 75 = a service could not be reached (network/timeout/5xx/rate limit).
import { createSmartAccountClient } from "permissionless"
import { toKernelSmartAccount, toSafeSmartAccount, toSimpleSmartAccount } from "permissionless/accounts"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { createPublicClient, http, parseAbi, zeroAddress, type Chain } from "viem"
import { entryPoint07Address } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { arcTestnet, unichainSepolia, worldchainSepolia } from "viem/chains"

type Kind = "safe" | "simple" | "kernel"
// Kernel 0.3.x is not offered on World Chain Sepolia or Arc per Pimlico's docs table (references/chains.md), so only
// the combinations the skill recommends are estimated.
const plan: { chain: Chain; kinds: Kind[] }[] = [
  { chain: worldchainSepolia, kinds: ["safe", "simple"] },
  { chain: unichainSepolia, kinds: ["safe", "simple", "kernel"] },
  { chain: arcTestnet, kinds: ["safe", "simple"] },
]
const expectedIds: Record<string, number> = { [worldchainSepolia.name]: 4801, [unichainSepolia.name]: 1301, [arcTestnet.name]: 5042002 }

const NETWORK = 75
const isNetwork = (e: unknown): boolean => {
  const s = `${(e as any)?.name} ${(e as any)?.shortMessage} ${(e as any)?.message} ${(e as any)?.details} ${(e as any)?.status}`
  if (/HttpRequestError|TimeoutError|fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket|took too long|rate.?limit|too many requests|\b429\b|\b50[0-4]\b/i.test(s)) return true
  return (e as any)?.cause ? isNetwork((e as any).cause) : false
}
const failures: string[] = []
let networkProblems = 0
const check = async (label: string, fn: () => Promise<string>) => {
  try { console.log(`  ok   ${label}: ${await fn()}`) }
  catch (e: any) {
    const msg = (e?.shortMessage ?? e?.message ?? String(e)).split("\n")[0]
    if (isNetwork(e)) { networkProblems++; console.log(`  net  ${label}: ${msg}`) }
    else { failures.push(label); console.log(`  FAIL ${label}: ${msg}${e?.details ? ` (${e.details})` : ""}`) }
  }
}
const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg) }

const entryPoint = { address: entryPoint07Address, version: "0.7" } as const
const owner = privateKeyToAccount(generatePrivateKey()) // throwaway, never saved, never funded
const erc20 = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"])

for (const { chain, kinds } of plan) {
  console.log(`${chain.name} (${chain.id})`)
  const url = `https://public.pimlico.io/v2/${chain.id}/rpc`
  const publicClient = createPublicClient({ chain, transport: http(undefined, { timeout: 30_000, retryCount: 2 }) })
  const pimlicoClient = createPimlicoClient({ chain, transport: http(url, { timeout: 30_000, retryCount: 2 }), entryPoint })

  await check("chain id", async () => {
    const id = await publicClient.getChainId()
    assert(id === chain.id && id === expectedIds[chain.name], `RPC says ${id}, viem says ${chain.id}, skill says ${expectedIds[chain.name]}`)
    return String(id)
  })
  await check("bundler EntryPoint 0.7", async () => {
    const eps = (await pimlicoClient.request({ method: "eth_supportedEntryPoints" } as any)) as string[]
    assert(Array.isArray(eps) && eps.some((a) => a.toLowerCase() === entryPoint07Address.toLowerCase()), `not listed: ${JSON.stringify(eps)}`)
    return `${eps.length} entry points incl. 0.7`
  })
  await check("getUserOperationGasPrice", async () => {
    const p = await pimlicoClient.getUserOperationGasPrice()
    assert(p.fast.maxFeePerGas > 0n, "fast.maxFeePerGas is 0")
    return `fast maxFeePerGas ${p.fast.maxFeePerGas}`
  })

  for (const kind of kinds) {
    const make = () =>
      kind === "kernel" ? toKernelSmartAccount({ client: publicClient, owners: [owner], entryPoint, version: "0.3.1", index: 0n })
      : kind === "simple" ? toSimpleSmartAccount({ client: publicClient, owner, entryPoint })
      : toSafeSmartAccount({ client: publicClient, owners: [owner], entryPoint, version: "1.4.1", saltNonce: 0n })
    await check(`${kind} address + gas estimate`, async () => {
      const account = await make()
      assert(account.address !== zeroAddress, "predicted address is 0x000...000")
      const again = await make()
      assert(again.address === account.address, `address not stable: ${account.address} vs ${again.address}`)
      const client = createSmartAccountClient({
        account, chain,
        bundlerTransport: http(url, { timeout: 60_000, retryCount: 2 }),
        userOperation: { estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast },
      })
      const op = await client.prepareUserOperation({
        calls: [
          { to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", value: 0n, data: "0x1234" },
          { to: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", abi: erc20, functionName: "approve", args: [owner.address, 1n] },
        ],
        stateOverride: [{ address: account.address, balance: 10n ** 18n }],
      })
      assert(op.callGasLimit > 0n && op.verificationGasLimit > 0n && op.preVerificationGas > 0n, "gas limits missing")
      assert(op.factory, "expected a factory (undeployed account)")
      return `${account.address} callGas ${op.callGasLimit} verifGas ${op.verificationGasLimit}`
    })
  }
}

if (failures.length) { console.log(`\n${failures.length} live check(s) failed: ${failures.join(", ")}`); process.exit(1) }
if (networkProblems) { console.log(`\n${networkProblems} check(s) could not reach a service`); process.exit(NETWORK) }
console.log("\nall live checks passed")
