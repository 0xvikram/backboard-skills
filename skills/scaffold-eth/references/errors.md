# Scaffold-ETH 2 errors and gotchas

Every item below was reproduced or checked on a `create-eth@2.0.23` project on 2026-10-19, unless it says otherwise.

## 1. `Create-eth requirements not met: Yarn is not installed`

**Cause:** create-eth checks for a `yarn` binary before it does anything.
**Fix:** `corepack enable` or `npm i -g yarn`. Any version works, because the generated project runs its own Yarn 4.13 through `.yarnrc.yml` → `yarnPath`.
Source: https://github.com/scaffold-eth/create-eth/blob/main/src/utils/system-validation.ts

## 2. `FoundryValidationError: Could not parse foundry version` / `Foundry version is older than required`

**Cause:** `-s foundry` needs `forge` >= 1.4.0 on your PATH, and the check runs even with `--skip-install`.
**Fix:** install or update Foundry (https://getfoundry.sh/introduction/installation, then `foundryup`), or use `-s hardhat`.
Source: create-eth 2.0.23 `dist/cli.js` (`REQUIRED_FOUNDRY_VERSION = "1.4.0"`), https://docs.scaffoldeth.io/quick-start/installation

## 3. `Error HHE15: Invalid config: config.networks.<name>.type: Invalid discriminator value. Expected 'http' | 'edr-simulated'`

**Cause:** the Hardhat flavour is now Hardhat 3, and every network needs a `type`. The docs snippet at https://docs.scaffoldeth.io/deploying/deploy-smart-contracts still shows the Hardhat 2 shape without it.
**Fix:** `myChain: { type: "http", url: "https://...", accounts: [deployerPrivateKey] }`.
Source: https://hardhat.org/HHE15, https://hardhat.org/docs/reference/configuration

## 4. Arc testnet calls fail (`HTTP request failed`) or Arc mainnet has no RPC

**Cause:** the template pins viem 2.53.1. Its `arcTestnet` default RPC `https://rpc.testnet.arc.network` did not answer on 2026-10-19, and its `arc` (5042) chain has an empty RPC list. viem 2.57.7 has the new `*.arc.io` URLs, but the template does not use that version.
**Fix:** in `scaffold.config.ts` add `rpcOverrides: { [chains.arcTestnet.id]: "https://rpc.testnet.arc.io" }`. For mainnet use a `defineChain` with `https://rpc.mainnet.arc.io` (recipes.md 4b). In Hardhat or Foundry configs use the `.arc.io` URLs.
Source: https://docs.arc.io/arc/references/rpc-endpoints.md

## 5. `Type '"WETH"' is not assignable to type '"YourContract"'` (or a function name is rejected)

**Cause:** scaffold hook types come only from the contracts declared for `targetNetworks[0]` in `scaffold.config.ts`. Passing `chainId` does not change the types.
**Fix:** put the chain that holds the contract first in `targetNetworks`, declare the contract under that chain ID in `externalContracts.ts`, or use wagmi `useReadContract` with an explicit `address`, `abi` and `chainId` (recipes.md 6).
**Related:** if `targetNetworks[0]` has **no** contracts at all, types fall back to a loose generic and any name compiles. At runtime you then get `Target Contract is not deployed, did you forget to run yarn deploy?`, or the Debug page shows `No contract found by the name of X on chain Y`. Deploy to that chain, or put the chain where it is deployed first.
Source: https://github.com/scaffold-eth/scaffold-eth-2/blob/main/packages/nextjs/utils/scaffold-eth/contract.ts, https://docs.scaffoldeth.io/external-contracts

## 6. `useScaffoldEventHistory.ts: Argument of type '{}' is not assignable to parameter of type 'string | number | bigint | boolean'`

**Cause:** this error comes from the template's own hook file. It appears when every contract declared for `targetNetworks[0]` is an external contract without `deployedOnBlock`.
**Fix:** add `deployedOnBlock: <block number>` to the external contract entry. That number is also where event scans start.
Source: https://github.com/scaffold-eth/scaffold-eth-2/blob/main/packages/nextjs/hooks/scaffold-eth/useScaffoldEventHistory.ts

## 7. Event history is empty and the console shows HTTP 400 `You can make eth_getLogs requests with up to a 100 block range`

**Cause:** `useScaffoldEventHistory` fetches 500 blocks per request by default. The public World Chain Sepolia RPC used by viem (`worldchain-sepolia.g.alchemy.com/public`) caps `eth_getLogs` at 100 blocks. The hook shows no events instead of failing loudly. Arc's RPC caps log ranges at 10,000 blocks.
**Fix:** pass `blocksBatchSize: 100`, set a recent `fromBlock` (or `deployedOnBlock`), or use your own RPC key through `rpcOverrides`.
Source: https://docs.scaffoldeth.io/hooks/useScaffoldEventHistory, https://docs.arc.io/arc/references/rpc-endpoints.md

## 8. `ProviderError: gas required exceeds allowance (0)` on `yarn deploy --network <testnet>`

**Cause:** the deployer account has no gas token on that chain. (`🚫️ You don't have a deployer account` means you have not run `yarn generate` or `yarn account:import` yet.)
**Fix:** run `yarn account` to see the address and the balance on every configured network, then fund it from the chain's faucet. Arc uses USDC for gas (https://faucet.circle.com).
Source: https://docs.scaffoldeth.io/deploying/deploy-smart-contracts

## 9. `yarn hardhat:check-types` fails with TS2344 errors in `rocketh/deploy.ts` and `rocketh/environment.ts`

**Cause:** a fresh create-eth 2.0.23 Hardhat project already has this error, from version drift between `rocketh` 0.19.20 and `@rocketh/deploy` 0.19.22. It is not caused by your code.
**Fix:** none needed for a hackathon. `yarn deploy` (which runs through tsx) works. Do not let it block you. Check for a newer create-eth.
Source: reproduced on a clean project; report at https://github.com/scaffold-eth/scaffold-eth-2/issues

## 10. The burner wallet disappears after adding a testnet

**Cause:** with `burnerWalletMode: "localNetworksOnly"` (the default), the burner shows only while every target network is `hardhat`. The docs still describe the older `onlyLocalBurnerWallet` and `walletAutoConnect` options, which are gone from `scaffold.config.ts`.
**Fix:** use MetaMask or another wallet on testnets, or set `burnerWalletMode: "allNetworks"` and fund the burner yourself.
Source: generated `packages/nextjs/services/web3/wagmiConnectors.tsx`; docs at https://docs.scaffoldeth.io/deploying/deploy-nextjs-app

## 11. Vercel build fails on lint or type errors

**Cause:** `yarn build` runs `yarn lint && next build`, and Vercel stops on any error.
**Fix:** run `yarn next:build` locally first. As a last resort use `yarn vercel:yolo --prod`, or set `NEXT_PUBLIC_IGNORE_BUILD_ERROR=true` in Vercel. Prettier *warnings* do not fail the build.
Source: https://docs.scaffoldeth.io/disable-type-linting-error-checks

## 12. `-e` flag: only one extension, only at creation

**Cause:** create-eth parses `--extension` as a single string, and extensions are copied in only when the project is created.
**Fix:** choose one extension. For more features, use the skills in `.agents/skills/` in the project.
Source: https://docs.scaffoldeth.io/extensions/howToInstall

## 13. Node version

The docs ask for Node >= 20.18.3, but the generated `package.json` sets `"engines": { "node": ">=22.10.0" }`. Use Node 22 or newer. (Tested on Node 24.21.0.)
