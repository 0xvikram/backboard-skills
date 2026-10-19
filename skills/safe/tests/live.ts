// Live checks for the safe skill. No API keys, no funds, nothing is sent on-chain.
//   1. Protocol Kit predicts the recipe-1 2-of-3 Safe (1.4.1, saltNonce 42) on the sponsor testnets: same address on
//      every chain, not deployed; RPC chain ids match viem
//   2. eth_getCode: SafeL2 1.4.1, SafeProxyFactory 1.4.1, MultiSendCallOnly 1.4.1, Safe4337Module 0.3.0,
//      SafeModuleSetup 0.3.0 and EntryPoint 0.7 have code on those chains (the addresses in references/chains.md)
//   3. Transaction Service GET /api/v1/about/ (keyless) answers for every shortName the skill lists
//   4. API Kit (offline): constructs for chains with a Transaction Service, throws "Network with chainId 4801 not found"
//      for World Chain Sepolia and "apiKey is mandatory" without a key (errors.md #1, #2)
//   5. Safe4337Pack (recipe 5) builds and signs a user operation with safeModulesVersion "0.3.0" + customContracts on
//      World Chain Sepolia against Pimlico's keyless public bundler (gas estimation only, never sent)
// Exit 0 = pass, 1 = real failure, 75 = a service could not be reached.
import SafeApiKit from "@safe-global/api-kit"
import Safe, { type PredictedSafeProps } from "@safe-global/protocol-kit"
import { Safe4337Pack } from "@safe-global/relay-kit"
import { createPublicClient, http, type Chain } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { arcTestnet, sepolia, unichainSepolia, whitechainSepolia, worldchainSepolia } from "viem/chains"

const NETWORK = 75
const isNetwork = (e: unknown): boolean => {
  const x = e as any
  const s = `${x?.name} ${x?.code} ${x?.shortMessage} ${x?.message} ${x?.details} ${x?.status}`
  if (/HttpRequestError|TimeoutError|fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|UND_ERR|socket|took too long|aborted|rate.?limit|too many requests|\b429\b|\b50[0-4]\b/i.test(s)) return true
  return x?.cause ? isNetwork(x.cause) : false
}
const failures: string[] = []
let networkProblems = 0
const check = async (label: string, fn: () => Promise<string> | string) => {
  try { console.log(`  ok   ${label}: ${await fn()}`) }
  catch (e: any) {
    const msg = String(e?.shortMessage ?? e?.message ?? e).split("\n")[0]
    if (isNetwork(e)) { networkProblems++; console.log(`  net  ${label}: ${msg}`) }
    else { failures.push(label); console.log(`  FAIL ${label}: ${msg}`) }
  }
}
const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg) }

// ---- 1 + 2: prediction and contract code on the sponsor testnets ----
const chains: Chain[] = [sepolia, worldchainSepolia, unichainSepolia, arcTestnet, whitechainSepolia]
const CONTRACTS = {
  "SafeL2 1.4.1": "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762",
  "SafeProxyFactory 1.4.1": "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
  "MultiSendCallOnly 1.4.1": "0x9641d764fc13c8B624c04430C7356C1C7C8102e2",
  "Safe4337Module 0.3.0": "0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226",
  "SafeModuleSetup 0.3.0": "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47",
  "EntryPoint 0.7": "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
} as const
const predictedSafe: PredictedSafeProps = {
  safeAccountConfig: {
    owners: ["0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222", "0x3333333333333333333333333333333333333333"],
    threshold: 2,
  },
  safeDeploymentConfig: { saltNonce: "42", safeVersion: "1.4.1" },
}
const predicted = new Map<number, string>()
for (const chain of chains) {
  console.log(`${chain.name} (${chain.id})`)
  const rpc = chain.rpcUrls.default.http[0]!
  const client = createPublicClient({ chain, transport: http(rpc, { timeout: 30_000, retryCount: 2 }) })
  await check("chain id", async () => {
    const id = await client.getChainId()
    assert(id === chain.id, `RPC says ${id}, viem says ${chain.id}`)
    return String(id)
  })
  await check("predict 2-of-3 Safe 1.4.1", async () => {
    const kit = await Safe.init({ provider: rpc, predictedSafe })
    const address = await kit.getAddress()
    assert(/^0x[0-9a-fA-F]{40}$/.test(address), `bad address ${address}`)
    assert(!(await kit.isSafeDeployed()), "predicted Safe unexpectedly deployed")
    predicted.set(chain.id, address)
    return `${address} (not deployed)`
  })
  await check("contract code", async () => {
    const missing: string[] = []
    for (const [name, address] of Object.entries(CONTRACTS)) {
      const code = await client.getCode({ address })
      if (!code || code === "0x") missing.push(name)
    }
    assert(missing.length === 0, `no code for ${missing.join(", ")}`)
    return `${Object.keys(CONTRACTS).length} contracts present`
  })
}
await check("same Safe address on every chain", () => {
  const unique = new Set(predicted.values())
  if (predicted.size < chains.length) return `${predicted.size}/${chains.length} chains predicted (others: network)`
  assert(unique.size === 1, `addresses differ: ${[...predicted].map(([c, a]) => `${c}=${a}`).join(" ")}`)
  return [...unique][0]!
})

// ---- 3: Transaction Service /about (keyless) for the shortNames in references/chains.md ----
console.log("Transaction Service")
const TX_SERVICE: Record<string, number> = { sep: 11155111, wc: 480, unichain: 130, arc: 5042, "arc-testnet": 5042002, "0g": 16661, "wch-sepolia": 1874 }
for (const [short, id] of Object.entries(TX_SERVICE)) {
  await check(`tx-service/${short} (${id}) /about`, async () => {
    const res = await fetch(`https://api.safe.global/tx-service/${short}/api/v1/about/`, { signal: AbortSignal.timeout(20_000) })
    if (res.status === 429 || res.status >= 500) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
    assert(res.ok, `HTTP ${res.status}`)
    const body = (await res.json()) as { name?: string; version?: string }
    assert(body.name === "Safe Transaction Service", `unexpected body ${JSON.stringify(body).slice(0, 120)}`)
    return `v${body.version}`
  })
}

// ---- 4: API Kit network list (no network calls) ----
console.log("API Kit")
for (const id of Object.values(TX_SERVICE)) {
  await check(`SafeApiKit chainId ${id}`, () => { new SafeApiKit({ chainId: BigInt(id), apiKey: "placeholder" }); return "constructs" })
}
await check("SafeApiKit 4801 has no Transaction Service", () => {
  try { new SafeApiKit({ chainId: 4801n, apiKey: "placeholder" }) } catch (e) {
    assert(/Network with chainId 4801 not found/.test((e as Error).message), (e as Error).message); return "throws as errors.md says"
  }
  throw new Error("constructed; chains.md and errors.md #2 say World Chain Sepolia has no Transaction Service")
})
await check("SafeApiKit without apiKey", () => {
  try { new SafeApiKit({ chainId: 11155111n }) } catch (e) {
    assert(/apiKey is mandatory/.test((e as Error).message), (e as Error).message); return "throws as errors.md says"
  }
  throw new Error("constructed without apiKey; errors.md #1 says it throws")
})

// ---- 5: Safe4337Pack on World Chain Sepolia (keyless public bundler, never sent) ----
console.log("Safe4337Pack (World Chain Sepolia, customContracts)")
await check("createTransaction + signSafeOperation", async () => {
  const key = generatePrivateKey(), owner = privateKeyToAccount(key)
  const pack = await Safe4337Pack.init({
    provider: worldchainSepolia.rpcUrls.default.http[0],
    signer: key,
    bundlerUrl: `https://public.pimlico.io/v2/${worldchainSepolia.id}/rpc?add_balance_override`,
    safeModulesVersion: "0.3.0",
    customContracts: { safe4337ModuleAddress: CONTRACTS["Safe4337Module 0.3.0"], safeModulesSetupAddress: CONTRACTS["SafeModuleSetup 0.3.0"] },
    options: { owners: [owner.address], threshold: 1 },
  })
  const op = await pack.createTransaction({ transactions: [{ to: owner.address, value: "0", data: "0x" }, { to: owner.address, value: "0", data: "0x" }] })
  const signed = await pack.signSafeOperation(op)
  assert(op.userOperation.callGasLimit > 0n, "no callGasLimit")
  assert(signed.signatures.size === 1, `expected 1 signature, got ${signed.signatures.size}`)
  return `safe ${await pack.protocolKit.getAddress()} callGasLimit ${op.userOperation.callGasLimit}`
})

if (failures.length) { console.log(`\n${failures.length} live check(s) failed: ${failures.join(", ")}`); process.exit(1) }
if (networkProblems) { console.log(`\n${networkProblems} check(s) could not reach a service`); process.exit(NETWORK) }
console.log("\nall live checks passed")
