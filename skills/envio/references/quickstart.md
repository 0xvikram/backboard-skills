# Envio HyperIndex quickstart (V3)

This guide builds a complete indexer for a vault contract with `Deposit` and `Withdraw` events on **Arc testnet** (5042002, a HyperSync chain). It tracks each user's balance and keeps a list of deposits, and serves both over GraphQL.

Tested 2026-10-19 with `envio@3.14.0` on Node 24 (macOS arm64). `envio codegen`, `tsc --noEmit` and `vitest` all passed. `envio dev` was not run because Docker was not running. Sources: [Quickstart](https://docs.envio.dev/docs/HyperIndex/quickstart), [CLI reference](https://docs.envio.dev/docs/HyperIndex/cli-commands), [Event handlers](https://docs.envio.dev/docs/HyperIndex/event-handlers), [Testing](https://docs.envio.dev/docs/HyperIndex/testing).

## 0. Prerequisites

- Node.js **22.15 or newer**. The generated `package.json` sets `"engines": { "node": ">=22.15.0" }`, and Node 24 is recommended ([migrate-to-v3](https://docs.envio.dev/docs/HyperIndex/migrate-to-v3)).
- A package manager. pnpm is the default; npm, yarn and bun also work with `--package-manager`.
- **Docker Desktop or Podman, running**, but only to run the indexer locally. Codegen, type-checks and tests do not need it ([quickstart prerequisites](https://docs.envio.dev/docs/HyperIndex/quickstart)).

## 1. Get a HyperSync API token

HyperSync rejects requests without a token with HTTP 401 ([API tokens](https://docs.envio.dev/docs/HyperSync/api-tokens)).

1. Open https://envio.dev/app/api-tokens and sign in (GitHub). You land on **HyperSync tokens** for your personal organisation.
2. Under **Tokens by package**, click **Free package** to expand it. The token form only appears after you expand it.
3. Type a **Token name** (for example `ethglobal`) and click **Create**.
4. Copy the token from the **Token created** window. You can reveal a free-package token again later. You cannot do that for a paid one.

You do **not** need a token if every chain in your config uses an RPC (`rpc:`), or for indexers running on Envio Cloud.

## 2. Scaffold

Save the ABI as `abis/Vault.json` (only the events are needed):

```json
[
  {"type":"event","name":"Deposit","anonymous":false,"inputs":[{"name":"user","type":"address","indexed":true},{"name":"amount","type":"uint256","indexed":false}]},
  {"type":"event","name":"Withdraw","anonymous":false,"inputs":[{"name":"user","type":"address","indexed":true},{"name":"amount","type":"uint256","indexed":false}]}
]
```

Then run (non-interactive; every flag comes from `envio init --help`):

```sh
npx envio@3.14.0 init contract-import local \
  -a ./abis/Vault.json --contract-name Vault \
  -b 5042002 -c <CONTRACT_ADDRESS> -s <DEPLOY_BLOCK> \
  --single-contract --all-events \
  -n vault-indexer -d vault-indexer -l typescript \
  --package-manager npm --api-token <YOUR_ENVIO_API_TOKEN>
cd vault-indexer
```

- With no flags at all (`npx envio@3.14.0 init`), you get the guided wizard instead.
- When it runs non-interactively, `init` **requires** `--api-token` or `ENVIO_API_TOKEN` for HyperSync chains, and fails without one. For an RPC-only chain, pass `-r <RPC_URL>` and no token is needed.
- `-b` takes a chain ID or one of the explorer names listed in `envio init contract-import explorer --help`.

What you get: `config.yaml`, `schema.graphql`, `src/handlers/Vault.ts`, `src/indexer.test.ts`, `.env`, `tsconfig.json`, `envio-env.d.ts`, `.claude/skills/*`, `node_modules`, and a new git repo.

`.env` (never commit it; the scaffold's `.gitignore` covers it, but check):

```sh
ENVIO_API_TOKEN="<YOUR_ENVIO_API_TOKEN>"
```

## 3. config.yaml

Contract import writes the events inside the chain entry. The form below, with the contract defined once at the top level, is the one shown in the [config docs](https://docs.envio.dev/docs/HyperIndex/configuration-file). It is easier to extend to more chains.

```yaml
# yaml-language-server: $schema=./node_modules/envio/evm.schema.json
name: vault-indexer
disable_default_cross_chain: true # added by init; entities are per-chain (id + chainId)
contracts:
  - name: Vault
    events:
      - event: Deposit(address indexed user, uint256 amount)
      - event: Withdraw(address indexed user, uint256 amount)
chains:
  - id: 5042002 # Arc Testnet (HyperSync)
    start_block: 0 # 0 is fine on HyperSync (it skips ahead); your deploy block is better
    contracts:
      - name: Vault
        address: "<CONTRACT_ADDRESS>"
```

## 4. schema.graphql

```graphql
type Account {
  id: ID! # user address
  balance: BigInt!
  depositCount: Int!
  deposits: [Deposit!]! @derivedFrom(field: "account")
}

type Deposit {
  id: ID! # chainId_block_logIndex
  account: Account!
  amount: BigInt!
  timestamp: Int!
  txHash: String!
}
```

Every entity needs `id` of type `ID!`, `String!`, `Int!` or `BigInt!`. `BigInt` maps to `bigint` and `Int` to `number`. A relation field `account: Account!` is written as `account_id` in handlers ([schema docs](https://docs.envio.dev/docs/HyperIndex/schema)).

## 5. src/handlers/Vault.ts

Handlers in `src/handlers/` are found automatically. Everything is imported from `"envio"`.

```ts
import { indexer } from "envio";

indexer.onEvent(
  // `fields` picks extra block/tx fields. Once you pass it, list every field you read
  // (block.number is always there).
  { contract: "Vault", event: "Deposit", fields: { transaction: ["hash"], block: ["timestamp"] } },
  async ({ event, context }) => {
    const account = await context.Account.getOrCreate({
      id: event.params.user,
      balance: 0n,
      depositCount: 0,
    });
    context.Account.set({
      ...account,
      balance: account.balance + event.params.amount,
      depositCount: account.depositCount + 1,
    });
    context.Deposit.set({
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      account_id: event.params.user,
      amount: event.params.amount,
      timestamp: event.block.timestamp,
      txHash: event.transaction.hash,
    });
  },
);

indexer.onEvent(
  { contract: "Vault", event: "Withdraw" },
  async ({ event, context }) => {
    const account = await context.Account.getOrThrow(event.params.user);
    context.Account.set({ ...account, balance: account.balance - event.params.amount });
  },
);
```

Notes:
- `context.X.set` is synchronous; `get`, `getOrCreate`, `getOrThrow` and `getWhere` are async.
- Handlers **run twice** (a preload pass, then the real pass). Never call `fetch` or an RPC directly in a handler. Use `createEffect` instead ([recipes.md section 3](recipes.md#3-factory-contracts-and-eth_call-with-effects)).

## 6. Codegen, type-check, test

```sh
npx envio codegen      # regenerates types in .envio/ from config.yaml + schema.graphql
npx tsc --noEmit
npm test               # vitest
```

`src/indexer.test.ts`. It needs no network, no token and no Docker:

```ts
import { describe, it } from "vitest";
import { createTestIndexer, TestHelpers } from "envio";

describe("Vault", () => {
  it("tracks balance and deposit count", async (t) => {
    const indexer = createTestIndexer();
    const user = TestHelpers.Addresses.defaultAddress;

    await indexer.process({
      chains: {
        5042002: {
          simulate: [
            { contract: "Vault", event: "Deposit", params: { user, amount: 100n } },
            { contract: "Vault", event: "Deposit", params: { user, amount: 50n } },
            { contract: "Vault", event: "Withdraw", params: { user, amount: 30n } },
          ],
        },
      },
    });

    const account = await indexer.Account.getOrThrow(user);
    t.expect(account.balance).toBe(120n);
    t.expect(account.depositCount).toBe(2);
  });
});
```

The scaffold also adds a "smoke test" that calls `indexer.process({ chains: { 5042002: {} } })`. That test fetches real blocks from HyperSync, so it needs a valid `ENVIO_API_TOKEN`. Without one it retries 401s until vitest times out.

## 7. Run locally

```sh
npm run dev            # = envio dev; starts Postgres + Hasura in Docker, then indexes
```

- GraphQL endpoint: `http://localhost:8080/v1/graphql`
- Hasura console: `http://localhost:8080`, with admin secret `testing` ([navigating Hasura](https://docs.envio.dev/docs/HyperIndex/navigating-hasura))
- Postgres runs on host port `5433`. Change it with `ENVIO_PG_PORT`.
- Handler edits hot-reload. For a config, schema or ABI change, run `npx envio dev -r` (clears the DB and re-indexes).
- `npx envio stop` removes the local containers and database.

Try this query in the console:

```graphql
query {
  Account(limit: 10, order_by: { balance: desc }) { id balance depositCount }
  _meta { chainId progressBlock isReady }
}
```

`_meta` shows per-chain progress ([observability](https://docs.envio.dev/docs/HyperIndex/observability)).

## 8. Deploy

See [recipes.md section 6](recipes.md#6-deploy-to-envio-cloud).
