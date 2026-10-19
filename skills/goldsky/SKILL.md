---
name: goldsky
description: "Goldsky hosts subgraphs (GraphQL APIs over contract events, The Graph compatible) and streams chain data into databases and webhooks (Turbo pipelines, which replace Mirror). Use this skill for the goldsky CLI and login, deploying a subgraph from source, from an ABI (instant subgraph) or from The Graph, querying the endpoint, subgraph webhooks, Turbo/Mirror pipelines, chain slugs for 0G, Hedera, Arc, World Chain, Unichain, and free-plan limits."
license: MIT
metadata:
  category: "Data & storage"
  website: "https://goldsky.com"
  source: "tested"
  tested: "2026-10-19"
  packages: "@goldskycom/cli@13.17.1, turbo extension 0.13.1, graphql-request@7.4.0, graphql@16.14.2"
---

# Goldsky

Goldsky runs subgraphs for you. A subgraph turns your contract's events into a GraphQL API. Goldsky also runs **Turbo pipelines**, which stream chain data into Postgres, ClickHouse, Kafka, S3 or a webhook. Turbo replaces the older **Mirror** product.
Pick Goldsky when your app needs lists, history or totals over events (feeds, leaderboards, balances), or when you need a push when something happens on-chain. It is one of the few indexers that supports **0G and Hedera** subgraphs. If you only need to read one value from a contract, use a plain `eth_call` (viem) instead.

**Goldsky also publishes its own agent skill pack** (https://github.com/goldsky-io/goldsky-agent): `npx skills add goldsky-io/goldsky-agent`. Use it for Goldsky's own workflows; this skill adds a tested hackathon path, the sponsor-chain slugs and the gotchas found in testing.

## Quickstart

1. Sign up at https://app.goldsky.com/signup. New teams start on the free Starter plan with a one-time $100 credit (see [pricing](references/quickstart.md#free-plan-limits)).
2. Install the CLI with npm (it works on macOS, Linux and Windows; Goldsky's [install page](https://docs.goldsky.com/subgraphs/deploying-subgraphs) lists other ways):
   ```sh
   npm install -g @goldskycom/cli@13.17.1
   goldsky --version
   ```
3. Log in: `goldsky login` opens the browser. On a headless machine, create an API key in **Project Settings** (https://app.goldsky.com/dashboard/settings) and run `goldsky login --token <GOLDSKY_API_KEY>`.
4. Write an instant-subgraph config next to your ABI file. Goldsky generates the schema and mappings for you. Keep ABI names lowercase (see [errors.md](references/errors.md#1-failed-to-locate-abis-with-subgraph-init---from-config)):
   ```json
   {
     "version": "1",
     "name": "counter",
     "abis": { "counter": { "path": "./abis/Counter.json" } },
     "instances": [
       { "abi": "counter", "address": "<CONTRACT_ADDRESS>", "startBlock": <DEPLOY_BLOCK>, "chain": "arc-testnet" }
     ]
   }
   ```
   For `chain`, use a subgraph slug from [chains.md](references/chains.md), such as `0g-galileo-testnet`, `hedera-testnet`, `unichain-testnet` or `worldchain-sepolia`.
5. Deploy it. The CLI prints your GraphQL endpoint:
   ```sh
   goldsky subgraph deploy counter/1.0.0 --from-abi goldsky-config.json
   goldsky subgraph tag create counter/1.0.0 --tag prod   # stable URL: .../subgraphs/counter/prod/gn
   ```
6. Query it from any app. Errors such as 404 or 429 come back as `{ statusCode, message }`. GraphQL errors come back as `{ errors }`:
   ```ts
   const res = await fetch(process.env.GOLDSKY_SUBGRAPH_URL!, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ query: "{ transfers(first: 5, orderBy: timestamp_, orderDirection: desc) { id from to value } }" }),
   });
   const json = await res.json();
   if (!res.ok || json.errors) throw new Error(json.message ?? json.errors?.[0]?.message);
   console.log(json.data);
   ```
7. Run it with `npx tsx --env-file=.env query.ts`. The `.env` file holds `GOLDSKY_SUBGRAPH_URL=https://api.goldsky.com/api/public/<PROJECT_ID>/subgraphs/counter/prod/gn`.

Full walkthrough, with dashboard steps, a typed query script and plan limits: [references/quickstart.md](references/quickstart.md).

## Common tasks

- [Deploy a subgraph from source (graph-cli project)](references/recipes.md#1-deploy-a-subgraph-from-source)
- [Instant subgraph from an ABI: factory, multi-chain, enrichments](references/recipes.md#2-instant-subgraph-from-an-abi)
- [Migrate from The Graph (IPFS hash or URL)](references/recipes.md#3-migrate-a-subgraph-from-the-graph)
- [Query: fetch, graphql-request, pagination, private endpoints](references/recipes.md#4-query-the-endpoint)
- [Webhooks on subgraph entities and a receiver](references/recipes.md#5-webhooks-on-subgraph-entities)
- [Turbo pipeline: chain data to Postgres or a webhook (Mirror basics)](references/recipes.md#6-turbo-pipeline-chain-data-to-postgres-or-a-webhook)
- [Tags, versions, logs, pause and delete](references/recipes.md#7-tags-versions-logs-and-cleanup)
- [Errors and gotchas](references/errors.md)
- [Slugs for 0G, Hedera, Arc, World Chain, Unichain (subgraphs vs Turbo)](references/chains.md)
- [Goldsky docs MCP server for Claude Code / Cursor](references/mcp.md)

## Before you write more code

- Read the docs index first: https://docs.goldsky.com/llms.txt (every page also exists as `.md`). For the company overview, see https://goldsky.com/llms.txt. The full docs as one file are at https://docs.goldsky.com/llms-full.txt.
- Useful pages: the [CLI reference](https://docs.goldsky.com/reference/cli), the [instant subgraph config](https://docs.goldsky.com/subgraphs/reference/instant-subgraph), the [Turbo pipeline config](https://docs.goldsky.com/turbo-pipelines/pipeline-config) and [supported networks](https://docs.goldsky.com/chains/supported-networks).
- Mirror is legacy, so build new pipelines with Turbo (`goldsky turbo ...`). Mirror (`goldsky pipeline ...`) is still the only way to stream **subgraph entities** into a database.
- Check versions first with `npm view @goldskycom/cli version`. The CLI ships often.
- The CLI does not check chain slugs locally. A typo only fails at deploy time, so copy slugs from [chains.md](references/chains.md).
- **When this skill and the official docs disagree, the docs win.**

## At ETHGlobal Mumbai

- Sponsor chains, all supported for subgraphs on mainnet and testnet: **0G** (`0g`, `0g-galileo-testnet`), **Hedera** (`hedera-mainnet`, `hedera-testnet`), **Arc** (`arc-mainnet`, `arc-testnet`), **World Chain** (`worldchain`, `worldchain-sepolia`) and **Unichain** (`unichain`, `unichain-testnet`).
- Turbo pipelines cover fewer of these networks, and Hedera has none. Whitechain is not listed. Details: [references/chains.md](references/chains.md).
- May help with the 0G, Hedera, Arc, World and Uniswap Foundation tracks: activity feeds, leaderboards, dashboards and alerts over your contract's events. Check the tracks and their rules yourself at https://ethglobal.com/events/mumbai/prizes.
- Help: support@goldsky.com, and the Goldsky docs MCP server ([mcp.md](references/mcp.md)). For deeper chain facts, see the `sponsor-chains` skill (`npx skills add 0xvikram/backboard-skills --skill sponsor-chains`).

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or Goldsky. Tested 2026-10-19 with @goldskycom/cli@13.17.1, the Turbo extension 0.13.1, graphql-request@7.4.0 and graphql@16.14.2.
