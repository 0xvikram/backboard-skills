# agentkit skill tests

Run from the repo root: `node scripts/verify.mjs agentkit` (add `--full` for the Next.js build).
Pinned (the set the skill tells users to install): @coinbase/agentkit 0.10.4, agentkit-langchain 0.3.0,
agentkit-vercel-ai-sdk 0.1.0, agentkit-model-context-protocol 0.2.0, @langchain/core 0.3.80, @langchain/langgraph
0.4.10, @langchain/openai 0.6.17, ai 4.3.19, @ai-sdk/openai 1.3.24, @modelcontextprotocol/sdk 1.32.1, viem 2.38.3,
zod 3.25.76, dotenv 17.2.3; for the route recipe next 16.4.2, react/react-dom 19.3.1; dev typescript 5.9.3,
@types/node 22, @types/react(-dom) 19.3.0.

## typecheck

`tsc -p .` (strict, experimentalDecorators + emitDecoratorMetadata, allowJs + checkJs) over every ts/js block from
SKILL.md and references/*.md, plus `live.ts`. Module resolution is `bundler` so the Next.js route block's
`next/server` import resolves as it does inside a Next app. The `next.config.js` block is checked against its
`import('next').NextConfig` JSDoc type. No `verify:skip` lines are used.

## live (`live.ts`, no CDP/OpenAI keys, nothing sent)

`npm run live` compiles live.ts and the blocks with tsc (the decorator recipe needs emitted decorator metadata, which
tsx doesn't produce: errors.md #3) and runs `node --import ./block-analytics.mjs build/live.js`. `block-analytics.mjs`
answers every fetch to `*.coinbase.com` locally (AgentKit's analytics to cca-lite.coinbase.com, errors.md #8), and the
last check fails if it caught none, so a change in how AgentKit sends them is noticed.
- The skill's "other chains" recipe (ViemWalletProvider + defineChain) runs as written with a throwaway `PRIVATE_KEY`;
  its chain definitions are reused below. The `customActionProvider` and `@CreateAction` class blocks are imported too.
- On World Chain Sepolia, Unichain Sepolia, Arc Testnet, 0G Galileo, Whitechain Sepolia, Hedera Testnet (+multicall3):
  RPC chain id, multicall3 code, `AgentKit.from` with a fresh random key, `get_wallet_details` reads address and zero
  balance over the public RPC, the custom signing action signs, the decorator actions are registered.
- Arc Testnet: ERC-20 `get_balance` of USDC `0x3600…0000` works with multicall3.
- World Chain Sepolia: `getLangChainTools`, `getVercelAITools`, `getMcpTools` each give one tool per action; the MCP
  `toolHandler` runs `get_wallet_details`.

Blocks are found by content, not number, so editing the skill doesn't break the lookup.

## build (`--full`)

`app/prepare.mjs` copies the skill's `next.config.js` block (with the `serverExternalPackages` fix) and its App Router
route block (`app/api/agent/route.ts`, Vercel AI SDK + CdpEvmWalletProvider) verbatim into the minimal Next.js 16 app
in `app/`, then `next build` runs (Turbopack, includes Next's own type-check). Building does not call CDP or OpenAI.

## Not checked

- Anything needing CDP or OpenAI keys: CdpEvmWalletProvider wallets, faucet claims, swaps, LLM calls, the quickstart
  chat loop, the MCP server over stdio, transactions on any chain. Those blocks are type-checked only (and the route
  is built).
- `create-onchain-agent` scaffolding (interactive), Claude/Cursor MCP config, Python AgentKit.
