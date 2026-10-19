# Goldsky quickstart: from zero to a queried subgraph

Tested 2026-10-19 with `@goldskycom/cli@13.17.1` on Node 24. Sources: [Installation](https://docs.goldsky.com/installation), [Deploy a subgraph](https://docs.goldsky.com/subgraphs/deploying-subgraphs), [Low-code subgraphs](https://docs.goldsky.com/subgraphs/guides/create-a-low-code-subgraph), [GraphQL endpoints](https://docs.goldsky.com/subgraphs/graphql-endpoints), [Pricing](https://docs.goldsky.com/pricing/summary).

## 1. Account and project

1. Sign up at https://app.goldsky.com/signup with Google, GitHub or email. A **team** and a **project** are created for you. Subgraphs, pipelines, secrets and API keys all belong to a project.
2. Go to **Project Settings** (https://app.goldsky.com/dashboard/settings). Create an API key only if you need one: for CI or a headless login, or to query **private** endpoints. Copy it straight away. Goldsky stores only a hash of the key and cannot show it again ([FAQ](https://docs.goldsky.com/faq)).

## 2. Install the CLI and log in

```sh
npm install -g @goldskycom/cli@13.17.1   # Windows instructions in the docs; works on macOS/Linux too
goldsky --version                        # 13.17.1
goldsky login                            # opens a browser, no key to paste
# headless / CI:
goldsky login --token <GOLDSKY_API_KEY>
goldsky login --no-browser               # prints the login URL instead
```

- The docs' macOS/Linux installer pipes a shell script from goldsky.com into `sh`. It downloads a standalone binary from `cli.goldsky.com`. This skill uses npm, so you can pin the version and avoid piping a script into your shell.
- The CLI sends anonymous telemetry. You can turn it off with `goldsky telemetry disable` or `GOLDSKY_CLI_TELEMETRY_DISABLED=1`.
- Every command also accepts `--token <key>` instead of a stored login ([CLI reference](https://docs.goldsky.com/reference/cli)).

## 3. Make an instant subgraph from your ABI

You need three things: the contract address, its ABI (the `abi` array from your Foundry/Hardhat build output) and the deploy block.

```
my-indexer/
  abis/Counter.json        # the ABI array
  goldsky-config.json
```

`goldsky-config.json` ([reference](https://docs.goldsky.com/subgraphs/reference/instant-subgraph)):

```json
{
  "version": "1",
  "name": "counter",
  "abis": { "counter": { "path": "./abis/Counter.json" } },
  "instances": [
    {
      "abi": "counter",
      "address": "<CONTRACT_ADDRESS>",
      "startBlock": <DEPLOY_BLOCK>,
      "chain": "arc-testnet"
    }
  ]
}
```

- `"version": "1"` is the version of the config format, not of your subgraph.
- `chain` is a **subgraph slug**. These use hyphens, for example `arc-testnet`. Turbo uses underscores for the same chain (`arc_testnet`). See [chains.md](chains.md).
- Keep ABI names lowercase. `goldsky subgraph init --from-config` failed with `Failed to locate ABIs` when the key was `Counter` (see [errors.md](errors.md)).
- Set `startBlock` to your deploy block. Starting from 0 makes indexing slow, and you pay for the worker hours while it catches up.

Optional local check, with no account needed. This validates the config and writes the files, but the build itself needs a login:

```sh
goldsky subgraph init counter/1.0.0 --from-config goldsky-config.json --target-path ./out
```

This check only fits simple single-contract configs. In testing, `init` dropped factory instances and `enrich` blocks from the files it wrote. It also rejected the documented multi-chain pattern (the same ABI on two chains) with `Duplicate normalized contract name`. For those configs, skip `init` and run `deploy --from-abi` directly.

## 4. Deploy

```sh
goldsky subgraph deploy counter/1.0.0 --from-abi goldsky-config.json
```

Goldsky generates the schema and mappings, deploys the subgraph and prints the endpoint. Pass the config file to `--from-abi`, not the ABI itself ([guide](https://docs.goldsky.com/subgraphs/guides/create-a-low-code-subgraph)). Watch progress with `goldsky subgraph list` or in the dashboard at https://app.goldsky.com.

Give it a stable URL so you can redeploy without touching your frontend:

```sh
goldsky subgraph tag create counter/1.0.0 --tag prod
```

## 5. Endpoint format

```
public:  https://api.goldsky.com/api/public/<PROJECT_ID>/subgraphs/<name>/<version or tag>/gn
private: https://api.goldsky.com/api/private/<PROJECT_ID>/subgraphs/<name>/<version or tag>/gn   (Authorization: Bearer <API_KEY>)
```

New subgraphs have the public endpoint on and the private one off. Switch them with `goldsky subgraph update counter/prod --public-endpoint disabled --private-endpoint enabled` ([docs](https://docs.goldsky.com/subgraphs/graphql-endpoints)). Public endpoints are limited to 50 requests per 10 seconds, so proxy them through your backend if you expect traffic.

Open the endpoint URL in a browser to get GraphiQL, where you can see the generated schema. Instant subgraphs create one entity per event (for example, `Transfer` becomes `transfers`). Each entity has the event parameters as fields plus `timestamp_`, `transactionHash_` and other `_`-suffixed metadata. Check the exact names in GraphiQL before you write queries.

## 6. Query it (complete script)

`package.json` needs `"type": "module"`. Run `npm i -D tsx typescript @types/node`. Then create `.env`:

```
GOLDSKY_SUBGRAPH_URL=https://api.goldsky.com/api/public/<PROJECT_ID>/subgraphs/counter/prod/gn
# GOLDSKY_API_TOKEN=<YOUR_API_KEY>   # only for /api/private/ endpoints
```

`query.ts` (type-checked and run in testing):

```ts
// query.ts: read the latest Transfer events from a Goldsky subgraph
const url = process.env.GOLDSKY_SUBGRAPH_URL!; // https://api.goldsky.com/api/public/<project_id>/subgraphs/<name>/<version or tag>/gn
const token = process.env.GOLDSKY_API_TOKEN;    // only for /api/private/... endpoints

const query = /* GraphQL */ `
  query Latest($first: Int!) {
    _meta { block { number } hasIndexingErrors }
    transfers(first: $first, orderBy: timestamp_, orderDirection: desc) {
      id
      from
      to
      value
      timestamp_
      transactionHash_
    }
  }
`;

type Transfer = { id: string; from: string; to: string; value: string; timestamp_: string; transactionHash_: string };
type Result = { _meta: { block: { number: number }; hasIndexingErrors: boolean }; transfers: Transfer[] };

export async function latestTransfers(first = 5): Promise<Result> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables: { first } }),
  });
  const json = (await res.json()) as { data?: Result; errors?: { message: string }[]; message?: string };
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${json.message ?? json.errors?.[0]?.message}`); // 401/404/429 come back as { statusCode, message }
  if (json.errors?.length) throw new Error(json.errors[0].message); // GraphQL errors
  return json.data!;
}

latestTransfers().then((d) => console.log(JSON.stringify(d, null, 2))).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
```

```sh
npx tsx --env-file=.env query.ts
```

Use `_meta.block.number` to show how far the subgraph has indexed.

## Free plan limits

From [Pricing](https://docs.goldsky.com/pricing/summary), checked 2026-10-19:

| | Starter (free, no card) | Scale (add a card, pay as you go) |
| --- | --- | --- |
| Credit | **One-time $100**, never resets | none |
| Monthly free allowance | **none**: usage is charged from the first unit against the credit | 3 subgraph workers, about 100K stored entities, 1 pipeline worker, 1M pipeline writes |
| Subgraph worker after that | ~$0.05/hour (~$36.50/month) | same |
| Pipeline worker (size `s`) | ~$0.10/hour (~$73/month) | same |
| When money runs out | subgraphs, pipelines and endpoints are **paused**; you are never billed | billed monthly |

- Every **version** of a subgraph is its own worker and storage. Delete old versions (`goldsky subgraph delete name/1.0.0`) ([FAQ](https://docs.goldsky.com/faq)).
- Pausing stops billing, but a subgraph left paused for a long time may be deleted.
- Subgraph webhooks are free ([guide](https://docs.goldsky.com/subgraphs/guides/send-subgraph-driven-webhooks)). A pipeline that has a single subgraph as its source and webhook sinks is not metered as a pipeline.
- Public endpoint rate limit: 50 requests per 10 seconds by default ([endpoints](https://docs.goldsky.com/subgraphs/graphql-endpoints)).
- For a 36-hour hackathon, one or two subgraphs fit easily in the $100 credit. Starter is also safe: when the credit runs out, things pause and you are never charged.
- Partner chains: on 0G and Unichain, Goldsky marks subgraphs as **Partner Sponsored**. The chain covers that usage "if approved" by the chain team, and you get an access code from their devrel ([0G page](https://docs.goldsky.com/chains/0g)).
