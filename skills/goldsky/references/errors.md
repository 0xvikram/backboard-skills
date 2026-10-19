# Goldsky errors and gotchas

The messages under "Seen in testing" were reproduced with @goldskycom/cli 13.17.1 or against live `api.goldsky.com` endpoints on 2026-10-19.

## 1. `Failed to locate ABIs` with `subgraph init --from-config`

```
Failed to locate ABIs for the following contracts: Counter/0x1111... (local ABI paths: ./out/abis/counter.json, ./counter.json)
```

**Cause** (seen in testing): `init` lowercases the contract name and then looks up `abis["counter"]`. With the key `"Counter"`, the lookup fails, so it ignores your `path` and searches for `counter.json`.
**Fix:** use lowercase ABI keys (`"abis": { "counter": ... }`, `"abi": "counter"`), as the docs' examples do (`ftshares`, `nouns`). `deploy --from-abi` sends the config to the server and did not hit this local check, but lowercase keys are safe everywhere.
Source: test log; config format at https://docs.goldsky.com/subgraphs/reference/instant-subgraph

## 2. `Make sure to run 'goldsky login'` / `A valid API token is required`

```
Deployment failed: Make sure to run 'goldsky login' before running any commands requiring authorization.
Subgraph listing failed: A valid API token is required. Pass it as: Authorization: Bearer <token>
Error: Auth token file not found at "~/.goldsky/auth_token". Please run 'goldsky login' to authenticate.   (turbo)
```

**Cause:** you are not logged in, or you are on a headless box or in CI. Every deploy, list, webhook and turbo command needs auth. `subgraph init ... --build` also needs auth, because the build runs on Goldsky's servers.
**Fix:** run `goldsky login`. Headless: `goldsky login --token <API_KEY>`, with the key from https://app.goldsky.com/dashboard/settings. Or pass `--token <API_KEY>` on each command.
Source: https://docs.goldsky.com/reference/cli#login

## 3. Wrong chain slug (`-` vs `_`, `mainnet` vs `ethereum`)

**Cause:** subgraphs and Turbo use **different** slugs for the same chain. Subgraphs use `arc-testnet`, `unichain-testnet`, `0g-galileo-testnet` and `hedera-testnet`. Turbo datasets use `arc_testnet.*`, `unichain_testnet.*` and `0g.*`. The CLI does **not** check slugs locally: `"chain": "not-a-real-chain"` passed `subgraph init` validation in testing. A wrong slug fails only on deploy.
**Fix:** copy slugs from [chains.md](chains.md) or the chain's page at https://docs.goldsky.com/chains/<chain>. For Turbo, find the dataset at https://app.goldsky.com/explore.

## 4. `missing field 'transforms'` in a Turbo YAML

```
Error: Failed to read pipeline_yaml from bad.yaml
Caused by: Failed to parse YAML at path '.': missing field `transforms`
```

**Fix:** add `transforms: {}` when you have none. The YAML parse runs locally before auth, so this fails before anything else (seen in testing). Other checks, such as the dataset version or the sink URL, only run server-side after login.
Source: test log; config at https://docs.goldsky.com/turbo-pipelines/pipeline-config

## 5. HTTP 401 / 404 / 429 from the GraphQL endpoint

Seen in testing (all returned as JSON `{ statusCode, message }`, not GraphQL `errors`):

| HTTP | message | Meaning |
| --- | --- | --- |
| 401 | `Missing authorization header. Please include a header in the format "Authorization: Bearer <apiToken>"` | you called `/api/private/...` without a key |
| 404 | `API token not found` | bad or deleted key on a private endpoint |
| 404 | `Subgraph not found. Have you deleted this subgraph recently?...` | wrong project ID, name or tag, or the subgraph was deleted |
| 429 | rate limited | public endpoints allow 50 requests per 10 seconds |

**Fix:** check `res.ok` before you read `data`, as in the quickstart script. For 429, cache results, proxy the endpoint through your backend, or ask support for a higher limit (Scale plan and above). A browser "CORS" error is usually a hidden 429, since Goldsky does not enforce CORS.
Source: https://docs.goldsky.com/subgraphs/graphql-endpoints#errors

## 6. 524 timeouts when deploying an instant subgraph

**Cause:** large deployments time out the IPFS server.
**Fix:** retry right away, then a bit later. If it keeps failing, email support@goldsky.com.
Source: https://docs.goldsky.com/faq

## 7. `store error: column "x" specified more than once`

**Cause:** an instant subgraph with several ABIs whose events or fields have the same name.
**Fix:** split the ABIs into separate subgraphs.
Source: https://docs.goldsky.com/faq

## 8. The subgraph stops making progress or gets auto-paused

**Cause:** mapping errors that repeat, chain data issues, or a start block far in the past. Goldsky emails all team members and may auto-pause the subgraph. On Starter, everything is also paused when the $100 credit runs out.
**Fix:** run `goldsky subgraph log <name>/<version> --since 1h --filter error`, fix the problem and deploy a new version. Check your credit balance in the dashboard. `goldsky subgraph start <name>/<version>` resumes a paused subgraph.
Sources: https://docs.goldsky.com/subgraphs/stalled-subgraphs, https://docs.goldsky.com/pricing/summary#starter-credits

## 9. Old example endpoints and Mirror pages are dead

- The free **blocks subgraphs** were sunset and return nothing. The docs' sample endpoint `.../uniswap-v3-base/prod/gn` returned `404 Subgraph not found` in testing. Polymarket's public subgraphs are paused. Do not build demos on them. Use your own subgraph, or get block timestamps from RPC (`eth_getBlockByNumber`).
- Mirror is legacy. New docs pages and the dataset catalog cover Turbo. Old blog posts that use `goldsky pipeline create` with `apiVersion: 3` YAML are Mirror. Use `goldsky turbo apply` for new work, except for subgraph-entity sources, which are still Mirror-only.
Sources: https://docs.goldsky.com/subgraphs/blocks-subgraphs, https://docs.goldsky.com/mirror/introduction

## 10. Installer pipes a script into your shell

The docs install the CLI and the Turbo extension by piping shell scripts (from goldsky.com and install-turbo.goldsky.com) into `sh`. Safer alternatives that were tested:

- `npm install -g @goldskycom/cli@<version>`, which pins the version.
- `goldsky turbo install`, which downloads the Turbo extension to `~/.goldsky/bin/turbo`.

Running `goldsky turbo` with no terminal attached printed `There is no terminal to answer this prompt in. Re-run with --force`. In CI, use `goldsky turbo install --force`.
Source: https://docs.goldsky.com/installation, https://docs.goldsky.com/turbo-pipelines/cli
