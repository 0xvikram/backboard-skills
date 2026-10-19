# AgentKit errors and gotchas

Checked 2026-10-19 against @coinbase/agentkit@0.10.4. "Tested" means we reproduced it ourselves.

## 1. LangChain / AI SDK / zod version mismatch (tested)

The plugin packages on npm are a year older than their frameworks:
- `@coinbase/agentkit-langchain@0.3.0` depends on `@langchain/core@^0.3`. With `@langchain/langgraph@1.x`: `TS2322: Type 'StructuredTool<...>[]' is not assignable to type 'ToolNode<any> | (ServerTool | ClientTool)[]'`.
- `@coinbase/agentkit-vercel-ai-sdk@0.1.0` has the peer dependency `ai@^4.1.16`. With `ai@7`: `npm error ERESOLVE ... peer ai@"^4.1.16"`. With `--legacy-peer-deps`: `'maxSteps' does not exist`.
- `@coinbase/agentkit@0.10.4` uses zod 3. A zod 4 schema in a custom action fails with `TS2740: Type 'ZodObject<...>' is missing the following properties from type 'ZodType<any, ZodTypeDef, any>': _type, _parse, ...`.

**Fix:** use the pins from quickstart.md (`@langchain/core@0.3.80`, `@langchain/langgraph@0.4.10`, `@langchain/openai@0.6.17`, `ai@4.3.19`, `@ai-sdk/openai@1.3.24`, `zod@3.25.76`). GitHub `main` has already moved to LangChain 1 / AI SDK 6 / zod 4 (`agentkit` 0.11.0), but that is **not on npm** as of 19 Oct 2026. Check `npm view @coinbase/agentkit-langchain version` before you follow `main`.
Source: `npm view @coinbase/agentkit-langchain dependencies`; repo commit "Upgrade ts frameworks to Langchain v1 and vercel ai sdk v6" (#1021).

## 2. `TS2345 ... Property 'tokens' is missing in type 'Client'` on `new ViemWalletProvider(client)` (tested)

AgentKit 0.10.4 pins `viem` to exactly `2.38.3`. A newer viem in your project gives you two viem copies whose types don't match.
**Fix:** `npm i viem@2.38.3`. Define the chains viem 2.38.3 lacks with `defineChain` (recipes.md #7). A cast (`client as any`) also works, but hides real errors.
Source: https://github.com/coinbase/agentkit/issues/1532

## 3. `Error: Failed to get parameters for action method <name> on class <Class>` (tested)

`@CreateAction` reads TypeScript's `design:paramtypes` metadata. tsx, esbuild, Vite, Next.js (SWC) and Bun don't emit it, so the class throws as soon as it loads.
**Fix:** compile with `tsc` with `"experimentalDecorators": true, "emitDecoratorMetadata": true`, or write the action with `customActionProvider({ name, description, schema, invoke })`, which needs no decorators (recipes.md #5).
Source: `actionDecorator.ts` https://github.com/coinbase/agentkit/blob/433bdc262038eca2bea923d87dc26f8fb76337d9/typescript/agentkit/src/action-providers/actionDecorator.ts

## 4. README snippets that don't compile on 0.10.4 (tested)

- `cdpApiActionProvider({ apiKeyId, apiKeySecret })` gives `TS2554: Expected 0 arguments, but got 1.` Call `cdpApiActionProvider()`. It uses the CDP wallet's client or the `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` env vars.
- `new AgentKit({...})` gives `TS2673: Constructor of class 'AgentKit' is private`. Use `await AgentKit.from({...})`.
- `AgentKit.from({ cdpApiKeyId, cdpApiKeySecret })` without a wallet secret throws `cdpApiKeyId and cdpApiKeySecret are required if not providing a walletProvider`: it also needs `cdpWalletSecret`, and it then creates a **CDP Smart Wallet**. Pass an explicit `walletProvider` instead.
- `CdpWalletProvider` / `apiKeyPrivate` in old examples is the legacy v1 API (`LegacyCdpWalletProvider`). Use `CdpEvmWalletProvider` with `apiKeyId`, `apiKeySecret`, `walletSecret`.
Source: the 0.10.4 README in `node_modules/@coinbase/agentkit/README.md` vs. its `dist/*.d.ts`.

## 5. Next.js build: `Failed to collect page data for /api/agent` / `TypeError: X is not a function` (tested)

The create-onchain-agent Next.js template (Next 16) fails `next build` while bundling AgentKit's crypto dependencies.
**Fix:** add `serverExternalPackages: ["@coinbase/agentkit", "@coinbase/agentkit-langchain", "@coinbase/agentkit-vercel-ai-sdk"]` to `next.config.js` (recipes.md #1). The narrower list in the open PR #1024 (`@noble/hashes`, `@noble/curves`, `@scure/bip39`, `@scure/bip32`) still failed for us with `r.PublicKey is not a constructor`.
Source: https://github.com/coinbase/agentkit/issues/929 · https://github.com/coinbase/agentkit/pull/1024

## 6. `Missing required environment variables. CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET are required.` (tested)

`CdpEvmWalletProvider.configureWithWallet` needs all three. The create-onchain-agent template writes `.env.local`. Rename it to `.env` (`mv .env.local .env`) for the dotenv-based examples, or keep `.env.local` with Next.js. The Wallet Secret is separate from the API key: generate it at https://portal.cdp.coinbase.com/wallets/non-custodial/security.
Related: without `address`, every run creates a **new** wallet, and your funded one seems "empty". Save `walletProvider.getAddress()` and pass it as `address`.
Source: https://docs.cdp.coinbase.com/wallets/quickstart/api-key-auth

## 7. `Unsupported network for CDP SDK: <networkId>` / faucet `only supported on base-sepolia or ethereum-sepolia`

`CdpEvmWalletProvider` can send only on `base-sepolia`, `base-mainnet`, `ethereum-mainnet`, `ethereum-sepolia`, `polygon-mainnet`, `arbitrum-mainnet`, `optimism-mainnet`. The scaffolder offers `arbitrum-sepolia`, `optimism-sepolia` and `polygon-mumbai` only with Viem/Privy, and `polygon-mumbai` is a dead testnet. The faucet works only on Base Sepolia, Ethereum Sepolia and Solana Devnet.
**Fix:** for any other chain (including all ETHGlobal Mumbai sponsor chains) use `ViemWalletProvider` (recipes.md #7) and that chain's own faucet.
Source: `cdpEvmWalletProvider.ts` `getCdpSdkNetwork()` and `faucetUtils.ts` at https://github.com/coinbase/agentkit/tree/433bdc262038eca2bea923d87dc26f8fb76337d9/typescript/agentkit/src

## 8. Process exits after the wallet is created or on the first action (analytics)

AgentKit POSTs analytics (event, wallet address, chain, action name) to `https://cca-lite.coinbase.com/amp` when a wallet provider is created and on every action call. In 0.10.4 a failed request (offline, firewall, HTTP 400) is an unhandled promise rejection, and Node exits. There is no opt-out flag.
**Fix:** allow outbound HTTPS to `cca-lite.coinbase.com`, or add `process.on("unhandledRejection", (e) => console.warn(e))` at startup. A partial fix (#1408) is on `main`, not on npm.
Source: https://github.com/coinbase/agentkit/issues/1531 · `sendAnalyticsEvent.ts`

## 9. ERC-20 actions: `Could not fetch token details for 0x...` on custom chains (tested)

`get_balance`, `transfer`, `approve` and `get_allowance` read token data with viem `multicall`. A chain object without `contracts.multicall3` makes every call fail, and the message hides the real reason.
**Fix:** add `contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } }` to the chain (deployed on all sponsor testnets, checked 19 Oct 2026). viem's `hederaTestnet` and `zeroG*` definitions lack it.
Source: https://github.com/coinbase/agentkit/issues/1533

## 10. ERC-20 transfer reports the wrong result: be careful with retries

Open issues: `transfer` can report success when the tx reverted (#1558), or report an error when only the receipt lookup failed, so the agent pays twice (#1547). `CdpEvmWalletProvider.sendTransaction` sends no idempotency key, so a retry can double-send (#1483).
**Fix:** check the tx hash on the explorer before retrying a payment. Tell the agent in its prompt never to retry a transfer without checking, and keep test-sized balances.
Source: https://github.com/coinbase/agentkit/issues/1558 · https://github.com/coinbase/agentkit/issues/1547 · https://github.com/coinbase/agentkit/issues/1483
