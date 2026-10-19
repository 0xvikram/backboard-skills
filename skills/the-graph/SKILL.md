---
name: the-graph
description: "The Graph indexes smart-contract events into a GraphQL API (a subgraph). Use this skill to build a subgraph with Graph CLI (graph init, schema.graphql, AssemblyScript mappings, graph codegen/build, graph deploy to Subgraph Studio), query a subgraph from a frontend (fetch, graphql-request, urql) with an API key, write GraphQL filters/pagination/ordering, or pick network names for Unichain, Arc and World Chain."
license: MIT
metadata:
  category: "Data & storage"
  website: "https://thegraph.com"
  source: "tested"
  tested: "2026-10-19"
  packages: "@graphprotocol/graph-cli@0.98.1, @graphprotocol/graph-ts@0.38.2, graphql-request@7.4.0, graphql@16.14.2, @urql/core@6.0.3, urql@5.0.4"
---

# The Graph

The Graph turns contract events into a GraphQL API. You write a **subgraph**: a manifest (`subgraph.yaml`), a schema (`schema.graphql`) and AssemblyScript mappings. You deploy it to Subgraph Studio, and your app queries it over HTTP.
Use it when your app needs lists, history, sorting or totals over on-chain events (a feed of trades, a leaderboard, balances per user). Do not use it to read one value from one contract: a plain `eth_call` (viem) is simpler. Subgraphs index events, so make sure your contract emits the events you need.

## Quickstart

1. Create a subgraph in [Subgraph Studio](https://thegraph.com/studio/): connect a wallet, click **Create a Subgraph**, and note its **slug** and **deploy key**.
2. Install the CLI (Node >= 20.18.1): `npm i -g @graphprotocol/graph-cli@0.98.1`, then check with `graph --version`.
3. Scaffold from a deployed contract. The interactive `graph init` asks for the same values. Note that the `--product` flag from older docs no longer exists:
   ```sh
   graph init my-subgraph my-subgraph --protocol ethereum \
     --from-contract <CONTRACT_ADDRESS> --network unichain-testnet \
     --abi ./MyContract.json --contract-name MyContract \
     --start-block <DEPLOY_BLOCK> --index-events
   ```
   If you leave out `--abi`, the CLI tries to fetch the ABI from an explorer.
4. Edit `schema.graphql` and `src/*.ts`. Every `@entity` must say `immutable: true` or `immutable: false`, or codegen fails. Then compile:
   ```sh
   cd my-subgraph && graph codegen && graph build
   ```
5. Deploy to Studio (you will be asked for a version label like `v0.0.1`):
   ```sh
   graph auth <DEPLOY_KEY>
   graph deploy my-subgraph
   ```
6. Query it. Studio shows a dev query URL (`https://api.studio.thegraph.com/query/<ID>/<SLUG>/<VERSION>`, limited to 3,000 queries/day). After you publish, use the gateway with an API key from **Studio → API Keys**:
   ```ts
   const res = await fetch(`https://gateway.thegraph.com/api/subgraphs/id/${process.env.SUBGRAPH_ID}`, {
     method: "POST",
     headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GRAPH_API_KEY}` },
     body: JSON.stringify({ query: "{ transfers(first: 5, orderBy: blockNumber, orderDirection: desc) { id value } }" }),
   });
   const json = await res.json(); // errors come back with HTTP 200, so check them
   if (json.errors) throw new Error(json.errors[0].message);
   console.log(json.data);
   ```
7. Run it with `npx tsx --env-file=.env query.ts`. The `.env` holds `GRAPH_API_KEY=<YOUR_API_KEY>` and `SUBGRAPH_ID=<SUBGRAPH_ID>`.

Full walkthrough with a complete subgraph (schema, mapping, manifest): [references/quickstart.md](references/quickstart.md).

## Common tasks

- [Scaffold a subgraph from a contract](references/recipes.md#1-scaffold-from-a-contract)
- [Schema + mapping: balances per account (load-or-create, @derivedFrom)](references/recipes.md#2-balances-per-account-schema-and-mapping)
- [Hourly/daily stats with timeseries and aggregations](references/recipes.md#3-hourly-and-daily-stats-timeseries--aggregations)
- [Deploy to Studio, versions, many networks (networks.json)](references/recipes.md#4-deploy-to-studio-and-switch-networks)
- [Query from a frontend: fetch, graphql-request, urql, React, Next.js](references/recipes.md#5-query-from-an-app)
- [GraphQL patterns: filter, order, paginate, time-travel, _meta](references/recipes.md#6-graphql-query-patterns)
- [World Chain: no Studio support, so use Substreams or your own graph-node](references/recipes.md#7-world-chain-substreams-or-your-own-graph-node)
- [Token API and x402 (data without writing a subgraph)](references/recipes.md#8-token-api-and-x402)
- [Errors and gotchas](references/errors.md)
- [Network names for Unichain, Arc, World Chain](references/chains.md)
- [Subgraph MCP server for Claude Code / Cursor](references/mcp.md)

## Before you write more code

- Read the docs index first: https://thegraph.com/llms.txt. The docs live at https://thegraph.com/docs/en/ (source: https://github.com/graphprotocol/docs). Useful pages: the [GraphQL API reference](https://thegraph.com/docs/en/subgraphs/querying/graphql-api/), the [AssemblyScript API](https://thegraph.com/docs/en/subgraphs/developing/creating/graph-ts/api/) and the [manifest reference](https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/).
- Network names (`network:` in `subgraph.yaml`) come from the [networks registry](https://github.com/graphprotocol/networks-registry). Check that your chain shows **Subgraphs** support on https://thegraph.com/docs/en/supported-networks/ before you build. `graph init` and `graph build` accepted made-up names in testing, so they will not catch a typo for you.
- Check versions first: `npm view @graphprotocol/graph-cli version`, `npm view @graphprotocol/graph-ts version`. `graph init` may pin an older `graph-ts`. This skill was tested with 0.38.2.
- Some doc examples are older than the current CLI (the `--product` flag, `@entity` without `immutable`, `urql` without `exchanges`). See [errors.md](references/errors.md).
- **When this skill and the official docs disagree, the docs win.**

## At ETHGlobal Mumbai

- Sponsor chains: **Unichain** (mainnet `unichain`, Sepolia `unichain-testnet`) and **Arc** (`arc`, `arc-testnet`) are supported in Subgraph Studio. **World Chain** (`worldchain`) has Substreams/Firehose only, with no Studio subgraphs. World Chain Sepolia, Hedera, 0G and Whitechain are not listed. Details: [references/chains.md](references/chains.md).
- May help with the Uniswap Foundation, Arc and World tracks: dashboards, feeds and leaderboards over your contract's events. Check the tracks and their rules yourself: https://ethglobal.com/events/mumbai/prizes
- Help: The Graph Discord https://discord.gg/graphprotocol (linked from the docs). For deeper chain facts, see the `sponsor-chains` skill (`npx skills add 0xvikram/backboard-skills --skill sponsor-chains`).

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or The Graph. Tested 2026-10-19 with @graphprotocol/graph-cli@0.98.1, @graphprotocol/graph-ts@0.38.2, graphql-request@7.4.0, graphql@16.14.2, @urql/core@6.0.3, urql@5.0.4.
