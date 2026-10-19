# the-graph: tests

Run from the repo root: `node scripts/verify.mjs the-graph` (add `--full` for the subgraph builds). No keys, no deploys.

| Script | What it checks |
| --- | --- |
| `typecheck` (`typecheck.mjs`) | Strict `tsc` over every app-side TS/TSX block (fetch, graphql-request, @urql/core, React + urql, Next.js route, pagination, the urql `exchanges` fix in errors.md). Mapping blocks (they import `@graphprotocol/graph-ts` or `../generated/`) are AssemblyScript, so they are left to `build`. Also runs `graphql.parse` on every GraphQL document embedded in the blocks (syntax only). |
| `live` (`live.mjs`) | Against the real gateway, with a public subgraph ID (Uniswap v3) and no real key: the three auth error messages come back as HTTP 200 + `errors[]` (no key, malformed key, unknown key). Then every gateway block is actually run (scripts via `tsx`, exported functions imported) with a well-formed fake key and must surface `auth error: API key not found` through its own error path; the Next.js `GET` must return 502. Also checks `https://subgraphs.mcp.thegraph.com/sse` answers 200 `text/event-stream`. |
| `build` (`build.mjs`, `--full`) | `graph codegen && graph build` (graph-cli 0.98.1, graph-ts 0.38.2) on two subgraphs in `app/`: **quickstart** (manifest, schema and ABI copied verbatim from references/quickstart.md + the mapping block) and **recipes** (recipe 2 mapping with the recipe 3 TransferPoint lines spliced into the handler, recipe 2 + 3 schema), the latter built with `--network arc-testnet` and checked that `networks.json` rewrote `subgraph.yaml` (recipe 4). |

`globals.d.ts` declares `url` because the errors.md urql fix is a two-line fragment that uses the reader's own `url`.

**Not checked:** `graph auth` / `graph deploy` / `graph publish` (deploy key + wallet), real indexing (no graph-node, so mapping logic, the `volumes` field name and `Account_filter` are not checked against a live schema), a successful query (needs an API key), Substreams / World Chain, Token API and x402, `graph test` (Matchstick), adding the MCP server to a client. The manifest/schema/ABI in `app/` are copies of the markdown blocks (the runner only extracts TS/JS), so if those yaml/graphql/json blocks change, update `app/` too.

No `verify:skip` lines.
