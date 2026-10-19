# Goldsky recipes

All CLI flags were checked against `goldsky --help` for @goldskycom/cli 13.17.1 and the [CLI reference](https://docs.goldsky.com/reference/cli). The TypeScript in recipes 4 and 5 was type-checked (TS 5.9.3, strict) and run in testing. You need `goldsky login` before any deploy, webhook or pipeline command.

## 1. Deploy a subgraph from source

**Goal:** you already have a graph-cli project (`subgraph.yaml`, `schema.graphql`, mappings) and want Goldsky to host it.
Based on: https://docs.goldsky.com/subgraphs/deploying-subgraphs

```sh
# inside your subgraph project, built with The Graph's CLI
npx graph codegen && npx graph build
goldsky subgraph deploy my-subgraph/1.0.0 --path .
```

Notes:
- In `subgraph.yaml`, set `network:` to the **Goldsky** slug, such as `hedera-testnet` or `0g-galileo-testnet` ([chains.md](chains.md)). Goldsky uses its own slugs, so `graph build` accepting a name does not mean Goldsky will.
- The name must start with a letter and contain only letters, numbers, `_` and `-`. The version can be any label, such as `1.0.0` or `v2`.
- `--start-block <n>` overrides the start block at deploy time. `--description` adds notes.
- Scaffold from scratch without graph-cli: `goldsky subgraph init` runs a wizard that fetches the ABI from an explorer and can `--build --deploy` ([no-code guide](https://docs.goldsky.com/subgraphs/guides/create-a-no-code-subgraph)).

## 2. Instant subgraph from an ABI

**Goal:** a GraphQL API over your contract's events with no mapping code.
Based on: https://docs.goldsky.com/subgraphs/reference/instant-subgraph and https://docs.goldsky.com/subgraphs/guides/create-a-low-code-subgraph

Single contract: see [quickstart.md](quickstart.md#3-make-an-instant-subgraph-from-your-abi). Deploy with `goldsky subgraph deploy name/1.0.0 --from-abi goldsky-config.json`.

**Factory** (a factory emits `PoolCreated(address,address,bool)`, then each pool is indexed):

```json
{
  "version": "1",
  "name": "pools",
  "abis": {
    "factory": { "path": "./abis/factory.json" },
    "pool": { "path": "./abis/pool.json" }
  },
  "instances": [
    { "abi": "factory", "address": "<FACTORY_ADDRESS>", "startBlock": <DEPLOY_BLOCK>, "chain": "unichain-testnet" },
    {
      "abi": "pool",
      "source": { "abi": "factory", "eventSignature": "PoolCreated(address,address,bool)", "addressParam": "pool" }
    }
  ]
}
```

**Same contract on two chains:** add one instance per chain. You get **one subgraph per chain**, each with the same schema:

```json
"instances": [
  { "abi": "counter", "address": "<ADDR_ON_ARC>", "startBlock": <BLOCK>, "chain": "arc-testnet" },
  { "abi": "counter", "address": "<ADDR_ON_0G>", "startBlock": <BLOCK>, "chain": "0g-galileo-testnet" }
]
```

**Enrichment** (make an `eth_call` inside the handler and save the result as a new entity):

```json
"enrich": {
  "handlers": {
    "Transfer(indexed address,indexed address,indexed uint256)": {
      "calls": { "bal": { "name": "balanceOf", "params": "event.params.to" } },
      "entities": {
        "EnrichmentBalance": {
          "owner address": "event.params.to.toHexString()",
          "balance uint256": "calls.bal"
        }
      }
    }
  }
}
```

Notes:
- Put `enrich` inside an instance. Write the handler key exactly as the event signature in the ABI, including `indexed`.
- Add `"enableCallHandlers": true` (or `--enable-call-handlers`) to also index function calls.
- All three configs are valid JSON and match the reference. Do not use `goldsky subgraph init --from-config` to check them: in testing it dropped the factory instance and the `enrich` block, and it rejected the multi-chain config. Deploy with `--from-abi` instead.
- If you use several ABIs, fields or events with the same name can clash and cause `store error: column "x" specified more than once`. Split them into separate subgraphs ([FAQ](https://docs.goldsky.com/faq)).

## 3. Migrate a subgraph from The Graph

**Goal:** move a subgraph that runs on The Graph to Goldsky without changing its code.
Based on: https://docs.goldsky.com/subgraphs/migrate-from-the-graph

```sh
# get the deployment hash from the old endpoint:   query { _meta { deployment } }
goldsky subgraph deploy my-subgraph/1.0.0 --from-ipfs-hash <Qm...DEPLOYMENT_HASH>
# or point at any public subgraph GraphQL endpoint
goldsky subgraph deploy my-subgraph/1.0.0 --from-url <OLD_GRAPHQL_ENDPOINT>
goldsky subgraph list my-subgraph/1.0.0      # indexing progress
```

Notes:
- Goldsky runs the same WASM indexing layer as graph-node ([intro](https://docs.goldsky.com/subgraphs/introduction)), so the GraphQL API is the same and only the URL changes in your app.
- If Goldsky has already indexed the same IPFS hash, the subgraph shows 100% synced at once. That is expected ([FAQ](https://docs.goldsky.com/faq)).
- If the manifest uses grafting, use `--remove-graft` to strip it. `--graft-from <name>/<version>` grafts from one of **your Goldsky** subgraphs, starting at its latest block.

## 4. Query the endpoint

**Goal:** read subgraph data from a frontend or backend.
Based on: https://docs.goldsky.com/subgraphs/graphql-endpoints

Plain `fetch`: see [quickstart.md](quickstart.md#6-query-it-complete-script).

**graphql-request** (`npm i graphql-request@7.4.0 graphql@16.14.2`, ESM):

```ts
// gql-request.ts: same query with graphql-request
import { GraphQLClient, gql } from "graphql-request";

const client = new GraphQLClient(process.env.GOLDSKY_SUBGRAPH_URL!, {
  headers: process.env.GOLDSKY_API_TOKEN ? { Authorization: `Bearer ${process.env.GOLDSKY_API_TOKEN}` } : {},
});

const LATEST = gql`
  query Latest($first: Int!) {
    transfers(first: $first, orderBy: timestamp_, orderDirection: desc) {
      id
      from
      to
      value
    }
  }
`;

type Data = { transfers: { id: string; from: string; to: string; value: string }[] };

const data = await client.request<Data>(LATEST, { first: 5 });
console.log(data.transfers);
```

**Fetch everything** with `id_gt` cursor pagination. `first` is capped at 1000, and large `skip` values are slow:

```ts
// paginate.ts: fetch every entity with id_gt cursor pagination (max 1000 per page)
const url = process.env.GOLDSKY_SUBGRAPH_URL!;

type Row = { id: string; from: string; to: string; value: string };

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[]; message?: string };
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${json.message ?? json.errors?.[0]?.message}`);
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

export async function allTransfersTo(to: string): Promise<Row[]> {
  const out: Row[] = [];
  let lastId = "";
  for (;;) {
    const { transfers } = await gql<{ transfers: Row[] }>(
      `query Page($to: String!, $lastId: String!) {
        transfers(first: 1000, orderBy: id, orderDirection: asc, where: { to: $to, id_gt: $lastId }) {
          id from to value
        }
      }`,
      { to: to.toLowerCase(), lastId },
    );
    out.push(...transfers);
    if (transfers.length < 1000) return out;
    lastId = transfers[transfers.length - 1].id;
  }
}
```

Notes:
- Addresses are stored in lowercase, so lowercase them before you filter.
- Subscriptions are not supported. Poll the endpoint, or use webhooks (recipe 5) ([FAQ](https://docs.goldsky.com/faq)).
- Private endpoint: change `/api/public/` to `/api/private/` and send `Authorization: Bearer <API_KEY>`. Keys are scoped to one project. Never ship a key in frontend code; call the endpoint from your backend instead.
- The variable type for an address filter depends on the generated schema. Instant subgraphs store addresses as `String` (per the docs). Check in GraphiQL whether yours is `String` or `Bytes`.

## 5. Webhooks on subgraph entities

**Goal:** get an HTTP POST every time a subgraph entity is inserted, updated or deleted, for example to send a Discord ping or update your DB.
Based on: https://docs.goldsky.com/subgraphs/webhooks and https://docs.goldsky.com/subgraphs/guides/send-subgraph-driven-webhooks

```sh
goldsky subgraph webhook list-entities counter/1.0.0          # valid --entity values
goldsky subgraph webhook create counter/1.0.0 \
  --name counter-transfers --entity transfer \
  --url https://<YOUR_HOST>/goldsky-hook \
  --secret <YOUR_WEBHOOK_SECRET>          # optional; otherwise the CLI prints a whs_... secret
goldsky subgraph webhook list
goldsky subgraph webhook delete counter-transfers
```

Receiver: Node, no framework. It was run locally and tested with a sample payload, a wrong secret (401) and a repeated event (de-duplicated):

```ts
// webhook-server.ts: receive Goldsky subgraph webhooks (node:http, no framework)
import { createServer } from "node:http";

const SECRET = process.env.GOLDSKY_WEBHOOK_SECRET!; // the whs_... value printed by `goldsky subgraph webhook create`

type Payload = {
  op: "INSERT" | "UPDATE" | "DELETE";
  data_source: string;
  entity: string;
  webhook_name: string;
  id: string; // unique event id, use it to de-duplicate retries
  data: { old: Record<string, unknown> | null; new: Record<string, unknown> | null };
  delivery_info: { max_retries: number; current_retry: number };
};

const seen = new Set<string>();

createServer((req, res) => {
  if (req.method !== "POST") return void res.writeHead(405).end();
  if (req.headers["goldsky-webhook-secret"] !== SECRET) return void res.writeHead(401).end();
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const p = JSON.parse(body) as Payload;
    if (!seen.has(p.id)) {
      seen.add(p.id);
      const row = p.data.new;
      // Latest-state rule from the docs: on INSERT/UPDATE upsert by row.id; the highest vid is the newest version.
      console.log(p.op, p.entity, row?.id, row?.vid, row?.block_range);
    }
    res.writeHead(200).end("ok");
  });
}).listen(Number(process.env.PORT ?? 3000), () => console.log("listening"));
```

Notes:
- Goldsky sends the secret in the `goldsky-webhook-secret` header ([guide](https://docs.goldsky.com/subgraphs/guides/send-subgraph-driven-webhooks)).
- When a **mutable** entity is updated, you get two events: an `INSERT` for the new version and an `UPDATE` that closes the old version's `block_range`. They can arrive in any order. Upsert by `id` and keep the row with the highest `vid`. Immutable entities (such as event entities) only produce `INSERT`.
- Deliveries are retried (`delivery_info.max_retries`), so de-duplicate on the payload `id`.
- Use the `<entity>` name in lowercase, as `list-entities` shows it. Fields in the payload are snake_case DB columns (`block_number`, `transaction_hash`), not GraphQL camelCase.
- For a quick test without a server, point `--url` at https://webhook.site (use `https://webhook.site/<id>`, not the `/#!/` URL).
- For guaranteed delivery into a database, Goldsky suggests a pipeline instead (recipe 6).

## 6. Turbo pipeline: chain data to Postgres or a webhook

**Goal:** stream raw or decoded chain data (all ERC-20 transfers, or every log from your contract) into your own DB or API, with backfill. Use this for "Mirror"-style work. Turbo is the current engine, and Mirror is legacy.
Based on: https://docs.goldsky.com/turbo-pipelines/quickstart, https://docs.goldsky.com/turbo-pipelines/sources/evm and https://docs.goldsky.com/turbo-pipelines/sinks/webhook

Install the Turbo extension. `goldsky turbo install` downloads it into `~/.goldsky/bin` (tested). The docs' alternative pipes a shell script into `sh`.

```sh
goldsky turbo install
goldsky turbo list
```

ERC-20 transfers of one token on Arc testnet, sent to a webhook (`arc-token-webhook.yaml`):

```yaml
name: arc-testnet-erc20-webhook
resource_size: s

sources:
  arc_transfers:
    type: dataset
    dataset_name: arc_testnet.erc20_transfers
    version: 1.1.0
    start_at: latest

transforms:
  my_token_transfers:
    type: sql
    primary_key: id
    sql: |
      SELECT id, address, sender, recipient, amount, block_number, transaction_hash
      FROM arc_transfers
      WHERE address = lower('<TOKEN_ADDRESS>')

sinks:
  my_webhook:
    type: webhook
    from: my_token_transfers
    url: https://<YOUR_HOST>/goldsky-hook
    secret_name: MY_WEBHOOK_SECRET
    one_row_per_request: true
```

Backfill every log of your contract on 0G mainnet into Postgres (`zerog-logs.yaml`). The source-level `filter` turns on "fast scan":

```yaml
name: zerog-contract-logs
resource_size: s

sources:
  zerog_logs:
    type: dataset
    dataset_name: 0g.raw_logs
    version: 1.1.0
    start_at: earliest
    filter: address = '<CONTRACT_ADDRESS_LOWERCASE>'

transforms: {}

sinks:
  postgres_logs:
    type: postgres
    from: zerog_logs
    schema: public
    table: zerog_logs
    secret_name: MY_POSTGRES_SECRET
    primary_key: id
```

```sh
goldsky secret create MY_POSTGRES_SECRET      # paste postgres://user:pass@host:5432/db
goldsky secret create                         # choose type httpauth for the webhook header (e.g. Authorization: Bearer <token>)
goldsky turbo validate zerog-logs.yaml
goldsky turbo apply zerog-logs.yaml
goldsky turbo inspect zerog-logs.yaml         # live view of rows
goldsky turbo logs zerog-logs.yaml
goldsky turbo delete zerog-logs               # stop paying for the worker
```

Notes:
- `dataset_name` is `<turbo_slug>.<dataset>`. Turbo slugs use underscores (`arc_testnet`, `unichain_testnet`), unlike subgraph slugs. The **version differs per chain**: `worldchain.raw_logs` is 1.0.0, `unichain_testnet.erc20_transfers` is 1.3.0, and most others were 1.1.0 on 2026-10-19. Look each one up at https://app.goldsky.com/explore/<slug>/<dataset> (no login needed) or with `goldsky dataset list`.
- The YAML must have a `transforms:` key, even an empty `{}`. Without it, `turbo validate` failed in testing with `missing field 'transforms'`.
- Columns: erc20_transfers has `id, address, sender, recipient, amount, transaction_hash, block_number, block_timestamp, log_index` ([schema](https://docs.goldsky.com/turbo-pipelines/reference/schema/curated-schemas)). In `raw_logs`, `topics` is a comma-separated string, so match events with `topics LIKE '0x<sig_hash>%'`.
- Delivery is at least once. Set `primary_key` so Postgres upserts, and de-duplicate in your webhook handler.
- Each running `s` pipeline is a billed worker. Delete it when you are done.
- To stream **subgraph entities** into a DB, you still need legacy Mirror: `goldsky pipeline create <name>`, then choose "Project Subgraph" ([Mirror subgraph source](https://docs.goldsky.com/mirror/sources/subgraphs)). Turbo has no subgraph source yet ([migration guide](https://docs.goldsky.com/turbo-pipelines/migrate-from-mirror)).
- Hedera and 0G Galileo testnet have **no** Turbo datasets. Use a subgraph plus webhooks there ([chains.md](chains.md)).

## 7. Tags, versions, logs and cleanup

Based on: https://docs.goldsky.com/subgraphs/tags and https://docs.goldsky.com/reference/cli

```sh
goldsky subgraph deploy counter/1.0.1 --from-abi goldsky-config.json
goldsky subgraph tag create counter/1.0.1 --tag prod     # .../subgraphs/counter/prod/gn now serves 1.0.1
goldsky subgraph log counter/1.0.1 --since 10m --filter warn
goldsky subgraph list --filter deployments
goldsky subgraph pause counter/1.0.0                     # stops billing
goldsky subgraph delete counter/1.0.0 -f                 # each version is billed separately
```

Notes:
- Point your app at the tag URL, never at a version URL. Then a redeploy only means moving the tag.
- Goldsky emails the team and may auto-pause a subgraph that stops making progress ([stalled subgraphs](https://docs.goldsky.com/subgraphs/stalled-subgraphs)). Check `goldsky subgraph log` for mapping errors.
