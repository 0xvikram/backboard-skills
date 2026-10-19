Original log from 2026-10-19; current checks: see README.md

# TESTED: the-graph (2026-10-19)

Test folder: `scratchpad/deep/_test/the-graph/`. Machine: macOS (darwin-arm64), Node v24.21.0. No API keys or deploy keys were used. Nothing was deployed, published or paid for.

## Versions (from `npm view`, 2026-10-19)

| Package | Version | Note |
| --- | --- | --- |
| @graphprotocol/graph-cli | 0.98.1 | latest; engines node >= 20.18.1 |
| @graphprotocol/graph-ts | 0.38.2 | latest (`graph init` pinned 0.37.0) |
| graphql-request | 7.4.0 | peer graphql 14-16 |
| graphql | 16.14.2 | 17.0.2 is latest but outside graphql-request's peer range |
| @urql/core | 6.0.3 | |
| urql | 5.0.4 | (with react 19.2.0, @types/react 19.2.2) |
| typescript / tsx | 5.9.3 / 4.20.6 | test tooling only |

## Sources read

- `https://thegraph.com/llms.txt`. AGENTS.md is linked from it but returns 404, and docs pages are not served as .md.
- Docs source cloned from github.com/graphprotocol/docs at commit 3e01563, 2026-10-09, under `website/src/pages/en`. Pages read: quick-start, install-the-cli, using-subgraph-studio, multiple-networks, ql-schema, graph-ts/api, common-issues, developer-faq, querying/*, managing-api-keys, secure-api-keys-nextjs, best-practices/timeseries, subgraph-mcp/*, substreams quick-start, the-graph-market, x402-payments, fair-use-policy, graph-node-dev.
- The networks registry JSON (v0.8.7, 2026-10-08) and the `__NEXT_DATA__` of the live supported-networks page, to get per-chain support levels.
- All 29 thegraph.com/docs URLs cited in the skill were checked: HTTP 200 and not the "lost in space" 404 page.

## What ran and passed

1. **`graph init` (non-interactive) from a contract** with a local ABI on `unichain`. The scaffold was created and codegen ran. Also tried `worldchain`, `arc-testnet`, `unichain-testnet` and the made-up `worldchain-sepolia`: all were accepted, which means the CLI does not validate network names. Running without `CI=1` and with stdin closed also completed with no prompts.
2. **`graph codegen` + `graph build`** passed for:
   - `sg-init`: the raw scaffold, after bumping graph-ts to 0.38.2.
   - `sg-quickstart`: built from the exact code blocks in references/quickstart.md (ABI, subgraph.yaml, schema, mapping).
   - `sg-recipe2`: exact recipe 2 schema and mapping, including the `try_totalSupply` contract call.
   - `sg-recipe3`: recipe 2 plus the recipe 3 timeseries/aggregation schema and handler code.
   - `sg-recipe3` again with `graph build --network arc-testnet`, using the recipe 4 `networks.json`. It rewrote `network:` and `address:` in subgraph.yaml as documented.
3. **Reproduced errors:**
   - `graph init --product subgraph-studio` gives `Error: Nonexistent flag: --product`.
   - A bare `@entity` gives `@entity directive requires \`immutable\` argument`.
   - The docs' urql `createClient({ url })` gives TS2345 `Property 'exchanges' is missing`.
4. **Type-check** (`tsc -p .`, strict, NodeNext, DOM lib, react-jsx, skipLibCheck false): every TS/TSX block in SKILL.md, quickstart.md and recipes.md (fetch, graphql-request, @urql/core, React+urql, Next.js route handler, pagination) was extracted into `query/src/docs/` and type-checked. Result: **OK**.
5. **GraphQL syntax:** all GraphQL in the query code (6 documents) and in recipes 3 and 6 (8 documents) parsed with `graphql.parse`. This checks syntax only, not a subgraph schema.
6. **Runtime against the live gateway, with no real key:** each query script was run with a fake 32-zero key and a public subgraph ID taken from the docs.
   - Every script reached the gateway and surfaced `auth error: API key not found` through its error path. The Next.js route returned 502 with the error.
   - Captured gateway messages: `missing authorization header` (no key), `malformed API key` (`notarealkey`), `invalid authorization header` (empty Bearer), `API key not found` (well-formed fake). All came back as HTTP 200.
7. **MCP endpoint:** `https://subgraphs.mcp.thegraph.com/sse` returns 200 and `/mcp` returns 404. The `claude mcp add` flags (`--transport sse`, `--header`, `-e`) were checked against `claude mcp add --help`.

## Not tested

- `graph auth` / `graph deploy` to Studio and `graph publish` (need a deploy key and a wallet).
- Actual indexing: no graph-node ran (Docker daemon not running, `gnd` not installed). This means:
  - the mapping logic was never executed;
  - the aggregation query field name (`volumes`) was not checked against a live schema;
  - the `Account_filter` variable type and the `id_gt` pagination were not checked against a live schema. They follow graph-node naming but were only type/syntax-checked.
- A successful query (needs a real API key). The Studio dev URL was not tried, since that needs a deployed subgraph.
- `graph test` (Matchstick). It was removed from the test package and never run.
- Substreams CLI, the World Chain Substreams endpoint, and a self-hosted graph-node for World Chain (recipe 7).
- Token API: `token-api.thegraph.com` timed out from this machine, and `api.pinax.network` returns 401 without a key. x402 client.
- Adding the MCP server for real (doing so would change the user's Claude/Cursor config).

## Doubts for the reviewer

- **World Chain is not supported in Subgraph Studio.** The registry has no `subgraphs` service, and the supported-networks data says `subgraphsStudio: false` and `subgraphsSupportLevel: none`. The board says The Graph "supports World Chain". That is true only for Substreams/Firehose. The skill says this plainly, so check that the board copy does not over-promise.
- **Token API is in flux.** The Graph Market docs still show `token-api.thegraph.com`, but the Token API Quick Start URL redirects to Pinax (`app.pinax.network/docs/api`, base `api.pinax.network`). It is now Pinax-branded. The skill only mentions it briefly, with "check the docs".
- The docs say the Studio dev query URL is "rate-limited, 3,000 queries/day". We could not confirm whether it needs a key, and the skill does not claim either way.
- The nested `orderBy` example uses the docs' `owner__name` shape rather than our test schema, because the docs limit nested sorting to String/ID fields.
- The Claude Code `claude mcp add` commands are our mapping of the official Desktop/Cursor JSON. They are not on an official page.
