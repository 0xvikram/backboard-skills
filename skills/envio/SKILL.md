---
name: envio
description: "Envio HyperIndex (multichain EVM indexer: config.yaml, schema.graphql, TypeScript handlers, GraphQL API) and HyperSync (fast raw logs/blocks/transactions API). Use for envio init, contract import, indexer.onEvent handlers, envio codegen / envio dev, Hasura GraphQL queries, Envio Cloud deploys, factory contracts, HyperSync client queries, and which chains (Arc, Unichain, World Chain, Hedera, 0G) have HyperSync or need an RPC."
license: MIT
metadata:
  category: "Data & storage"
  website: "https://envio.dev"
  source: "tested"
  tested: "2026-10-19"
  packages: "envio@3.14.0, @envio-dev/hypersync-client@1.4.1, viem@2.57.7, typescript@6.0.3, vitest@4.1.0"
---

# Envio (HyperIndex / HyperSync)

**HyperIndex** turns contract events into Postgres tables with a GraphQL API (Hasura). You write `config.yaml`, `schema.graphql` and TypeScript handlers. **HyperSync** is the data engine underneath it. You can also query it directly from Node for raw logs, transactions and blocks, much faster than `eth_getLogs`.
Pick it when your app needs feeds, leaderboards, balances or history over events, or the same contract on several chains. To read one value from one contract, plain viem `readContract` is simpler. This skill covers **HyperIndex V3**. Code written for V2 (`import { X } from "generated"`, `networks:`, `rpc_config:`) does not compile on V3.

## Quickstart

1. Get Node **22.15+**. To run the indexer locally you also need Docker Desktop (or Podman) **running**.
2. Get a free HyperSync token at https://envio.dev/app/api-tokens (sign in with GitHub, expand **Free package**, name it, click **Create**). HyperSync chains need it. RPC-only chains do not.
3. Scaffold without prompts from a local ABI. Arc testnet has HyperSync. Leave out the flags to get the interactive wizard (`npx envio@3.14.0 init`):
   ```sh
   npx envio@3.14.0 init contract-import local -a ./abis/Vault.json --contract-name Vault \
     -b 5042002 -c <CONTRACT_ADDRESS> -s <DEPLOY_BLOCK> --single-contract --all-events \
     -n vault-indexer -d vault-indexer -l typescript --package-manager npm --api-token <YOUR_ENVIO_API_TOKEN>
   ```
   This writes `config.yaml`, `schema.graphql`, `src/handlers/Vault.ts`, a test, `.env` (with `ENVIO_API_TOKEN`) and Claude skills in `.claude/skills/`. It also runs `npm install` and `git init`.
4. Shape your entities in `schema.graphql`, for example `type Account { id: ID! balance: BigInt! deposits: [Deposit!]! @derivedFrom(field: "account") }`.
5. Write handlers with the V3 `indexer` API:
   ```ts
   import { indexer } from "envio";

   indexer.onEvent(
     { contract: "Vault", event: "Deposit", fields: { transaction: ["hash"], block: ["timestamp"] } },
     async ({ event, context }) => {
       const account = await context.Account.getOrCreate({ id: event.params.user, balance: 0n, depositCount: 0 });
       context.Account.set({ ...account, balance: account.balance + event.params.amount, depositCount: account.depositCount + 1 });
       context.Deposit.set({
         id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
         account_id: event.params.user, // relations are set as <field>_id
         amount: event.params.amount,
         timestamp: event.block.timestamp,
         txHash: event.transaction.hash,
       });
     },
   );
   ```
6. Regenerate types and check them: `npx envio codegen && npx tsc --noEmit`. Then test without any chain or Docker: `npm test`. Write tests with `createTestIndexer()` and `simulate` (see [quickstart.md](references/quickstart.md)).
7. Run it locally with `npm run dev` (that is `envio dev`). Then query GraphQL at `http://localhost:8080/v1/graphql`. The Hasura console is at `http://localhost:8080` (password `testing`). After a config or schema change, run `npx envio dev -r`.
8. Deploy: push the repo to GitHub, then in https://envio.dev/app add the indexer, pick a deployment branch and push to it. The free Development plan is for testing only, and its deployments are deleted after 30 days at most.

Full walkthrough with every file and the test: [references/quickstart.md](references/quickstart.md).

## Common tasks

- [Scaffold: contract import (explorer or local ABI) and templates](references/recipes.md#1-scaffold-an-indexer-without-prompts)
- [config.yaml for several chains, incl. RPC-only chains (Hedera, 0G, testnets)](references/recipes.md#2-multichain-configyaml-with-hypersync-and-rpc-only-chains)
- [Factory contracts (`contractRegister`) + eth_call via `createEffect`](references/recipes.md#3-factory-contracts-and-eth_call-with-effects)
- [Wildcard indexing with `where` filters (all ERC20 mints) and block handlers](references/recipes.md#4-wildcard-events-where-filters-and-block-handlers)
- [Query the GraphQL API from a frontend (local and Envio Cloud)](references/recipes.md#5-query-the-graphql-api-from-an-app)
- [Deploy to Envio Cloud](references/recipes.md#6-deploy-to-envio-cloud)
- [HyperSync client: fast raw log queries in Node](references/recipes.md#7-hypersync-client-raw-logs-fast)
- [Errors and gotchas](references/errors.md) · [Sponsor chains](references/chains.md) · [Docs MCP server](references/mcp.md)

## Before you write more code

- Read the AI docs index first: https://envio.dev/llms.txt (product overview) and https://docs.envio.dev/llms.txt (every docs page as markdown). For coding agents: https://envio.dev/AGENTS.md. Search the docs from the terminal with `npx envio tools search-docs "<query>"` and `npx envio tools fetch-docs <url>`, or add the [docs MCP server](references/mcp.md).
- Key pages: [config file](https://docs.envio.dev/docs/HyperIndex/configuration-file), [event handlers](https://docs.envio.dev/docs/HyperIndex/event-handlers), [schema](https://docs.envio.dev/docs/HyperIndex/schema), [CLI](https://docs.envio.dev/docs/HyperIndex/cli-commands), [V2 to V3 migration](https://docs.envio.dev/docs/HyperIndex/migrate-to-v3), [HyperSync supported networks](https://docs.envio.dev/docs/HyperSync/hypersync-supported-networks).
- Check versions: `npm view envio version` and `npm view @envio-dev/hypersync-client version`. This skill was tested with envio 3.14.0 and the client at 1.4.1. Envio ships often (see the [changelog](https://envio.dev/changelog)).
- Many blog posts, the per-chain pages on envio.dev/chains, and older AI answers still show V2 syntax. If it says `generated`, `networks:`, `rpc_config:` or `Contract.Event.handler`, translate it with the migration guide. See [errors.md](references/errors.md).
- **When this skill and the official docs disagree, the docs win.**

## At ETHGlobal Mumbai

- **HyperSync (no RPC needed):** Arc (5042), Arc testnet (5042002), Unichain (130), World Chain (480).
- **RPC only:** you must add `rpc:` in `config.yaml` for Unichain Sepolia (1301), World Chain Sepolia (4801), Hedera (295/296), 0G (16661/16602) and Whitechain (1875/1874). These were checked with envio 3.14.0 codegen. Details and public RPCs: [references/chains.md](references/chains.md). Deeper chain facts are in the `sponsor-chains` skill (`npx skills add 0xvikram/backboard-skills --skill sponsor-chains`).
- Envio may help with the Arc, World, Uniswap Foundation and Hedera tracks, or any track that needs an event feed, leaderboard or history API. Check the tracks and their rules yourself: https://ethglobal.com/events/mumbai/prizes
- Help: Envio Discord https://discord.gg/envio, Telegram https://t.me/+BeS5ihVUFONjNGFk (both linked from https://envio.dev/llms.txt).

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or Envio. Tested 2026-10-19 with envio@3.14.0, @envio-dev/hypersync-client@1.4.1, viem@2.57.7, typescript@6.0.3, vitest@4.1.0.
