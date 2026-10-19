# goldsky: tests

Run from the repo root: `node scripts/verify.mjs goldsky` (add `--full` for the CLI checks). No Goldsky account, login or API key.

| Script | What it checks |
| --- | --- |
| `typecheck` | Strict `tsc` over every TS block (SKILL.md fetch, quickstart `query.ts`, graphql-request, `id_gt` pagination, webhook receiver), then `graphql.parse` on the GraphQL embedded in them (syntax only). |
| `live` (`live.mjs`) | **Docs MCP** `https://docs.goldsky.com/mcp`: `initialize` + `tools/list` with no auth return `search_goldsky`, `query_docs_filesystem_goldsky`, `submit_feedback`. **Endpoint error shapes** from errors.md, as `{ statusCode, message }`: docs sample `uniswap-v3-base/prod` -> 404 `Subgraph not found`, private without key -> 401 `Missing authorization header`, private with a fake key -> 404 `API token not found`. **Each query block is then run for real** against those URLs and must surface the message through its own error path. **Webhook receiver** block runs on a free local port: GET 405, no secret 401, with `goldsky-webhook-secret` 200, the same event id logged once. |
| `build` (`build.mjs`, `--full`) | Goldsky has no local build (generation is a server job after login), so this runs what the pinned CLI (`@goldskycom/cli` 13.17.1) can do without an account, with `HOME` pointed at a throwaway folder: `goldsky subgraph init counter/1.0.0 --from-config goldsky-config.json` validates the skill's instant-subgraph config (`app/`, placeholders filled with a dummy address/block on `arc-testnet`) and writes `counter-subgraph.json`; the same config with an uppercase ABI key still fails with `Failed to locate ABIs` (errors.md #1); `subgraph deploy --from-abi` and `subgraph list` without login fail with the messages quoted in errors.md #2. |

**Not checked:** login, any real deploy, tags, webhooks create, pause/delete; server-side generation of instant subgraphs (so generated entity/field names such as `transfers`, `timestamp_`, `transactionHash_` are not verified); a successful GraphQL query (no live public Goldsky subgraph exists to test against); Turbo (`turbo validate` needs a separately downloaded extension binary; apply/inspect need login), Mirror, secrets, Postgres sinks; the recipe 2 factory / multi-chain / enrich configs (`init` drops or rejects them, as the skill says); the chain slugs (the CLI accepts any slug, so they were only checked against the docs). The config and ABI in `app/` are copies (the runner only extracts TS/JS blocks).

No `verify:skip` lines.
