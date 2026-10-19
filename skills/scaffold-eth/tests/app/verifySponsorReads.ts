// Copied into packages/hardhat/scripts/ by build.mjs and run with `hardhat run`. Read-only: connects to every network
// named in VERIFY_NETWORKS (from the skill's recipe 4c) and checks the chain ID. Exit 75 if an RPC is unreachable.
import { network } from "hardhat";

const expected: Record<string, number> = JSON.parse(process.env.VERIFY_NETWORKS || "{}");
let unreachable = 0, wrong = 0;
for (const [name, id] of Object.entries(expected)) {
  try {
    const { ethers } = await network.connect({ network: name });
    const [net, block] = await Promise.all([ethers.provider.getNetwork(), ethers.provider.getBlockNumber()]);
    const ok = Number(net.chainId) === id;
    if (!ok) wrong++;
    console.log(`${ok ? "OK" : "WRONG"} ${name} chainId ${net.chainId} (expected ${id}) block ${block}`);
  } catch (e) {
    unreachable++;
    console.log(`UNREACHABLE ${name}: ${String((e as Error).message).split("\n")[0]}`);
  }
}
process.exit(wrong ? 1 : unreachable ? 75 : 0);
