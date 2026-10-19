Original log from 2026-10-19; current checks: see README.md

# TESTED: agentkit (2026-10-19)

This is the reviewer's test log. It is not part of the skill.
Test root: `scratchpad/deep/_test/agentkit/`. Node v24.21.0, TypeScript 5.9.3, macOS.

## Versions installed (app/)

`npm i @coinbase/agentkit@0.10.4 @coinbase/agentkit-langchain@0.3.0 @coinbase/agentkit-vercel-ai-sdk@0.1.0 @coinbase/agentkit-model-context-protocol@0.2.0 @langchain/core@0.3.80 @langchain/langgraph@0.4.10 @langchain/openai@0.6.17 ai@4.3.19 @ai-sdk/openai@1.3.24 @modelcontextprotocol/sdk@1.32.1 viem@2.38.3 zod@3.25.76 dotenv@17.2.3`, dev: `typescript@5.9.3 tsx@4.23.15 @types/node@22`.
`npm ls` showed a single @langchain/core (0.3.80), zod (3.25.76) and top-level viem (2.38.3).

## Key findings before testing

- The AgentKit pages are gone from docs.cdp.coinbase.com: llms.txt, docs.txt, sdks.txt and llms-full.txt have no AgentKit pages (one stale card link), and `/agentkit/docs/welcome(.md)`, `/agent-kit/welcome.md` and `/agent-kit/support/faq.md` return 404. So the skill cites the GitHub README/source (pinned to the 0.10.4 release commit `433bdc2`), the npm package README, and the CDP docs only for keys, faucet and docs MCP.
- npm latest: agentkit 0.10.4 (2025-12-19), agentkit-langchain 0.3.0 / vercel-ai-sdk 0.1.0 / mcp 0.2.0 (all 2025-03-07), create-onchain-agent 0.5.7. GitHub `main` has agentkit 0.11.0 + LangChain 1 / AI SDK 6 / zod 4, **unpublished**. The repo is active (last push 2026-10-14) and not archived.

## Type-checks (strict, NodeNext, experimentalDecorators + emitDecoratorMetadata, skipLibCheck)

1. `app/src/*.ts` (quickstart, vercel, mcp-server, custom-action, viem-custom-chain, faucet) + `app/runtime/*.ts`: `npx tsc -p .` **PASS**.
2. Every ```ts block in SKILL.md, quickstart.md, recipes.md and mcp.md (11 blocks), extracted by `scripts/extract.py` into `app/fromdocs/`: `npx tsc -p tsconfig.docs.json` **PASS** (the first run failed on the LangChain stream loop; it was rewritten to `streamMode: "values"` and passes now).
3. The Next.js route recipe (recipes.md #4) was put into the scaffolded Next app as `app/api/skilltest/route.ts`: `tsc` **PASS**, `next build` **PASS** (with the next.config fix).

## Runtime (no API keys, no transactions, analytics blocked)

AgentKit POSTs analytics to `cca-lite.coinbase.com`. Every run used `node --import ./runtime/block-analytics.mjs`, which answers those requests locally (25 blocked in the last run), so no data was sent to Coinbase. The only outbound traffic was public-RPC reads (`eth_chainId`, `eth_getBalance`, `eth_call`, `eth_getCode`).

- `runtime/run-viem.ts` (compiled with tsc): `ViemWalletProvider` + a random key on Unichain Sepolia, World Chain Sepolia, Arc Testnet (defineChain), 0G Galileo 16602 (defineChain), Whitechain Sepolia 1874 (defineChain), Hedera Testnet (+multicall3):
  - `get_wallet_details` returned the address and 0 balance on all 6 **PASS**. `networkId` is undefined; the weth provider is dropped with a warning.
  - The decorator class (`CounterActionProvider`) loaded, and the `customActionProvider` signing action ran on all 6 **PASS**.
  - `request_faucet_funds` without CDP keys gave `Faucet requires CDP_API_KEY_ID and CDP_API_KEY_SECRET...` (expected).
  - `getLangChainTools` → 13, `getVercelAITools` → 13, `getMcpTools` → 13 tools; the MCP `toolHandler("WalletActionProvider_get_wallet_details")` returned the details **PASS**.
- `runtime/run-erc20.ts`: ERC-20 `get_balance` of Arc USDC `0x3600…0000`: with multicall3 it returned "Balance ... is 0" **PASS**; without it, `Could not fetch token details` (confirms errors.md #9).
- RPC checks: World Sepolia 4801, Unichain Sepolia 1301, Hedera testnet 296, Arc 5042002, 0G 16602, `rpc.testnet.whitechain.io` = 1874 (`rpc-testnet.whitechain.io` = 2625, outdated). multicall3 code is present on all six (Whitechain checked on the 1874 RPC).
- Quickstart (`src/quickstart.ts` via tsx) without keys threw `Missing required environment variables...` before any network call (expected).

## Reproduced gotchas (errors.md)

- #1: in `latest/` with --legacy-peer-deps (langgraph 1.5.1, @langchain/core 1.2.18, ai 7.0.143, zod 4.6.7, viem 2.57.7), tsc gave TS2322 (LangChain tools), TS2353 `maxSteps`, TS2740 (zod 4 schemas), TS2345 (viem). Plain `npm i` with ai@7 gives ERESOLVE.
- #3: tsx run of the decorator class gave `Failed to get parameters for action method increment on class CounterActionProvider`.
- #4: `cdpApiActionProvider({...})` gives TS2554; `new AgentKit(...)` gives TS2673.
- #5: the scaffolded Next app's `next build` failed (`TypeError: X is not a function`). The PR #1024 config then failed with `r.PublicKey is not a constructor`. `serverExternalPackages: ["@coinbase/agentkit", "@coinbase/agentkit-langchain", "@coinbase/agentkit-vercel-ai-sdk"]` built successfully. NEXT_TELEMETRY_DISABLED=1 was set for all builds.

## Scaffolder

`npx -y create-onchain-agent@0.5.7` was driven through a pty (`scripts/drive.py`):
- LangChain / EVM / Testnet / base-sepolia / CDPEvmWallet → Next app in `scaffold2/`: npm install, tsc PASS, build PASS after the fix.
- Model Context Protocol / EVM / Testnet / base-sepolia → `scaffold-mcp/`: install, tsc, `npm run build` PASS. Run without keys, it gives the missing-env error.

The prompt order was recorded from the real run. (An earlier mis-keyed run left `scaffold/onchain-agent`. A safety check blocked deleting it, so it is still there and unused.)

## NOT tested

- Anything with real CDP or OpenAI keys: CDP wallet creation, faucet claims, swaps, LLM calls, actual agent conversations, transactions on any chain.
- `claude mcp add` / Cursor config with the AgentKit server, and the CDP Docs MCP URL. The commands come from `claude mcp add --help` and the CDP docs page.
- The Python AgentKit. Issue #1485 (broken fresh install) is cited, not reproduced.
- Privy / ZeroDev / Smart Wallet providers, Solana, and DeFi action providers.

## Doubts for the reviewer

- The AgentKit docs removal from docs.cdp.coinbase.com: is it permanent? If Coinbase restores the pages, the "docs live on GitHub" wording needs an update.
- If AgentKit 0.11.0 is published before the event, most pins (LangChain 0.3, AI SDK 4, zod 3, viem 2.38.3) and errors #1/#2/#8 change. Re-check with `npm view @coinbase/agentkit version`.
- The faucet limits table comes from the CDP faucet page and may change.
- The "may help with" tracks list (0G, Arc, Hedera, World, Uniswap Foundation) is a judgment call. No prize rules were stated.
