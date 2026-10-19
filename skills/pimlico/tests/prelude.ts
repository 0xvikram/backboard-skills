// Shared setup that the skill's short recipe fragments assume is already in the file (it is the setup block at the top
// of references/recipes.md). prep-blocks.mjs puts this in front of any block that uses `smartAccountClient` /
// `pimlicoClient` without importing permissionless itself. Not a test on its own.
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
// @smartAccountClient
const smartAccountClient = createSmartAccountClient({
  account,
  chain: sepolia,
  bundlerTransport: http(pimlicoUrl),
  paymaster: pimlicoClient,
  userOperation: {
    estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
  },
})
// @end
