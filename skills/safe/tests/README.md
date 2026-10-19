# safe skill tests

Run from the repo root: `node scripts/verify.mjs safe` (`--full` adds nothing: no build step for this skill).
Pinned: @safe-global/protocol-kit 8.0.8, api-kit 5.0.4, relay-kit 6.1.2, types-kit 4.0.1, safe-apps-sdk 9.1.0,
safe-apps-provider 0.18.6, viem 2.57.7, wagmi 3.7.7, @tanstack/react-query 5.104.4, react 19.3.1, dotenv 17.2.3;
dev typescript 7.0.2, tsx, @types/node.

## typecheck

`prep-blocks.mjs` then `tsc -p .` (strict, DOM lib for the Safe App / wagmi recipes) over every ts block from SKILL.md
and references/*.md plus `live.ts`. The one fragment, recipe 5's bare `customContracts: { ... }` property, is wrapped by
`prep-blocks.mjs` in an object typed as `Pick<Parameters<typeof Safe4337Pack.init>[0], "customContracts">`, so it is
checked against relay-kit's real option type. No `verify:skip` lines are used.

## live (`live.ts`, no keys, nothing sent)

- Protocol Kit predicts recipe 1's 2-of-3 Safe 1.4.1 (saltNonce 42) on Sepolia, World Chain Sepolia (4801), Unichain
  Sepolia (1301), Arc Testnet (5042002) and Whitechain Sepolia (1874): same address everywhere, not deployed; each
  public RPC's chain id matches viem.
- `eth_getCode` on those chains for SafeL2 1.4.1, SafeProxyFactory 1.4.1, MultiSendCallOnly 1.4.1, Safe4337Module
  0.3.0, SafeModuleSetup 0.3.0, EntryPoint 0.7 (the addresses in references/chains.md).
- Transaction Service `GET https://api.safe.global/tx-service/<shortName>/api/v1/about/` (keyless) for `sep`, `wc`,
  `unichain`, `arc`, `arc-testnet`, `0g`, `wch-sepolia`.
- API Kit offline: constructs for those chain ids; throws `Network with chainId 4801 not found` and
  `apiKey is mandatory ...` as errors.md says.
- Safe4337Pack (recipe 5) with `safeModulesVersion: "0.3.0"` + `customContracts` on World Chain Sepolia builds and
  signs a 2-call user operation, gas estimated by Pimlico's keyless public bundler. Never sent.

Network failures (DNS, timeout, 429, 5xx) exit 75 and show as "network".

## Not checked

- Deploying a Safe, proposing/confirming/executing transactions, API Kit reads with a real key (recipes 2, 7),
  sponsored user operations (need a Pimlico key), Safe App code inside the Safe{Wallet} iframe, wagmi `safe()`
  connector connecting: type-check only.
- 0G, Hedera and Whitechain L1 rows of chains.md, and mainnet contract code (only the Tx Service /about for mainnets).
