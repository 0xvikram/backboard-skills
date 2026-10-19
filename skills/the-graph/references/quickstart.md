# The Graph quickstart (full)

Goal: index the `Transfer` events of an ERC-20 on Unichain, deploy to Subgraph Studio and query the result. Based on the [Subgraphs Quick Start](https://thegraph.com/docs/en/subgraphs/quick-start/), [Install the Graph CLI](https://thegraph.com/docs/en/subgraphs/developing/creating/install-the-cli/) and [Deploy to Studio](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/).

The example indexes WETH at `0x4200000000000000000000000000000000000006`, the standard OP Stack predeploy, which Unichain uses. Swap in your own contract.

## 1. Accounts and keys

| What | Where | Used for |
| --- | --- | --- |
| **Deploy key** | https://thegraph.com/studio/ → connect wallet → **Create a Subgraph** (name it like "My App Unichain") → the deploy key is on the subgraph's page | `graph auth`, `graph deploy` |
| **Subgraph slug** | Same page | `graph init`, `graph deploy` |
| **API key** (for queries on the network gateway) | Studio → **API Keys** → **Create API Key**. Optional: set a monthly spending limit. Under the key's **Security** section, add allowed domains and subgraphs ([docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/)). | `https://gateway.thegraph.com/api/...` |

Limits to know ([Studio docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/), [querying docs](https://thegraph.com/docs/en/subgraphs/querying/introduction/), [fair use](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/fair-use-policy/)):
- 3 deployed (unpublished) subgraphs per account.
- The Studio dev query URL allows 3,000 queries/day.
- The Free Plan includes 100,000 gateway queries/month.
- A subgraph must sync within 14 days, and free storage is 10 GB.

## 2. Install

```sh
npm i -g @graphprotocol/graph-cli@0.98.1   # needs Node >= 20.18.1
graph --version                            # @graphprotocol/graph-cli/0.98.1
```

Without a global install, use `npx -p @graphprotocol/graph-cli@0.98.1 graph <command>`.

## 3. Scaffold

Save the ABI (only the events and functions you need) to `WETH.json`:

```json
[
 {"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":true,"name":"dst","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Transfer","type":"event"},
 {"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
]
```

```sh
graph init my-subgraph my-subgraph --protocol ethereum \
  --from-contract 0x4200000000000000000000000000000000000006 \
  --network unichain --abi ./WETH.json --contract-name WETH \
  --start-block 0 --index-events
cd my-subgraph
npm i @graphprotocol/graph-ts@0.38.2     # init pinned 0.37.0 in our test
```

You get `subgraph.yaml`, `schema.graphql`, `src/weth.ts`, `abis/`, `networks.json`, a `docker-compose.yml` for a local graph-node, and `tests/` (Matchstick).

**Set `--start-block` to your contract's deploy block.** `0` scans the whole chain and is slow.

## 4. The three files

`subgraph.yaml` (as generated, cut down to one handler):

```yaml
specVersion: 1.3.0
indexerHints:
  prune: auto
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: WETH
    network: unichain            # see chains.md for names
    source:
      address: "0x4200000000000000000000000000000000000006"
      abi: WETH
      startBlock: 0              # use your deploy block
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9
      language: wasm/assemblyscript
      entities:
        - Account
        - Transfer
      abis:
        - name: WETH
          file: ./abis/WETH.json
      eventHandlers:
        - event: Transfer(indexed address,indexed address,uint256)
          handler: handleTransfer
      file: ./src/weth.ts
```

`schema.graphql`:

```graphql
type Account @entity(immutable: false) {
  id: Bytes!                     # the address
  balance: BigInt!
  transferCount: Int!
  sent: [Transfer!]! @derivedFrom(field: "from")
  received: [Transfer!]! @derivedFrom(field: "to")
}

type Transfer @entity(immutable: true) {
  id: Bytes!                     # tx hash + log index
  from: Account!
  to: Account!
  value: BigInt!
  blockNumber: BigInt!
  timestamp: BigInt!
  txHash: Bytes!
}
```

`src/weth.ts`:

```ts
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { Transfer as TransferEvent } from "../generated/WETH/WETH"
import { Account, Transfer } from "../generated/schema"

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
}
```

Mappings are AssemblyScript, not TypeScript. You cannot import npm packages such as ethers ([FAQ](https://thegraph.com/docs/en/subgraphs/developing/developer-faq/)). Use the `graph-ts` types (`BigInt`, `Bytes`, `Address`) and their methods (`.plus()`, `.minus()`, `.equals()`). WETH's `Deposit` and `Withdrawal` events mint and burn without a `Transfer`, so these balances are a demo, not exact WETH balances.

## 5. Build

```sh
graph codegen   # writes generated/ from schema + ABIs; rerun after every schema/ABI change
graph build     # compiles to build/ (wasm); catches AssemblyScript type errors
```

## 6. Deploy to Studio

```sh
graph auth <DEPLOY_KEY>
graph deploy my-subgraph          # asks for a version label, e.g. v0.0.1
# or non-interactive:
graph deploy my-subgraph --version-label v0.0.1
```

Open the subgraph in Studio. Watch the sync progress and **Logs**, and try queries in the **Playground**. Each new deploy archives the previous unpublished version.

Publishing to the decentralized network is optional for a hackathon. It is an on-chain action on Arbitrum One. Use **Publish** in Studio or `graph publish` ([docs](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/publishing-a-subgraph/)).

## 7. Query

`.env`:

```
GRAPH_API_KEY=<YOUR_API_KEY>
SUBGRAPH_ID=<SUBGRAPH_ID>
```

`query.ts`:

```ts
const apiKey = process.env.GRAPH_API_KEY;
const subgraphId = process.env.SUBGRAPH_ID;
if (!apiKey || !subgraphId) throw new Error("Set GRAPH_API_KEY and SUBGRAPH_ID");

const url = `https://gateway.thegraph.com/api/subgraphs/id/${subgraphId}`;

const query = /* GraphQL */ `
  query LatestTransfers($first: Int!) {
    transfers(first: $first, orderBy: blockNumber, orderDirection: desc) {
      id
      from { id }
      to { id }
      value
      blockNumber
    }
    _meta { block { number } hasIndexingErrors }
  }
`;

const res = await fetch(url, {
  method: "POST", // the gateway wants POST (GET can return 405)
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({ query, variables: { first: 5 } }),
});

const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
console.log(JSON.stringify(json.data, null, 2));
```

Run it with `npx tsx --env-file=.env query.ts`. Put `"type": "module"` in `package.json` so top-level `await` works.

- **Before publishing:** query the Studio dev URL instead (`https://api.studio.thegraph.com/query/<ID>/<SLUG>/<VERSION>`, copied from Studio). It is for testing only and rate-limited ([docs](https://thegraph.com/docs/en/subgraphs/querying/from-an-application/)).
- **After publishing:** the gateway also accepts the key in the path: `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>` ([docs](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/managing-api-keys/)).
