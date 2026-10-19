# The Graph: errors and gotchas

Entries marked "(seen in testing)" were reproduced on 2026-10-19 with graph-cli 0.98.1 or against the live gateway.

## 1. `Error: Nonexistent flag: --product` (seen in testing)

The [Install the CLI](https://thegraph.com/docs/en/subgraphs/developing/creating/install-the-cli/) page still shows `graph init --product subgraph-studio ...`. CLI 0.98.1 has no `--product` flag. **Fix:** drop it. Studio is the default target, and `graph deploy <SLUG>` deploys to Studio. Run `graph init --help` to see the current flags.

## 2. `@entity directive requires \`immutable\` argument` (seen in testing)

```
✖ Failed to load subgraph from subgraph.yaml: Error in schema.graphql:
  Account:
  - @entity directive requires `immutable` argument
    Hint: Try updating the entity definition with: @entity(immutable: true)
```

Recent CLIs require every entity to say whether it is immutable ([graph-tooling PR #1994](https://github.com/graphprotocol/graph-tooling/pull/1994)). Several docs examples still show a bare `@entity`. **Fix:** write `@entity(immutable: true)` for event-like rows and `@entity(immutable: false)` for rows you update (balances, counters). Timeseries entities use `@entity(timeseries: true)`.

## 3. `auth error: missing authorization header` / `malformed API key` / `API key not found` (seen in testing)

These come back from `gateway.thegraph.com` as HTTP 200 with `{"errors":[{"message":"auth error: ..."}]}`.
- `missing authorization header`: no key in the path and no `Authorization` header.
- `invalid authorization header`: an empty key, sent as `Bearer ` with nothing after it.
- `malformed API key`: the value is not in API-key format (for example a placeholder string).
- `API key not found`: the key is well-formed but unknown or was regenerated.

**Fix:** create a query key in Studio → **API Keys**. Send it as `Authorization: Bearer <API_KEY>` or in the path `/api/<API_KEY>/subgraphs/id/<ID>`. The deploy key is only for `graph auth`/`graph deploy`. Check `json.errors` even when the status is 200 ([API keys docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/)).

## 4. HTTP 405 on the query URL

A GET to the gateway query URL can return 405. **Fix:** send `POST` with a JSON body `{ "query": "...", "variables": {...} }` ([docs](https://thegraph.com/docs/en/subgraphs/querying/introduction/)).

## 5. urql: `Property 'exchanges' is missing in type '{ url: string; }'` (seen in testing)

The [Querying from an App](https://thegraph.com/docs/en/subgraphs/querying/from-an-application/) page shows `createClient({ url })`. Since urql v4, `exchanges` is required, and TypeScript rejects the docs' snippet with urql 5. **Fix:**

```ts
import { Client, cacheExchange, fetchExchange } from "urql";
const client = new Client({ url, exchanges: [cacheExchange, fetchExchange] });
```

## 6. Only 100 results / `first` over 1000 rejected / `skip` slow

Collections return 100 items by default, and `first` is capped at 1000 ([FAQ #22](https://thegraph.com/docs/en/subgraphs/developing/developer-faq/), [graph-node env vars](https://github.com/graphprotocol/graph-node/blob/master/docs/environment-variables.md)). Large `skip` values are slow, and an indexer may cap them. **Fix:** paginate with `orderBy: id, where: { id_gt: $lastId }`. See [recipes.md section 6](recipes.md#6-graphql-query-patterns).

## 7. Results in a strange order, or no match for an address

- The default order is by `id`, not by time. Pass `orderBy` (for example `timestamp` or `blockNumber`) and `orderDirection: desc`.
- `Bytes` and `id` filters compare lowercase hex. Use `address.toLowerCase()` before filtering.
- `BigInt`/`BigDecimal` filter values and results are strings (`value_gt: "1000"`).

Source: [GraphQL API](https://thegraph.com/docs/en/subgraphs/querying/graphql-api/)

## 8. Subgraph stuck at 0% or never syncs / wrong network

- `startBlock` is missing or 0 on a busy chain, so the subgraph scans from genesis. Set it to the contract's deploy block ([FAQ #19-20](https://thegraph.com/docs/en/subgraphs/developing/developer-faq/)).
- The network name is wrong, or the chain is not supported in Studio. `graph init`/`build` did not reject made-up names in testing, so check [supported networks](https://thegraph.com/docs/en/supported-networks/). World Chain is **not** supported in Studio (see [chains.md](chains.md)).
- `graph build --network X` rewrote `subgraph.yaml` to another chain and you deployed that by accident. Check `network:` before `graph deploy`.

## 9. Indexing failed: handler error in Studio logs

These are common runtime failures. `graph build` does not catch them:
- A required (`!`) field was not set before `save()` ("Null value resolved for non-null field ..." at query time, or a store error while indexing). Set every required field, or make it nullable ([schema docs](https://thegraph.com/docs/en/subgraphs/developing/creating/ql-schema/)).
- A contract call reverted. Use the generated `try_` method and check `.reverted` ([API docs](https://thegraph.com/docs/en/subgraphs/developing/creating/graph-ts/api/)).
- An entity loaded with `.load()` is `null` and used without a null check.

**Fix:** fix the bug, run `graph codegen && graph build`, and redeploy with a new version label. For quick checks, unit-test handlers with Matchstick (`graph test`, [docs](https://thegraph.com/docs/en/subgraphs/tooling/unit-testing-framework/)).

## 10. You changed the schema or ABI and types are stale

The `generated/` folder only updates when you run `graph codegen`. **Fix:** run `graph codegen` after every change to `schema.graphql`, the ABIs or `subgraph.yaml`, then `graph build`. Also note that `graph init` pinned `@graphprotocol/graph-ts@0.37.0` in testing while 0.38.2 is current. Bump it with `npm i @graphprotocol/graph-ts@0.38.2`.

## 11. Studio limits

Each account can have 3 unpublished subgraphs. The dev query URL allows 3,000 queries/day. A subgraph must sync within 14 days, and one dormant for 30 days may be deleted ([Studio docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/), [fair use](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/fair-use-policy/)). **Fix:** archive old subgraphs in Studio, or publish the one you demo.
