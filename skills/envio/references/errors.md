# Envio errors and gotchas

Entries marked **(seen in testing)** were reproduced with envio 3.14.0 or @envio-dev/hypersync-client 1.4.1 on 2026-10-19. The others come from the linked docs.

## 1. `401 Unauthorized ... Your token is malformed` (seen in testing)

```
WARN hypersync_client] Failed cache query, will retry full query. 401 Unauthorized, err body: {"error":"Your token is malformed. ..."}
```

**Cause:** `ENVIO_API_TOKEN` is missing, empty or a placeholder. HyperIndex (on HyperSync chains), `createTestIndexer` runs over real blocks, and the HyperSync client all need it. The client and indexer **keep retrying** instead of failing. A vitest test just hangs until it times out, and a client call takes about a minute to give up.
**Fix:** create a token at https://envio.dev/app/api-tokens and put it in `.env` as `ENVIO_API_TOKEN=...`. For the client, set `maxNumRetries: 1` while debugging. HTTP 403 `unknown or pending activation` means the token was copied wrong. HTTP 403 `does not have access to this product` means you used a HyperSync token for HyperRPC, or the other way round. HTTP 429 means you are rate limited.
Source: https://docs.envio.dev/docs/HyperSync/api-tokens

## 2. `Failed to automatically find HyperSync endpoint for the chain 296` (seen in testing)

```
Failed parsing config: Failed to automatically find HyperSync endpoint for the chain 296. If the chain is supported by HyperSync, provide the endpoint manually ... Or use an RPC endpoint for historical sync:
```

**Cause:** the chain has no HyperSync endpoint. In 3.14.0 that includes Hedera (295/296), 0G (16661/16602), Unichain Sepolia (1301), World Chain Sepolia (4801) and Whitechain (1875/1874).
**Fix:** add `rpc: <RPC_URL>` to that chain in `config.yaml`, or pass `-r <RPC_URL>` to `envio init ... local`. Set `start_block` to your deploy block, because syncing from block 0 over RPC is slow.
Source: https://docs.envio.dev/docs/HyperIndex/rpc-sync, https://docs.envio.dev/docs/HyperIndex/supported-networks

## 3. V2 code or config on V3 (seen in testing)

```
chains[0]: unknown field `rpc_config`, expected one of `id`, `skip`, `rpc`, `hypersync_config`, ...
missing field `chains` at line 2 column 1                     # you wrote `networks:`
chains[0].id: invalid type: string "arc", expected ...        # you wrote `id: arc`
```

In TypeScript you may also see `Cannot find module 'generated'`, or that `ERC20.Transfer.handler` does not exist.

**Cause:** the code came from V2 docs, blog posts, an older AI answer, or the per-chain pages on https://envio.dev/chains. Those pages still show `rpc_config:` and `id: arc` as of 2026-10-19.
**Fix:** `networks` → `chains`, `rpc_config` → `rpc`, and use numeric chain IDs. `import { X } from "generated"` → `import { indexer } from "envio"`, and `X.Event.handler(fn)` → `indexer.onEvent({ contract: "X", event: "Event" }, fn)`. `eventFilters` → `where`, and `context.addY(addr)` → `context.chain.Y.add(addr)`. `package.json` needs `"type": "module"`.
Source: https://docs.envio.dev/docs/HyperIndex/migrate-to-v3

## 4. `FieldNotSelected<"Field 'timestamp' is not selected for this handler...">` (seen in testing)

**Cause:** you passed `fields: { transaction: [...] }` to `indexer.onEvent` and then read `event.block.timestamp`. Once `fields` is set, only the listed fields are typed and fetched, plus `block.number`. Without `fields`, `event.transaction` is empty too.
**Fix:** list everything you read, for example `fields: { transaction: ["hash"], block: ["timestamp"] }`.
Source: https://docs.envio.dev/docs/HyperIndex/event-handlers#selecting-block-and-transaction-fields

## 5. `Type 'string' is not assignable to type 'SingleOrMultiple<\`0x${string}\`>'` in `where` (seen in testing)

**Cause:** in V3 an `Address` is typed `` `0x${string}` ``. A plain `const ZERO = "0x000..."` widens to `string` once it is inside the returned object.
**Fix:** `const ZERO = "0x0000000000000000000000000000000000000000" as const;`. For values you read at runtime, cast with `as \`0x${string}\``.
Source: https://docs.envio.dev/docs/HyperIndex/migrate-to-v3 (type changes)

## 6. `Docker or Podman is installed but isn't running` (seen in testing)

```
Failed starting Docker containers: Docker or Podman is installed but isn't running, so envio can't start Postgres and Hasura.
Hint: Open Docker Desktop, or run: export DOCKER_HOST=unix://$HOME/.docker/run/docker.sock
```

**Fix:** start Docker Desktop and run `npm run dev` again. You can still run `envio codegen`, `tsc` and `npm test` (with `simulate`) without Docker. If the Postgres port is busy (another indexer on `5433`), set `ENVIO_PG_PORT=5434` for both `codegen` and `dev`.
Source: https://docs.envio.dev/docs/HyperIndex/running-locally, https://docs.envio.dev/docs/HyperIndex/common-issues

## 7. Schema or config changes don't show up, tables are missing in Hasura, or it doesn't start at `start_block`

**Cause:** local state is left over from an earlier run. Hot reload only covers handler files.
**Fix:** `npx envio dev -r` (restart and re-index). If that fails, run `npx envio stop` and then `npm run dev`. The running-locally page still says `envio start -r`, but in V3 `envio start` is for production only and `envio dev` is for local work.
Source: https://docs.envio.dev/docs/HyperIndex/cli-commands, https://docs.envio.dev/docs/HyperIndex/migrate-to-v3 (step 9)

## 8. External calls run twice or get rate-limited

**Cause:** preload optimisation is always on in V3, so **every handler runs twice**. A raw `fetch` or viem call inside a handler fires twice per event and is not batched.
**Fix:** wrap it in `createEffect` and call `context.effect(...)` ([recipes.md section 3](recipes.md#3-factory-contracts-and-eth_call-with-effects)). For pure CPU work, `if (context.isPreload) return;` after your loads. The effect function must be `async` (one docs example leaves the keyword out).
Source: https://docs.envio.dev/docs/HyperIndex/preload-optimization, https://docs.envio.dev/docs/HyperIndex/effect-api

## 9. Hasura login prompt, aggregates missing on the hosted endpoint, or 429

- Locally, the Hasura admin secret is `testing`. The hosted endpoint needs no secret, and there is no console UI.
- Envio Cloud hides `*_aggregate` queries. Store counters in entities at indexing time.
- A 429 on the hosted endpoint is a query rate limit. Cache, poll less, or use subscriptions.
Source: https://docs.envio.dev/docs/HyperIndex/common-issues, https://docs.envio.dev/docs/HyperIndex/navigating-hasura

## 10. HyperSync `get()` returns fewer blocks than asked

**Cause:** each request has a server time limit (about 5 s), so it returns a page, and `toBlock` is exclusive.
**Fix:** loop on `res.nextBlock` until you reach `toBlock`, or use `client.stream` / `client.collect`, which paginate for you ([recipes.md section 7](recipes.md#7-hypersync-client-raw-logs-fast)).
Source: https://docs.envio.dev/docs/HyperSync/hypersync-usage

## 11. Envio Cloud build or deploy problems

- Env vars must start with `ENVIO_`, both in the dashboard and in `${...}` inside `config.yaml`.
- The build runs with pnpm 10.32.0, needs `envio` pinned in `package.json`, and the repo must be under 100 MB. In a monorepo, every import must live inside the indexer folder.
- Free Development deployments are deleted after 30 days at most, or sooner after they pass the soft limits.
Source: https://docs.envio.dev/docs/HyperIndex/hosted-service-deployment, https://docs.envio.dev/docs/HyperIndex/envio-cloud-troubleshooting
