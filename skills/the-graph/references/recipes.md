# The Graph recipes

Tested 2026-10-19 with @graphprotocol/graph-cli@0.98.1 and @graphprotocol/graph-ts@0.38.2: `graph codegen` and `graph build` ran on recipes 1 to 4. The query code in recipes 5 and 6 was type-checked with TypeScript 5.9 against graphql-request@7.4.0, @urql/core@6.0.3, urql@5.0.4 and graphql@16.14.2. Nothing was deployed or queried against a real subgraph (no keys were used).

## 1. Scaffold from a contract

**Goal:** get a working subgraph folder for a contract you already deployed.

```sh
graph init <SLUG> <DIR> --protocol ethereum \
  --from-contract <CONTRACT_ADDRESS> \
  --network unichain-testnet \
  --abi ./MyContract.json \
  --contract-name MyContract \
  --start-block <DEPLOY_BLOCK> \
  --index-events
```

**Notes**
- `--index-events` makes one immutable entity and handler per event, which gives you a working base to edit.
- With every flag given, init runs without prompts. Leave a flag out and it asks. It also runs `npm install` and `codegen` (add `--skip-install` to skip that).
- The CLI needs the ABI as a plain JSON array. Foundry: `jq .abi out/MyContract.sol/MyContract.json > MyContract.json`. Hardhat: `jq .abi artifacts/contracts/MyContract.sol/MyContract.json > MyContract.json`.
- To index a second contract later, run `graph add <ADDRESS> --abi <FILE> --contract-name Other`.
- **Factory pattern** (a contract that deploys contracts): use `templates:` in the manifest and call `MyTemplate.create(address)` in the factory handler ([manifest docs](https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/)).

Source: https://thegraph.com/docs/en/subgraphs/developing/creating/install-the-cli/

## 2. Balances per account (schema and mapping)

**Goal:** keep one mutable row per user (balance, counters) plus an immutable row per event, and link them.

```graphql
type Account @entity(immutable: false) {
  id: Bytes!
  balance: BigInt!
  transferCount: Int!
  sent: [Transfer!]! @derivedFrom(field: "from")
  received: [Transfer!]! @derivedFrom(field: "to")
}

type Transfer @entity(immutable: true) {
  id: Bytes!
  from: Account!
  to: Account!
  value: BigInt!
  blockNumber: BigInt!
  timestamp: BigInt!
  txHash: Bytes!
}

type Token @entity(immutable: false) {
  id: Bytes!
  totalSupply: BigInt!
}
```

```ts
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { WETH, Transfer as TransferEvent } from "../generated/WETH/WETH"
import { Account, Token, Transfer } from "../generated/schema"

function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address)
  if (account == null) {
    account = new Account(address)
    account.balance = BigInt.zero()
    account.transferCount = 0
  }
  return account
}

export function handleTransfer(event: TransferEvent): void {
  let from = getOrCreateAccount(event.params.src)
  from.balance = from.balance.minus(event.params.wad)
  from.transferCount = from.transferCount + 1
  from.save()

  let to = getOrCreateAccount(event.params.dst)
  to.balance = to.balance.plus(event.params.wad)
  to.transferCount = to.transferCount + 1
  to.save()

  let transfer = new Transfer(event.transaction.hash.concatI32(event.logIndex.toI32()))
  transfer.from = from.id
  transfer.to = to.id
  transfer.value = event.params.wad
  transfer.blockNumber = event.block.number
  transfer.timestamp = event.block.timestamp
  transfer.txHash = event.transaction.hash
  transfer.save()

  // Optional: read contract state. Each call slows indexing, so prefer event data.
  let token = Token.load(event.address)
  if (token == null) token = new Token(event.address)
  let supply = WETH.bind(event.address).try_totalSupply()
  token.totalSupply = supply.reverted ? BigInt.zero() : supply.value
  token.save()
}
```

**Notes**
- List every entity a handler writes under `mapping.entities` in `subgraph.yaml`.
- Store the link on the "one" side (`Transfer.from`) and derive the "many" side with `@derivedFrom`. Arrays of entities are slow.
- Use `Bytes!` ids (addresses, `hash.concatI32(logIndex)`). They are faster than `String!` ids.
- Mark event-like entities `immutable: true`. Every `@entity` must state `immutable` with CLI 0.98.x.
- Always use `try_` contract calls, so a revert does not crash indexing.
- A required (`!`) field left unset makes the handler fail at runtime, not at build time.

Sources: https://thegraph.com/docs/en/subgraphs/developing/creating/ql-schema/, https://thegraph.com/docs/en/subgraphs/developing/creating/graph-ts/api/, https://thegraph.com/docs/en/subgraphs/best-practices/avoid-eth-calls/

## 3. Hourly and daily stats (timeseries + aggregations)

**Goal:** charts (volume per hour or day) without writing bucket logic yourself.

```graphql
type TransferPoint @entity(timeseries: true) {
  id: Int8!
  timestamp: Timestamp!
  value: BigInt!
}

type Volume @aggregation(intervals: ["hour", "day"], source: "TransferPoint") {
  id: Int8!
  timestamp: Timestamp!
  volume: BigInt! @aggregate(fn: "sum", arg: "value")
  transfers: Int8! @aggregate(fn: "count")
}
```

In the handler (add `TransferPoint` to `mapping.entities`):

```ts
import { TransferPoint } from "../generated/schema"
// ...
let point = new TransferPoint(0) // graph-node sets id and timestamp itself
point.value = event.params.wad
point.save()
```

Query (timestamps are **microseconds** since epoch, as strings):

```graphql
{
  volumes(interval: "day", where: { timestamp_gte: "1730764800000000" }) {
    timestamp
    volume
    transfers
  }
}
```

**Notes**
- Needs `specVersion` 1.1.0 or later. The scaffold uses 1.3.0.
- Functions: `sum`, `count`, `min`, `max`, `first`, `last`. Add a non-aggregated field (for example `token: Token!`) to both types to group by it.
- Results come newest first. Add `current: include` to include the bucket that is still filling.
- The query field name comes from the type name, so `Volume` becomes `volumes`. Check it in the Studio Playground.

Sources: https://thegraph.com/docs/en/subgraphs/best-practices/timeseries/, https://github.com/graphprotocol/graph-node/blob/master/docs/aggregations.md

## 4. Deploy to Studio and switch networks

**Goal:** deploy the same code to testnet and mainnet with different addresses.

`networks.json` (`graph init` writes it, and the key under each network is the dataSource `name`):

```json
{
  "unichain-testnet": { "WETH": { "address": "0x4200000000000000000000000000000000000006", "startBlock": 0 } },
  "unichain":         { "WETH": { "address": "0x4200000000000000000000000000000000000006", "startBlock": 0 } },
  "arc-testnet":      { "WETH": { "address": "<YOUR_ARC_TESTNET_CONTRACT>", "startBlock": 0 } }
}
```

```sh
graph build --network arc-testnet              # rewrites network/address/startBlock in subgraph.yaml
graph auth <DEPLOY_KEY>
graph deploy <SLUG> --network arc-testnet --version-label v0.0.2
```

**Notes**
- Make one Studio subgraph per chain. A subgraph indexes one network.
- `--network` **edits `subgraph.yaml` in place**. Commit before you switch, or you may later deploy the wrong chain by mistake.
- Each deploy archives the previous unpublished version. You can have 3 unpublished subgraphs per account.
- Studio shows sync progress, logs (indexing errors appear here) and a Playground.

Sources: https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/multiple-networks/, https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/

## 5. Query from an app

**Endpoints** ([docs](https://thegraph.com/docs/en/subgraphs/querying/from-an-application/)):
- Studio (dev, before publishing, 3,000 queries/day): `https://api.studio.thegraph.com/query/<ID>/<SLUG>/<VERSION>`
- Gateway (published): `https://gateway.thegraph.com/api/subgraphs/id/<SUBGRAPH_ID>` with the header `Authorization: Bearer <API_KEY>`. Or put the key in the path: `.../api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`.

### graphql-request (Node or browser)

```sh
npm i graphql-request@7.4.0 graphql@16.14.2
```

```ts
import { GraphQLClient, gql } from "graphql-request";

type Transfer = { id: string; from: { id: string }; to: { id: string }; value: string; blockNumber: string };
type Result = { transfers: Transfer[] };

const client = new GraphQLClient(
  `https://gateway.thegraph.com/api/subgraphs/id/${process.env.SUBGRAPH_ID}`,
  { headers: { Authorization: `Bearer ${process.env.GRAPH_API_KEY}` } },
);

const TRANSFERS_TO = gql`
  query TransfersTo($to: String!, $min: BigInt!) {
    transfers(
      first: 20
      orderBy: timestamp
      orderDirection: desc
      where: { to: $to, value_gte: $min }
    ) {
      id
      from { id }
      to { id }
      value
      blockNumber
    }
  }
`;

export async function transfersTo(address: string): Promise<Transfer[]> {
  const data = await client.request<Result>(TRANSFERS_TO, {
    to: address.toLowerCase(), // Bytes ids are lowercase hex
    min: "1000000000000000000", // BigInt is passed as a string
  });
  return data.transfers;
}
```

graphql-request 7 is ESM-only and needs `graphql` 14 to 16 as a peer (not 17).

### urql (core, no React)

```sh
npm i @urql/core@6.0.3
```

```ts
import { Client, cacheExchange, fetchExchange, gql } from "@urql/core";

export const client = new Client({
  url: `https://gateway.thegraph.com/api/subgraphs/id/${process.env.SUBGRAPH_ID}`,
  exchanges: [cacheExchange, fetchExchange], // required since urql v4
  fetchOptions: { headers: { Authorization: `Bearer ${process.env.GRAPH_API_KEY}` } },
});

const TOP_ACCOUNTS = gql`
  query TopAccounts($first: Int!) {
    accounts(first: $first, orderBy: balance, orderDirection: desc) {
      id
      balance
      transferCount
    }
  }
`;

const result = await client.query(TOP_ACCOUNTS, { first: 10 }).toPromise();
if (result.error) throw result.error;
console.log(result.data);
```

### React + urql

```sh
npm i urql@5.0.4 @urql/core@6.0.3
```

```tsx
// The key is visible in the browser: restrict it to your domain
// and subgraph in Subgraph Studio (API Keys -> Security).
import { Client, Provider, cacheExchange, fetchExchange, useQuery } from "urql";

const GRAPH_API_KEY = "<YOUR_API_KEY>"; // e.g. import.meta.env.VITE_GRAPH_API_KEY in Vite
const SUBGRAPH_ID = "<SUBGRAPH_ID>";

const client = new Client({
  url: `https://gateway.thegraph.com/api/subgraphs/id/${SUBGRAPH_ID}`,
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: { headers: { Authorization: `Bearer ${GRAPH_API_KEY}` } },
});

const TopAccountsQuery = `
  query TopAccounts($first: Int!) {
    accounts(first: $first, orderBy: balance, orderDirection: desc) {
      id
      balance
    }
  }
`;

type Data = { accounts: { id: string; balance: string }[] };

function TopAccounts() {
  const [{ data, fetching, error }] = useQuery<Data>({
    query: TopAccountsQuery,
    variables: { first: 10 },
  });
  if (fetching) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  return (
    <ul>
      {data?.accounts.map((a) => (
        <li key={a.id}>
          {a.id}: {a.balance}
        </li>
      ))}
    </ul>
  );
}

export default function App() {
  return (
    <Provider value={client}>
      <TopAccounts />
    </Provider>
  );
}
```

### Keep the key on a server (Next.js App Router)

`app/api/transfers/route.ts`:

```ts
export async function GET(): Promise<Response> {
  const res = await fetch(
    `https://gateway.thegraph.com/api/subgraphs/id/${process.env.SUBGRAPH_ID}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GRAPH_API_KEY}`,
      },
      body: JSON.stringify({
        query: `{ transfers(first: 10, orderBy: timestamp, orderDirection: desc) { id value } }`,
      }),
    },
  );
  const json = await res.json();
  return Response.json(json.data ?? { error: json.errors }, { status: json.errors ? 502 : 200 });
}
```

**Notes**
- The Graph's FAQ says putting the key in a dapp frontend is the usual approach, if you restrict it to your domain and subgraph in Studio. Use a server route if you want the key hidden ([FAQ #23](https://thegraph.com/docs/en/subgraphs/developing/developer-faq/), [Next.js guide](https://thegraph.com/docs/en/subgraphs/guides/secure-api-keys-nextjs/)).
- `BigInt` and `BigDecimal` come back as **strings**. Convert with `BigInt(x)` or viem's `formatUnits(BigInt(x), 18)`.
- The gateway returns HTTP 200 with an `errors` array for auth and query errors, so always check `errors`.
- For typed results, The Graph's own client (`@graphprotocol/client-cli`) generates types and does auto-pagination. See the [docs](https://thegraph.com/docs/en/subgraphs/querying/from-an-application/).

## 6. GraphQL query patterns

Every entity `Foo` gets a `foo(id:)` field and a `foos(...)` collection field ([GraphQL API](https://thegraph.com/docs/en/subgraphs/querying/graphql-api/)).

```graphql
# filter + order + limit
{ transfers(first: 10, orderBy: value, orderDirection: desc,
            where: { from: "0xabc...", value_gt: "0", timestamp_gte: "1730764800" }) { id value } }

# or / and
{ transfers(where: { or: [{ from: "0xabc..." }, { to: "0xabc..." }] }) { id } }

# filter on a related entity (note the trailing underscore)
{ transfers(where: { from_: { transferCount_gt: 10 } }) { id } }

# order by a field of a related entity: one level deep, String/ID fields only (see docs)
{ tokens(orderBy: owner__name, orderDirection: asc) { id owner { name } } }

# nested collection with its own args
{ account(id: "0xabc...") { balance sent(first: 5, orderBy: timestamp, orderDirection: desc) { id value } } }

# time travel: state as of a block
{ accounts(block: { number: 12345678 }, first: 5) { id balance } }

# how far the subgraph has indexed
{ _meta { block { number timestamp } hasIndexingErrors deployment } }
```

Operators: `_not`, `_gt`, `_gte`, `_lt`, `_lte`, `_in`, `_not_in`, `_contains`, `_contains_nocase`, `_starts_with`, `_ends_with` (and `_nocase` and `_not_` forms), plus `_change_block: { number_gte: N }`.

**Pagination:** `first` defaults to 100 and maxes out at 1000. `skip` gets slow on large offsets, so page by id instead:

```ts
const url = `https://gateway.thegraph.com/api/subgraphs/id/${process.env.SUBGRAPH_ID}`;

type Account = { id: string; balance: string };

export async function allAccounts(): Promise<Account[]> {
  const out: Account[] = [];
  let where: { id_gt?: string } = {}; // first page: no cursor
  for (;;) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GRAPH_API_KEY}`,
      },
      body: JSON.stringify({
        query: `query Page($where: Account_filter!) {
          accounts(first: 1000, orderBy: id, orderDirection: asc, where: $where) {
            id
            balance
          }
        }`,
        variables: { where },
      }),
    });
    const json = (await res.json()) as { data?: { accounts: Account[] }; errors?: { message: string }[] };
    if (json.errors?.length) throw new Error(json.errors[0].message);
    const page = json.data!.accounts;
    out.push(...page);
    if (page.length < 1000) return out;
    where = { id_gt: page[page.length - 1].id };
  }
}
```

**Notes**
- The default order is by `id`, not by time. Always pass `orderBy` for feeds.
- Filter values for `Bytes` must be lowercase hex. Values for `BigInt` are strings.
- `or` is slower than `and` ([docs](https://thegraph.com/docs/en/subgraphs/querying/graphql-api/)).
- The filter input type is `<Entity>_filter`, and the order enum is `<Entity>_orderBy`. Check exact names in the Studio Playground schema.

Sources: https://thegraph.com/docs/en/subgraphs/querying/graphql-api/, https://thegraph.com/docs/en/subgraphs/developing/developer-faq/, https://github.com/graphprotocol/graph-node/blob/master/docs/environment-variables.md (`GRAPH_GRAPHQL_MAX_FIRST`)

## 7. World Chain: Substreams or your own graph-node

**Goal:** index World Chain, which Subgraph Studio does not support today. The registry lists only Firehose/Substreams for `worldchain` ([supported networks](https://thegraph.com/docs/en/supported-networks/)).

**Option A: Substreams** (Rust modules streamed over gRPC, or sunk to a database):
1. Get an API token at https://thegraph.market/ (**API keys**), then `export SUBSTREAMS_API_TOKEN="<YOUR-JWT-TOKEN>"`.
2. The World Chain endpoint (from the [networks registry](https://networks-registry.thegraph.com/TheGraphNetworksRegistry.json)) is `mainnet.worldchain.streamingfast.io:443`.
3. Find a ready-made package on https://substreams.dev, then run it:
   ```sh
   substreams gui -e mainnet.worldchain.streamingfast.io:443 <package>@<version> <module> --start-block=<N>
   ```
   Install the `substreams` CLI and build your own modules following https://docs.substreams.dev/.

**Option B: run graph-node yourself** with a World Chain RPC (for example Alchemy's `worldchain-mainnet`). Use the `docker-compose.yml` from `graph init` and change one line:
```yaml
      ethereum: "worldchain:https://<YOUR_WORLDCHAIN_RPC_URL>"
```
Then:
```sh
docker compose up -d
npm run create-local && npm run deploy-local    # scripts from graph init
# query: http://localhost:8000/subgraphs/name/<SLUG>
```
Or use Graph Node Dev Mode (`graph node install`, then `gnd --ethereum-rpc worldchain:<RPC_URL>`) ([docs](https://thegraph.com/docs/en/subgraphs/developing/creating/graph-node-dev/)). The network name before the colon must match `network:` in `subgraph.yaml`.

Sources: https://thegraph.com/docs/en/substreams/providers/the-graph-market/, https://thegraph.com/docs/en/substreams/quick-start/, https://thegraph.com/docs/en/supported-networks/ ("Running Graph Node locally")

Not tested: neither option was run (no token, Docker daemon not running).

## 8. Token API and x402

- **Token API** (balances, transfers, holders, swaps, no subgraph needed). The Graph Market docs show `GET https://token-api.thegraph.com/v1/evm/balances?network=mainnet&address=<ADDR>` with `Authorization: Bearer <YOUR-JWT-TOKEN>` from thegraph.market. The Token API Quick Start link now redirects to Pinax at https://app.pinax.network/docs/api, which documents `https://api.pinax.network/v1/evm/...`. In the registry, `unichain` lists Token API support and `worldchain` and `arc` do not. Because this is changing, **check the docs** before you build on it. Not tested (needs a token, and `token-api.thegraph.com` timed out from our test machine).
- **x402 pay-per-query:** published subgraphs can be queried without an API key by paying USDC on Base: `POST https://gateway.thegraph.com/api/x402/subgraphs/id/<SUBGRAPH_ID>` with an x402 client (`@graphprotocol/client-x402`). This is useful for agents ([docs](https://thegraph.com/docs/en/subgraphs/tooling/x402-payments/)). Not tested.
