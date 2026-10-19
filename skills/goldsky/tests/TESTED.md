Original log from 2026-10-19; current checks: see README.md

# TESTED: goldsky (2026-10-19)

Test folder: `scratchpad/deep/_test/goldsky/`. Machine: macOS (darwin-arm64), Node v24.21.0. No Goldsky account, login or API key was used. Nothing was deployed or paid for. The CLI ran with `HOME` pointed at the test folder and `GOLDSKY_CLI_TELEMETRY_DISABLED=1` (`goldsky telemetry status` reported it disabled).

## Versions

| Package | Version | Note |
| --- | --- | --- |
| @goldskycom/cli | 13.17.1 | latest on npm (published 2026-10-16); bundled, no deps, no install scripts |
| Turbo extension | 0.13.1 | installed with `goldsky turbo install --force` into `<test HOME>/.goldsky/bin/turbo` |
| graphql-request | 7.4.0 | peer graphql 14-16 |
| graphql | 16.14.2 | 17.0.2 is latest but outside graphql-request's peer range |
| typescript / tsx / @types/node | 5.9.3 / 4.20.6 / 22.20.5 | test tooling only |

## Sources read

- https://goldsky.com/llms.txt and https://docs.goldsky.com/llms.txt (378 pages), plus llms-full.txt (2.2 MB, used to grep for endpoints and for "whitechain", which has 0 hits).
- About 40 `.md` pages: installation, CLI reference, subgraphs (deploy, migrate, webhooks, endpoints, tags, no-code, low-code, instant reference, stalled, blocks), Turbo (intro, quickstart, cli, migrate-from-mirror, EVM sources, webhook/postgres sinks, curated schemas), Mirror intro and subgraph source, pricing, FAQ, MCP server, AI skills, supported-networks, and the 0G, Hedera, Arc, World Chain and Unichain chain pages. Slugs were read from the `ChainSubgraphsSection`/`ChainTurboSection` props on each chain page.
- Turbo dataset catalog at app.goldsky.com/explore (public). Parsed the embedded dataset-group JSON for sponsor-chain slugs, and read the per-chain version from `/explore/<slug>/<dataset>`.
- Installer scripts were downloaded and read, **not run** (`goldsky.com/cli-installation.sh` → `cli.goldsky.com/install`, a binary from `cli.goldsky.com/latest`).
- All 35 docs.goldsky.com URLs cited in the skill returned HTTP 200.

## What ran and passed

1. **CLI install and auth checks:** `npx goldsky --version` printed 13.17.1. `subgraph list`, `subgraph deploy --from-abi`, `subgraph webhook create` and `turbo validate` each failed cleanly with the "login / API token required" messages that errors.md quotes.
2. **Instant subgraph config, built locally?** Partly. `goldsky subgraph init counter/1.0.0 --from-config goldsky-config.json --target-path ./out` validated the config and wrote `counter-subgraph.json` and `abis/counter.json` with no login. `--build` stopped with "Make sure to run 'goldsky login' before building a subgraph". The code shows the build is a server job (`POST /api/admin/subgraph/v1/subgraphs/generated`), so **a full build cannot be done locally without login**.
3. **Found a bug:** with the ABI key `"Counter"`, init failed with `Failed to locate ABIs ... counter.json`. The code looks up `abiMap[normalizedName]`, which is lowercase. Lowercase keys work. This is in errors.md #1.
4. **Slugs through init:** `0g`, `0g-galileo-testnet`, `hedera-testnet`, `hedera-mainnet`, `arc-testnet`, `arc-mainnet`, `worldchain-sepolia`, `unichain-testnet` were all accepted. So was `not-a-real-chain`, which means **the CLI does not validate slugs locally** (none appear in the bundle). The slugs were therefore verified only against the docs chain pages.
5. **Recipe 2 configs** (factory, multi-chain, enrichment): valid JSON, and they match the reference. However, `init --from-config` silently **dropped** the factory template instance and the `enrich` block, and **rejected** multi-chain with `Duplicate normalized contract name`. The skill now says not to use init to check those configs.
6. **Turbo YAML:** `goldsky turbo validate` parses YAML locally before auth. A file without `transforms:` gave `missing field 'transforms'`, which is now in errors.md #4. The two recipe-6 YAMLs (`arc_testnet.erc20_transfers` 1.1.0 to a webhook, `0g.raw_logs` 1.1.0 to Postgres) parsed and then stopped at the auth check, so the server-side checks did not run.
7. **Type-check:** every ```ts block in SKILL.md, quickstart.md and recipes.md was extracted into `src/docs/` and checked with `tsc -p .` (strict, NodeNext, ESM): **OK**. The quickstart, graphql-request and webhook blocks are byte-identical to the tested `src/*.ts`.
8. **GraphQL syntax:** 4 query documents parsed with `graphql.parse`.
9. **Runtime against live api.goldsky.com** (error paths only, since no live public subgraph could be found):
   - docs sample `uniswap-v3-base/prod`: 404 `Subgraph not found`
   - private URL with no header: 401 `Missing authorization header...`
   - private URL with a fake token: 404 `API token not found`
   - Polymarket public subgraph: 429 with a GraphQL `errors` body (paused)
   The quickstart, SKILL and paginate scripts surfaced each of these through their error paths.
10. **Webhook receiver:** ran on localhost:3999. No secret header gave 401. With `goldsky-webhook-secret` it returned 200 and logged the event. A repeated event id was de-duplicated (logged once).
11. **MCP:** `initialize` and `tools/list` against https://docs.goldsky.com/mcp with no auth returned 3 tools: `search_goldsky`, `query_docs_filesystem_goldsky`, `submit_feedback`.

## Not tested

- `goldsky login`, any real deploy (`--path`, `--from-abi`, `--from-ipfs-hash`, `--from-url`), tags, webhooks, logs, pause/delete. All need an account.
- Server-side generation of instant subgraphs. Not checked:
  - the generated entity and field names (`transfers`, `timestamp_`, `transactionHash_`, the param names). These follow the docs' Nouns example.
  - whether addresses are `String` or `Bytes` in filters.
  - whether uppercase ABI keys also break `deploy --from-abi` (that path did not hit the local lookup).
- A successful GraphQL query against a live subgraph. No working public Goldsky subgraph was found: the docs' samples and the blocks subgraphs are sunset.
- `turbo apply/inspect/logs`, `secret create`, Postgres and webhook sinks, and whether the dataset versions in the YAMLs are accepted by the server.
- Mirror (`goldsky pipeline ...`), including the subgraph-entity source.
- Partner Sponsored access codes for 0G and Unichain.
- Adding the MCP server to a real Claude Code or Cursor config. Goldsky's own `goldsky-io/goldsky-agent` skills.
- Hedera specifics, such as indexing a contract by its EVM address.

## Doubts for the reviewer

- **Mirror vs Turbo:** the board brief says "Mirror pipelines". Goldsky now calls Mirror legacy. The skill teaches Turbo and keeps Mirror only for subgraph-entity sources. Check that the board copy says "Turbo (formerly Mirror)".
- **Free plan:** Starter is a one-time $100 credit with **no** monthly free allowance. The "3 free subgraphs" allowance is on Scale, which needs a card. When the credit runs out, everything pauses and nothing is billed.
- **The docs contradict themselves on the private endpoint example:** the text says the `prod` tag, but the URL uses `/1.0.0/`. The skill uses the general format only.
- **Dataset versions vary per chain** (1.0.0 to 1.3.0) and differ from the docs' `base.erc20_transfers` 1.2.0. They were read from the catalog on 2026-10-19 and may change.
- **Coverage-matrix "M" vs chain pages:** 0G and World Chain Turbo are mainnet only, which matches. The matrix's Subgraphs column says M+T for all five chains, which also matches the chain pages.
