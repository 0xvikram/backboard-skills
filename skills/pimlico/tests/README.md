# pimlico skill tests

Run from the repo root: `node scripts/verify.mjs pimlico` (add `--full` for builds; this skill has none).
Pinned: permissionless 0.5.0, viem 2.57.7, dotenv 17.2.3; dev typescript 7.0.2, tsx, @types/node.

## typecheck

`prep-blocks.mjs` then `tsc -p .` (strict) over every ts block from SKILL.md and references/*.md (written to `blocks/`
by the runner) plus `live.ts` and `prelude.ts`.

Four recipe blocks are fragments that continue the setup block at the top of references/recipes.md (they use
`smartAccountClient`, `pimlicoClient`, `publicClient` without creating them): send/contract call, per-call paymaster,
batched calls, sponsorship policy. `prep-blocks.mjs` puts `prelude.ts` (that setup block) in front of any block that
uses those names without importing permissionless itself, so the fragments are checked the way a user would paste
them. The sponsorship-policy fragment makes its own `smartAccountClient`, so it gets the prelude without that part.
No `verify:skip` lines are used.

## live (`live.ts`, no API key, nothing sent)

Against Pimlico's keyless public bundler `https://public.pimlico.io/v2/<chainId>/rpc` and viem's default public RPCs,
with a throwaway owner key generated at runtime, on World Chain Sepolia (4801), Unichain Sepolia (1301), Arc Testnet
(5042002):
- RPC chain id matches viem and the skill's table
- bundler `eth_supportedEntryPoints` includes EntryPoint 0.7; `getUserOperationGasPrice` returns prices
- counterfactual address prediction for Safe 1.4.1 and Simple Account (all three chains) and Kernel 0.3.1 (Unichain
  Sepolia only; the docs table says no Kernel 0.3.x on World Chain Sepolia and Arc): non-zero and stable
- `prepareUserOperation` with two batched calls (raw call + typed ERC-20 approve, incl. account deployment) passes the
  bundler's gas estimation, using a balance `stateOverride` because the account is empty

Network failures (DNS, timeout, 429, 5xx) exit 75 and show as "network", not as a failure.

## Not checked

- Anything sponsored by the paymaster (needs a Pimlico API key; the keyless endpoint asks for a sponsorship policy),
  ERC-20 paymaster sends, sponsorship policies, actually sending a user operation, browser-wallet owners: type-check only.
- Mainnets (480, 130, 5042), Pimlico CLI / MCP server.
