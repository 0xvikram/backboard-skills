# Envio recipes (HyperIndex V3 + HyperSync)

Each recipe was type-checked with `envio@3.14.0` (after `envio codegen`) or `@envio-dev/hypersync-client@1.4.1` on 2026-10-19. What was actually run is in TESTED.md. Placeholders look like `<CONTRACT_ADDRESS>`.

## 1. Scaffold an indexer without prompts

**Goal:** create a project in one command, for scripts, CI or AI agents.
**Docs:** https://docs.envio.dev/docs/HyperIndex/cli-commands, https://docs.envio.dev/docs/HyperIndex/quickstart

```sh
# a) Verified contract: the ABI comes from the block explorer (proxies resolve to the implementation ABI)
npx envio@3.14.0 init contract-import explorer -b unichain -c <CONTRACT_ADDRESS> \
  --single-contract --all-events -n my-indexer -d my-indexer -l typescript \
  --package-manager npm --api-token <YOUR_ENVIO_API_TOKEN>

# b) Your own (unverified) contract: local ABI JSON, any chain ID
npx envio@3.14.0 init contract-import local -a ./abis/MyContract.json --contract-name MyContract \
  -b 5042002 -c <CONTRACT_ADDRESS> -s <DEPLOY_BLOCK> --single-contract --all-events \
  -n my-indexer -d my-indexer -l typescript --package-manager npm --api-token <YOUR_ENVIO_API_TOKEN>

# c) RPC-only chain (no HyperSync): add -r; no token needed
npx envio@3.14.0 init contract-import local -a ./abis/MyContract.json --contract-name MyContract \
  -b 296 -r https://testnet.hashio.io/api -c <CONTRACT_ADDRESS> -s <DEPLOY_BLOCK> \
  --single-contract --all-events -n my-indexer -d my-indexer -l typescript --package-manager npm

# d) Template: greeter | erc20 | feature-external-calls | feature-factory
npx envio@3.14.0 init template -t erc20 -l typescript -n my-indexer -d my-indexer \
  --package-manager npm --api-token <YOUR_ENVIO_API_TOKEN>
```

Notes:
- Explorer names for `-b` (Unichain is `unichain` / `unichain-sepolia`, World Chain is `worldchain`) are listed in `npx envio@3.14.0 init contract-import explorer --help`. Arc, Hedera and 0G are not on that list, so use `contract-import local` with the chain ID.
- `--single-contract` and `--all-events` skip the follow-up prompts. Without them the CLI waits for input.
- For a contract you just deployed with Foundry or Hardhat, the ABI is in `out/<Name>.sol/<Name>.json` or `artifacts/.../<Name>.json`. A Foundry-style artifact (an object with an `abi` key) worked in `config.yaml` as `abi_file_path:` with `- event: Deposit` in testing. We only tested `init ... local -a` with a plain ABI array, so if it rejects an artifact, extract the array: `jq .abi out/X.sol/X.json > abis/X.json`.
- After you edit the contract and its ABI, update the event signatures in `config.yaml` and run `npx envio codegen` again ([common issues](https://docs.envio.dev/docs/HyperIndex/common-issues)).

## 2. Multichain config.yaml with HyperSync and RPC-only chains

**Goal:** index the same contracts on Unichain, World Chain and Hedera testnet.
**Docs:** https://docs.envio.dev/docs/HyperIndex/configuration-file, https://docs.envio.dev/docs/HyperIndex/rpc-sync, https://docs.envio.dev/docs/HyperIndex/multichain-indexing

```yaml
# yaml-language-server: $schema=./node_modules/envio/evm.schema.json
name: recipes-indexer
disable_default_cross_chain: true # entities are per chain; mark shared ones with @crossChain
contracts:
  - name: VaultFactory
    events:
      - event: VaultCreated(address indexed vault, address indexed asset)
  - name: Vault
    events:
      - event: Deposit(address indexed user, uint256 amount)
  - name: ERC20
    events:
      - event: Transfer(address indexed from, address indexed to, uint256 value)
chains:
  - id: 130 # Unichain (HyperSync)
    start_block: 0
    contracts:
      - name: VaultFactory
        address: "${ENVIO_FACTORY_UNICHAIN:-<FACTORY_ADDRESS>}"
      - name: Vault # no address: added at runtime by contractRegister (recipe 3)
      - name: ERC20 # no address + wildcard handler (recipe 4)
  - id: 480 # World Chain (HyperSync)
    start_block: latest # start at the current head (v3.11+)
    contracts:
      - name: VaultFactory
        address: "<FACTORY_ADDRESS>"
      - name: Vault
  - id: 296 # Hedera testnet: no HyperSync, so rpc is required
    rpc: ${ENVIO_HEDERA_TESTNET_RPC:-https://testnet.hashio.io/api}
    start_block: <DEPLOY_BLOCK> # RPC sync from 0 is very slow
    contracts:
      - name: VaultFactory
        address: "<FACTORY_ADDRESS>"
      - name: Vault
```

Notes:
- `id` must be a **number**. `id: arc` or `id: unichain` fails codegen with `invalid type: string`, even though some envio.dev chain pages show it.
- `rpc` can also be a list with roles: `- url: ... for: sync|realtime|fallback`. You can add `headers:` too (v3.3+). On a HyperSync chain, an RPC entry acts only as a fallback or realtime source.
- `${ENVIO_VAR}` and `${ENVIO_VAR:-default}` work anywhere in `config.yaml`. Variables must start with `ENVIO_`.
- To check whether Envio has HyperSync for a chain: if `npx envio codegen` fails with `Failed to automatically find HyperSync endpoint for the chain <id>`, the chain needs `rpc:`.
- With `disable_default_cross_chain: true` (added by `init`), the same `id` on two chains gives two rows, and each row gets a `chainId` column.

## 3. Factory contracts and eth_call with effects

**Goal:** index every vault a factory deploys, and read the vault asset's `decimals()` once per asset.
**Docs:** https://docs.envio.dev/docs/HyperIndex/dynamic-contracts, https://docs.envio.dev/docs/HyperIndex/effect-api

`schema.graphql`:

```graphql
type Vault {
  id: ID! # vault address
  asset: String!
  assetDecimals: Int!
  totalDeposited: BigInt!
}
```

`src/effects.ts`:

```ts
import { createEffect, S } from "envio";
import { createPublicClient, http, erc20Abi } from "viem";
import { unichain } from "viem/chains";

const client = createPublicClient({
  chain: unichain,
  transport: http(process.env.ENVIO_UNICHAIN_RPC, { batch: true }),
});

// Calls from handlers go through an effect: batched, deduped, rate-limited, optionally cached.
export const getDecimals = createEffect(
  {
    name: "getDecimals",
    input: S.string,
    output: S.number,
    rateLimit: { calls: 10, per: "second" },
    cache: true,
  },
  async ({ input }) => {
    return await client.readContract({
      address: input as `0x${string}`,
      abi: erc20Abi,
      functionName: "decimals",
    });
  },
);
```

`src/handlers/Factory.ts`:

```ts
import { indexer } from "envio";
import { getDecimals } from "../effects.js";

// 1. Register each new vault so its events get indexed (runs before the handlers).
indexer.contractRegister(
  { contract: "VaultFactory", event: "VaultCreated" },
  async ({ event, context }) => {
    context.chain.Vault.add(event.params.vault);
  },
);

// 2. Save the vault, using an eth_call through the effect.
indexer.onEvent(
  { contract: "VaultFactory", event: "VaultCreated" },
  async ({ event, context }) => {
    const decimals = await context.effect(getDecimals, event.params.asset);
    context.Vault.set({
      id: event.params.vault,
      asset: event.params.asset,
      assetDecimals: decimals,
      totalDeposited: 0n,
    });
  },
);

// 3. Events from every registered vault.
indexer.onEvent({ contract: "Vault", event: "Deposit" }, async ({ event, context }) => {
  const vault = await context.Vault.getOrThrow(event.srcAddress);
  context.Vault.set({ ...vault, totalDeposited: vault.totalDeposited + event.params.amount });
});
```

Notes:
- Install viem yourself (`npm i viem@2.57.7`). viem 2.57.7 exports `unichain`, `unichainSepolia`, `worldchain`, `worldchainSepolia`, `arc`, `arcTestnet`, `hederaTestnet` and `zeroGTestnet` (16602) from `viem/chains`. On a multichain indexer, pass the chain ID in the effect input (for example `input: { address: S.string, chainId: S.number }`) and choose the matching client inside the effect.
- The effect function must be `async`. One example on the event-handlers page leaves the keyword out, and that does not compile.
- In V3, `context.addVault(...)` is now `context.chain.Vault.add(...)`.

## 4. Wildcard events, `where` filters and block handlers

**Goal:** store every ERC20 mint on Unichain, whatever the token, and run a job every 1,000 blocks.
**Docs:** https://docs.envio.dev/docs/HyperIndex/wildcard-indexing, https://docs.envio.dev/docs/HyperIndex/block-handlers

```ts
// src/handlers/ERC20.ts
import { indexer } from "envio";

const ZERO = "0x0000000000000000000000000000000000000000" as const; // `as const` keeps the 0x${string} type

indexer.onEvent(
  {
    contract: "ERC20",
    event: "Transfer",
    wildcard: true, // any contract that emits Transfer
    // filter on indexed params; return false to skip a chain
    where: ({ chain }) => (chain.id === 130 ? { params: [{ from: ZERO }] } : false),
  },
  async ({ event, context }) => {
    context.Mint.set({
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      token: event.srcAddress,
      to: event.params.to,
      value: event.params.value,
    });
  },
);
```

```ts
// src/handlers/Blocks.ts
import { indexer } from "envio";

// Runs on EVERY chain unless `where` says otherwise.
indexer.onBlock(
  {
    name: "EveryThousandBlocks",
    where: ({ chain }) => (chain.id === 130 ? { block: { number: { _every: 1000 } } } : false),
  },
  async ({ block, context }) => {
    context.log.info(`chain ${context.chain.id} block ${block.number}`);
  },
);
```

Schema used: `type Mint { id: ID! token: String! to: String! value: BigInt! }`.

Notes:
- `params: [a, b]` means a OR b. Inside one object, `{ from: X, to: Y }` means AND. A value can be an array, which means "any of".
- Mark a contract as wildcard by listing it under the chain **without** an `address`.
- You can test it offline: `indexer.process({ chains: { 130: { simulate: [{ contract: "ERC20", event: "Transfer", params: { from: ZERO, to, value: 5n } }] } } })`, then `await indexer.Mint.getAll()`.

## 5. Query the GraphQL API from an app

**Goal:** read indexed data in a frontend or script.
**Docs:** https://docs.envio.dev/docs/HyperIndex/navigating-hasura, https://docs.envio.dev/docs/HyperIndex/observability, https://docs.envio.dev/docs/HyperIndex/websockets

```ts
// Local: http://localhost:8080/v1/graphql (envio dev). Envio Cloud: the endpoint shown for your deployment.
const GRAPHQL_URL = process.env.INDEXER_GRAPHQL_URL ?? "http://localhost:8080/v1/graphql";

const query = /* GraphQL */ `
  query TopAccounts($limit: Int!) {
    Account(limit: $limit, order_by: { balance: desc }) {
      id
      balance
      depositCount
      deposits(limit: 3) { amount txHash }
    }
    _meta { chainId progressBlock isReady }
  }
`;

const res = await fetch(GRAPHQL_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { limit: 10 } }),
});
const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
if (json.errors) throw new Error(json.errors[0]!.message); // GraphQL errors come back with HTTP 200
console.log(JSON.stringify(json.data, null, 2));
```

Notes:
- Entity names are the GraphQL root fields (`Account`, `Deposit`). Filters use Hasura syntax: `where: { balance: { _gt: "0" } }`, `order_by`, `limit`, `offset`.
- Aggregates like `Account_aggregate` work locally but are **not exposed on Envio Cloud**. Keep counters in entities instead (see the Navigating Hasura page).
- Use `_meta { progressBlock isReady }` to tell whether the indexer has caught up before you trust the numbers.
- For live updates, use a GraphQL subscription over `ws://localhost:8080/v1/graphql` ([WebSockets](https://docs.envio.dev/docs/HyperIndex/websockets)).

## 6. Deploy to Envio Cloud

**Goal:** a hosted GraphQL endpoint for your demo.
**Docs:** https://docs.envio.dev/docs/HyperIndex/hosted-service-deployment, https://docs.envio.dev/docs/HyperIndex/hosted-service-billing, https://docs.envio.dev/docs/HyperIndex/envio-cloud-cli

1. Push the indexer to GitHub. `package.json` must sit in the root folder you set, with `envio` pinned in `dependencies`. The build must work with pnpm 10.32.0. The repo must be under 100 MB.
2. Open https://envio.dev/app/login and sign in with GitHub. Choose an organisation, then install the **Envio Deployments** GitHub App for the repo.
3. Click **Add Indexer**. Set the config file path, the root directory (needed for monorepos) and the **deployment branch**.
4. Under **Settings → Environment Variables**, add secrets such as an RPC URL. **Names must start with `ENVIO_`**. HyperSync access is built in, so you do not need `ENVIO_API_TOKEN` there.
5. Push to the deployment branch. Every push makes a new deployment that re-indexes from `start_block`. The old one keeps serving until the new one has synced.
6. Copy the GraphQL endpoint from the deployment page, or run `npx envio-cloud deployment endpoint <indexer> <commit>` after `npx envio-cloud login`.

Notes:
- Free **Development** plan: 3 indexers per organisation and 3 deployments per indexer. A deployment is deleted after 30 days at most, or after it passes 100k events, 5 GB of storage, or 7 days without requests (soft limits, which start a 7 + 3 day deletion process). It is for testing only.
- On hosted deployments the endpoint is public by default. API-key auth and IP allow-lists exist (see the `envio-cloud` CLI docs).

## 7. HyperSync client: raw logs fast

**Goal:** pull all `Transfer` logs of one token from the last 1,000 Unichain blocks, without writing an indexer.
**Docs:** https://docs.envio.dev/docs/HyperSync/hypersync-clients, https://docs.envio.dev/docs/HyperSync/hypersync-query, client README and examples: https://github.com/enviodev/hypersync-client-node

```sh
npm i @envio-dev/hypersync-client@1.4.1
```

```ts
// transfers.ts  (ESM: "type": "module"; run with: ENVIO_API_TOKEN=<YOUR_ENVIO_API_TOKEN> npx tsx transfers.ts)
import { HypersyncClient, Decoder, type Query } from "@envio-dev/hypersync-client";

const client = new HypersyncClient({
  url: "https://unichain.hypersync.xyz", // chain 130; Arc: arc / arc-testnet, World Chain: worldchain
  apiToken: process.env.ENVIO_API_TOKEN!,
  maxNumRetries: 1, // fail fast on a bad token instead of retrying ~12 times
});

const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const height = await client.getHeight();

const query: Query = {
  fromBlock: height - 1_000,
  toBlock: height, // exclusive
  logs: [{ address: ["<TOKEN_ADDRESS>"], topics: [[TRANSFER]] }],
  fieldSelection: {
    block: ["Number", "Timestamp"],
    log: ["BlockNumber", "LogIndex", "TransactionHash", "Address", "Data", "Topic0", "Topic1", "Topic2"],
  },
};

const decoder = Decoder.fromSignatures([
  "Transfer(address indexed from, address indexed to, uint256 value)",
]);

// get() returns one page (server time limit). Continue from nextBlock until toBlock.
while (query.fromBlock < query.toBlock!) {
  const res = await client.get(query);
  const decoded = await decoder.decodeLogs(res.data.logs);
  decoded.forEach((d, i) => {
    if (!d) return;
    const [from, to] = d.indexed;
    console.log(res.data.logs[i]!.blockNumber, from!.val, "->", to!.val, d.body[0]!.val);
  });
  query.fromBlock = res.nextBlock;
}
```

Notes:
- Field names are PascalCase strings (`"Topic0"`, `"TransactionHash"`). Only the fields you select come back.
- Decoded values sit in `indexed[]` (indexed params) and `body[]` (the rest). `.val` is `bigint`, `string`, `boolean` or an array.
- `client.stream(query, {})` and `client.collect(query, {})` handle pagination and parallelism for big ranges. `client.collectParquet(path, query, {})` writes Parquet files.
- In testing, `getHeight()` worked **without** a token, but `get`, `stream`, `collect` and `getChainId` all returned 401.
- You can build and try queries in the browser at https://builder.hypersync.xyz.
- HyperRPC (`https://<chain>.rpc.hypersync.xyz`) is a read-only JSON-RPC endpoint backed by HyperSync, so you can point viem at it for heavy `eth_getLogs` work ([HyperRPC](https://docs.envio.dev/docs/HyperRPC/overview-hyperrpc)). It also needs a token, and HyperRPC tokens are separate from HyperSync tokens.
