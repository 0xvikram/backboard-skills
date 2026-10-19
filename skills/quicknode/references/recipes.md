# QuickNode recipes

All code was type-checked and run on 2026-10-19 with viem@2.57.7, ethers@6.17.0, @quicknode/sdk@3.8.2, TypeScript 7.0.2 and Node 24 (see the test log in the skill repo). RPC code was run against public RPCs and against QuickNode's public `docs-demo` endpoints. Where code says `QUICKNODE_RPC_URL`, put your own endpoint URL there.

Run any file with `npx tsx --env-file=.env file.ts` (`"type": "module"` in `package.json`).

---

## 1. One endpoint for every sponsor chain (viem and ethers)

**Goal:** one client per network, all on your QuickNode endpoint.

Based on: [Multichain endpoint guide](https://www.quicknode.com/guides/quicknode-products/how-to-use-multichain-endpoint), per-chain API overviews ([World Chain](https://www.quicknode.com/docs/worldchain/api-overview), [Unichain](https://www.quicknode.com/docs/unichain/api-overview), [Hedera](https://www.quicknode.com/docs/hedera/api-overview), [Arc](https://www.quicknode.com/docs/arc/api-overview), [0G](https://www.quicknode.com/docs/0g/api-overview)), [viem http transport](https://viem.sh/docs/clients/transports/http).

```ts
import { createPublicClient, http, type Chain } from "viem";
import {
  worldchain, worldchainSepolia,
  unichain, unichainSepolia,
  hedera, hederaTestnet,
  arc, arcTestnet,
  zeroGMainnet, zeroGTestnet,
} from "viem/chains";

// One env var per network. With a Multichain endpoint, only the subdomain changes:
// https://<name>.<network>.quiknode.pro/<token>/  (copy each URL from the dashboard)
const networks: Record<string, { chain: Chain; env: string }> = {
  "worldchain-mainnet": { chain: worldchain, env: "QN_WORLDCHAIN_URL" },
  "worldchain-sepolia": { chain: worldchainSepolia, env: "QN_WORLDCHAIN_SEPOLIA_URL" },
  "unichain-mainnet": { chain: unichain, env: "QN_UNICHAIN_URL" },
  "unichain-sepolia": { chain: unichainSepolia, env: "QN_UNICHAIN_SEPOLIA_URL" },
  "hedera-mainnet": { chain: hedera, env: "QN_HEDERA_URL" },
  "hedera-testnet": { chain: hederaTestnet, env: "QN_HEDERA_TESTNET_URL" },
  "arc-mainnet": { chain: arc, env: "QN_ARC_URL" },
  "arc-testnet": { chain: arcTestnet, env: "QN_ARC_TESTNET_URL" },
  "0g-mainnet": { chain: zeroGMainnet, env: "QN_0G_URL" },
  "0g-galileo": { chain: zeroGTestnet, env: "QN_0G_GALILEO_URL" },
};

export function qnClient(network: keyof typeof networks) {
  const { chain, env } = networks[network];
  const url = process.env[env];
  if (!url) throw new Error(`Set ${env}`);
  return createPublicClient({
    chain,
    // retries failed requests (including HTTP 429) with exponential backoff
    transport: http(url, { retryCount: 3, retryDelay: 1000 }),
  });
}

for (const name of Object.keys(networks)) {
  if (!process.env[networks[name].env]) continue;
  const c = qnClient(name);
  const [id, block] = await Promise.all([c.getChainId(), c.getBlockNumber()]);
  console.log(name, "chainId", id, "expected", networks[name].chain.id, "block", block);
}
```

**Notes**
- Tested: all 10 networks returned the expected chain IDs (480, 4801, 130, 1301, 295, 296, 5042, 5042002, 16661, 16602).
- For 0G use `zeroGMainnet` (16661) and `zeroGTestnet` (16602, Galileo). viem's plain `zeroG` export is the old 16600 testnet.
- The keys in `networks` are labels. The dashboard shows the real subdomain for each network, so copy it from there.
- ethers v6: `new JsonRpcProvider(url, undefined, { staticNetwork: Network.from(480) })` (full example in [quickstart.md](quickstart.md#5-same-thing-with-ethers-v6)).
- Don't turn on viem `batch: true` to "save requests". QuickNode counts every call inside a JSON-RPC batch toward your rate limit ([error reference, 429](https://www.quicknode.com/docs/worldchain/error-references)).

---

## 2. WebSockets: new blocks and contract events

**Goal:** push updates over the endpoint's WSS URL (`eth_subscribe` `newHeads` and `logs`).

Based on: [World Chain eth_subscribe](https://www.quicknode.com/docs/worldchain/eth_subscribe) (supports `newHeads` and `logs`), [Hedera endpoints / WSS limits](https://www.quicknode.com/docs/hedera/endpoints), [WebSocket connection guide](https://www.quicknode.com/guides/infrastructure/how-to-manage-websocket-connections-on-ethereum-node-endpoint), [viem webSocket transport](https://viem.sh/docs/clients/transports/websocket).

```ts
import { createPublicClient, webSocket, parseAbiItem } from "viem";
import { unichain } from "viem/chains";

// WSS Provider URL from the dashboard: wss://<name>.unichain-mainnet.quiknode.pro/<token>/
const wssUrl = process.env.QUICKNODE_WSS_URL;
if (!wssUrl) throw new Error("Set QUICKNODE_WSS_URL");

const client = createPublicClient({
  chain: unichain,
  transport: webSocket(wssUrl, {
    keepAlive: { interval: 30_000 }, // ping so idle sockets are not dropped
    reconnect: { attempts: 10, delay: 1_000 },
  }),
});

// eth_subscribe("newHeads") under the hood
const stopBlocks = client.watchBlocks({
  onBlock: (b) => console.log("block", b.number, "txs", b.transactions.length),
  onError: (e) => console.error("block watch error", e.message),
});

// eth_subscribe("logs", { address, topics }) under the hood
const WETH = "0x4200000000000000000000000000000000000006";
const stopLogs = client.watchEvent({
  address: WETH,
  event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)"),
  onLogs: (logs) => {
    for (const l of logs) console.log("WETH transfer", l.args.from, "->", l.args.to, l.args.value);
  },
  onError: (e) => console.error("log watch error", e.message),
});

// stop after 20 s (for the demo); in a server, keep it running
setTimeout(async () => {
  stopBlocks();
  stopLogs();
  await (await client.transport.getRpcClient()).close();
  process.exit(0);
}, 20_000);
```

**Notes**
- Tested against QuickNode's Unichain mainnet WSS: one block per second, plus decoded WETH `Transfer` events.
- Subscription types per QuickNode docs: `newHeads` and `logs` on World Chain, Unichain, Hedera and 0G. Arc also lists `newPendingTransactions`. Check each chain's `eth_subscribe` page.
- WSS responses have a size cap (error `-32616`). Make large reads over HTTP ([source](https://www.quicknode.com/docs/hedera/endpoints)).
- Subscriptions run only while your process runs. If you need delivery while your server is down, or reorg handling, use Streams (recipe 5).
- Unichain also has Flashblocks subscriptions (`newFlashblocks`, `newFlashblockTransactions`, `pendingLogs`) on the same endpoint ([Flashblocks overview](https://www.quicknode.com/docs/unichain/flashblocks/overview)).

---

## 3. Webhooks: get a POST when a wallet is active

**Goal:** no-code alerts. QuickNode POSTs to your URL when a wallet sends or receives ETH, ERC-20 or ERC-721.

Based on: [Webhooks getting started](https://www.quicknode.com/docs/webhooks), [Create webhook from template](https://www.quicknode.com/docs/webhooks/rest-api/webhooks/webhooks-rest-create-from-template), [Webhooks REST API](https://www.quicknode.com/docs/webhooks/rest-api/getting-started).

**Dashboard way (works on every plan):** [Webhooks](https://dashboard.quicknode.com/webhooks) → **Create Webhook** → pick the chain → template **Wallet transfers** (or **Contract events**) → paste addresses → **Run** on a test block to see the payload → enter your URL → create. Copy the **validation token** for recipe 4.

**REST way:**
```ts
// Create a QuickNode Webhook from a template: notify on any activity of a wallet on World Chain Sepolia.
// Docs: https://www.quicknode.com/docs/webhooks/rest-api/webhooks/webhooks-rest-create-from-template
const API_KEY = process.env.QN_API_KEY; // dashboard -> API Keys
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WALLET = process.env.WALLET;
if (!API_KEY || !WEBHOOK_URL || !WALLET) throw new Error("Set QN_API_KEY, WEBHOOK_URL, WALLET");

const res = await fetch("https://api.quicknode.com/webhooks/rest/v1/webhooks/template/evmWalletFilter", {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json", "x-api-key": API_KEY },
  body: JSON.stringify({
    name: "wallet-watch",
    network: "worldchain-sepolia", // also: worldchain-mainnet, unichain-sepolia, hedera-testnet, arc-testnet, zerog-galileo ...
    destination_attributes: { url: WEBHOOK_URL, compression: "none" }, // security_token is generated if omitted
    templateArgs: { wallets: [WALLET] },
  }),
});
const body = await res.json();
console.log(res.status, body);
// Save body.destination_attributes.security_token -> QN_SECURITY_TOKEN for verify-webhook.ts
```

**Same with `@quicknode/sdk`** (Node on macOS Apple Silicon or Linux only, see [platform support](https://www.quicknode.com/docs/sdk#platform-support)):
```ts
import { QuicknodeSdk, TemplateArgs } from "@quicknode/sdk";

const qn = QuicknodeSdk.fromEnv(); // reads QN_SDK__API_KEY

const webhook = await qn.webhooks.createWebhookFromTemplate({
  name: "wallet-watch",
  network: "worldchain-sepolia",
  destinationAttributes: { url: process.env.WEBHOOK_URL!, compression: "none" },
  templateArgs: TemplateArgs.evmWalletFilter({ wallets: [process.env.WALLET!] }),
  // or the literal form: { templateId: "evmWalletFilter", args: { wallets: [...] } }
});
console.log(webhook.id, webhook.status, webhook.destinationAttributes); // destinationAttributes is a JSON string
```

**Notes**
- Templates: `evmWalletFilter` (`wallets`), `evmContractEvents` (`contracts`, `eventHashes`), `evmAbiFilter` (`abi`, optional `contracts`). Network slugs for the sponsor chains: `worldchain-mainnet|sepolia`, `unichain-mainnet|sepolia`, `hedera-mainnet|testnet`, `arc-mainnet|testnet`, `zerog-mainnet|galileo` (from the [Webhooks OpenAPI](https://api.quicknode.com/webhooks/rest/openapi.json)).
- Cost: 30 API credits per delivered payload. Free plan: 1 active webhook.
- Type-checked only. Not run, because it needs a real API key. The SDK sample on the docs page uses `templateArgs: { templateId, wallet }`, which does not type-check with SDK 3.8.2 (see [errors](errors.md#2-sdk-sample-for-webhooks-does-not-type-check)).
- Local testing: expose your server with `ngrok http 3000` and use `https://<id>.ngrok.app/webhook`. Or point the webhook at https://webhook.site first to see the payload.

---

## 4. Verify the X-QN-Signature HMAC

**Goal:** reject requests that did not come from your Stream or Webhook.

Based on: [Validating incoming Streams webhook messages](https://www.quicknode.com/guides/quicknode-products/streams/validating-incoming-streams-webhook-messages), the official sample [quiknode-labs/streams-webhook-validate-signature](https://github.com/quiknode-labs/streams-webhook-validate-signature), [Webhook destination security](https://www.quicknode.com/docs/streams/destinations/webhooks#security). Webhooks use the same scheme ([Webhooks security](https://www.quicknode.com/docs/webhooks#security)).

The rule: `hex(HMAC_SHA256(key = security token, msg = X-QN-Nonce + X-QN-Timestamp + body))` must equal `X-QN-Signature`, where `body` is the **uncompressed** JSON string.

```ts
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { gunzipSync } from "node:zlib";

// Stream: Settings tab -> Security token. Webhook: shown in the Webhooks dashboard
// (or returned as destination_attributes.security_token when created by API).
const SECRET = process.env.QN_SECURITY_TOKEN;
if (!SECRET) throw new Error("Set QN_SECURITY_TOKEN");

export function verifyQuickNodeSignature(
  secret: string,
  payload: string, // the UNCOMPRESSED body as a UTF-8 string
  nonce: string,
  timestamp: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", secret).update(nonce + timestamp + payload).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b); // timingSafeEqual throws on unequal lengths
}

const server = createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/webhook") {
    res.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  req.on("data", (c: Buffer) => chunks.push(c));
  req.on("end", () => {
    const nonce = req.headers["x-qn-nonce"];
    const timestamp = req.headers["x-qn-timestamp"];
    const signature = req.headers["x-qn-signature"];
    if (typeof nonce !== "string" || typeof timestamp !== "string" || typeof signature !== "string") {
      res.writeHead(400).end("missing X-QN-* headers");
      return;
    }
    let raw = Buffer.concat(chunks);
    // node:http does NOT inflate gzip for you (Express body-parser does). Sign check uses the inflated JSON.
    if (req.headers["content-encoding"] === "gzip") raw = gunzipSync(raw);
    const payload = raw.toString("utf8");

    if (!verifyQuickNodeSignature(SECRET, payload, nonce, timestamp, signature)) {
      res.writeHead(401).end("invalid signature");
      return;
    }
    const body = JSON.parse(payload);
    console.log("verified payload, top-level keys:", Object.keys(body));
    // Reply 2xx fast. A Stream waits for this before sending the next block.
    res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
  });
});

server.listen(Number(process.env.PORT ?? 3000), () => console.log("listening on :3000/webhook"));
```

**Notes**
- Tested locally with a client that signs like the docs: valid plain body → 200, valid gzip body → 200, changed body → 401, wrong secret → 401, short signature → 401, missing headers → 400. Our HMAC matched the official sample's function byte for byte.
- Verify over the **raw** body string. If a framework parses JSON first (`express.json()`, Next.js `req.json()`), re-serializing changes the bytes and the check fails. In Express use `express.raw({ type: "*/*" })`. In Next.js route handlers use `await req.text()`.
- With Express/body-parser, gzip is already inflated in `req.body`, so do not gunzip again (the guide warns about "incorrect header check").
- Extra layers from the docs: deliveries come from IP `141.148.40.227`, and Streams can use mTLS. Keep the HMAC check anyway. It tells you which stream sent the payload.

---

## 5. Streams: token transfers to your webhook

**Goal:** every ERC-20 `Transfer` of one token on Unichain Sepolia, filtered on QuickNode's side, POSTed to your server, with retries and reorg handling.

Based on: [Streams quickstart](https://www.quicknode.com/docs/streams/quickstart), [Create a Stream (REST)](https://www.quicknode.com/docs/streams/rest-api/create-stream), [Filters](https://www.quicknode.com/docs/streams/filters), [EVM data source schemas](https://www.quicknode.com/docs/streams/data-sources/ethereum-evm), [Streams REST: batch size](https://www.quicknode.com/docs/streams/rest-api).

**Dashboard way:** [Streams](https://dashboard.quicknode.com/streams) → **Create Stream** → chain + network → dataset **Logs** → paste the filter below into the Filter editor and click **Run test** → destination **Webhook** → your URL → **Check Connection** → create. Copy the **Security token** from the Settings tab for recipe 4.

**REST way:**
```ts
// Create a Stream (Unichain Sepolia, "logs" dataset) that POSTs ERC-20 Transfers of one token to your webhook.
// Docs: https://www.quicknode.com/docs/streams/rest-api/create-stream
const API_KEY = process.env.QN_API_KEY; // dashboard -> API Keys (needs Streams permission)
const WEBHOOK_URL = process.env.WEBHOOK_URL; // e.g. your ngrok URL + /webhook
const TOKEN = (process.env.TOKEN_ADDRESS ?? "").toLowerCase(); // the ERC-20 you care about
if (!API_KEY || !WEBHOOK_URL || !TOKEN) throw new Error("Set QN_API_KEY, WEBHOOK_URL, TOKEN_ADDRESS");

// Filter runs on QuickNode's side. Must be named main. Return null to skip delivery.
// (Credits are charged per block processed even when you return null.)
export const filterSource = `
function main(stream) {
  const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const TOKEN = "${TOKEN}";
  const flat = (a) => a.reduce((acc, x) => acc.concat(Array.isArray(x) ? flat(x) : [x]), []);
  const logs = flat(stream.data); // "logs" dataset is nested arrays of log objects
  const hits = logs
    .filter(l => l && l.address && l.address.toLowerCase() === TOKEN && l.topics && l.topics[0] === TRANSFER)
    .map(l => ({
      tx: l.transactionHash,
      block: parseInt(l.blockNumber, 16),
      from: "0x" + l.topics[1].slice(26),
      to: "0x" + l.topics[2].slice(26),
      value: l.data, // hex uint256; decode it on your server
    }));
  return hits.length ? { transfers: hits } : null;
}`;

const res = await fetch("https://api.quicknode.com/streams/rest/v1/streams", {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json", "x-api-key": API_KEY },
  body: JSON.stringify({
    name: "hackathon-token-transfers",
    network: "unichain-sepolia",
    dataset: "logs",
    region: "usa_east",
    // no start_range = start at the latest block; no end_range = follow the tip forever
    dataset_batch_size: 1,
    elastic_batch_enabled: true,
    filter_function: Buffer.from(filterSource).toString("base64"),
    destination: "webhook",
    destination_attributes: {
      url: WEBHOOK_URL,
      compression: "none",
      max_retry: 3,
      retry_interval_sec: 1,
      post_timeout_sec: 10,
    },
    status: "active",
  }),
});
console.log(res.status, await res.text()); // the response includes the stream id and its security token
```

**Notes**
- Tested: the filter was run locally against 21 real Unichain blocks of logs (from `eth_getLogs`), shaped like the `logs` dataset. It returned the matching WETH transfers, and `null` for an empty payload. The generated filter passes `node --check`. The POST itself was not sent (no API key).
- **Cost:** Streams charge per **block processed**, at a multiplier that depends on chain and dataset. The filter does **not** reduce credits. Unichain makes about one block per second (about 2.6M blocks a month), so a tip Stream left running can use up the 10M free credits in days. Check the [calculator](https://www.quicknode.com/docs/streams/billing#api-credits-calculator) and **pause the Stream** when you're not demoing (`POST /streams/rest/v1/streams/{id}/pause`).
- For a few known wallets or contracts, Webhooks (recipe 3) are cheaper: you pay per delivered payload, not per block.
- The Stream waits for your 2xx before sending the next batch. After the configured retries fail, it **pauses itself**.
- Tip Streams on chains with block times under one second need `dataset_batch_size` ≥ 5, or the API returns 422.
- Filter sandbox: the function must be named `main`. No `require`, `import`, network or `fs`. Debug with `console.log` in the editor's Logs tab. `decodeEVMReceipts(receipts, [abi])` is available for the `block_with_receipts` dataset.
- Free plan: 1 active Stream, webhook destinations only (no S3/Postgres), no reorg handling ([pricing](https://www.quicknode.com/pricing.md)).

---

## 6. eth_getLogs on the free plan

**Goal:** read past events without hitting the range cap. The cap is **5 blocks per call on the free plan** and 10,000 on paid plans.

Based on: [World Chain eth_getLogs](https://www.quicknode.com/docs/worldchain/eth_getLogs) (same note on the [Unichain](https://www.quicknode.com/docs/unichain/eth_getLogs) and [Hedera](https://www.quicknode.com/docs/hedera/eth_getLogs) pages), [viem getLogs](https://viem.sh/docs/actions/public/getLogs).

```ts
// eth_getLogs block-range cap on QuickNode: 5 blocks on the free plan, 10,000 on paid plans.
// Docs: https://www.quicknode.com/docs/worldchain/eth_getLogs
import { createPublicClient, http, parseAbiItem } from "viem";
import { worldchain } from "viem/chains";

const url = process.env.QUICKNODE_RPC_URL;
if (!url) throw new Error("Set QUICKNODE_RPC_URL");
const client = createPublicClient({ chain: worldchain, transport: http(url, { retryCount: 3 }) });

const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getTransferLogs(address: `0x${string}`, fromBlock: bigint, toBlock: bigint, step = 5n, pauseMs = 0) {
  const all = [];
  for (let start = fromBlock; start <= toBlock; start += step) {
    const end = start + step - 1n > toBlock ? toBlock : start + step - 1n;
    all.push(...(await client.getLogs({ address, event: transfer, fromBlock: start, toBlock: end })));
    if (pauseMs) await sleep(pauseMs); // stay under per-second limits
  }
  return all;
}

const latest = await client.getBlockNumber();
const WETH = "0x4200000000000000000000000000000000000006";
const logs = await getTransferLogs(WETH, latest - 49n, latest, BigInt(process.env.LOG_STEP ?? 5), Number(process.env.PAUSE_MS ?? 0));
console.log(`WETH Transfer logs in last 50 blocks: ${logs.length}`);
if (logs[0]) console.log(logs[0].args);
```

**Notes**
- Tested on QuickNode's World Chain demo endpoint and on a public RPC. Without a pause, the demo endpoint answered `-32010 "log requests limited to 1/sec"`. With `PAUSE_MS=1100` it worked. Your own endpoint has its own limits. Keep the pause option.
- Each chunk is one request: 1,000 blocks = 200 calls. On 2-second chains like World Chain, that is only about 33 minutes of history. For more history, use a Streams backfill (set `start_range`/`end_range`) or a paid plan. For live events, use recipe 2 or 5.

---

## 7. Token balances and Marketplace add-ons

**Goal:** show a wallet's ERC-20 balances on a sponsor chain.

QuickNode's **Token and NFT API v2** add-on (`qn_getWalletTokenBalance`, `qn_fetchNFTs`) is documented for Ethereum, not for the sponsor chains ([example](https://www.quicknode.com/docs/ethereum/qn_getWalletTokenBalance_v2)). The add-ons catalog ([docs](https://www.quicknode.com/docs/add-ons)) lists:
- **GoldRush (Covalent) Multichain Data APIs**: supports World Chain, Unichain and Arc. It uses its own API key and calls `https://api.covalenthq.com` ([GoldRush on QuickNode](https://www.quicknode.com/docs/base/goldrush-wallet-api/overview)). It is a paid add-on (the marketplace showed plans from $50/month on 2026-10-19; check [the marketplace](https://marketplace.quicknode.com)).
- **Single Flight RPC** (`qn_getBlockWithReceipts`): supports 0G.

For a hackathon, plain Multicall3 over your endpoint costs nothing extra:

Based on: [viem multicall](https://viem.sh/docs/contract/multicall), [QuickNode multicall guide](https://www.quicknode.com/guides/ethereum-development/transactions/how-to-optimize-ethereum-rpc-usage-with-multicall).

```ts
// ERC-20 balances for one wallet with a single eth_call per chunk (Multicall3), on any QuickNode EVM endpoint.
// viem multicall docs: https://viem.sh/docs/contract/multicall
import { createPublicClient, http, erc20Abi, formatUnits } from "viem";
import { worldchain } from "viem/chains";

const url = process.env.QUICKNODE_RPC_URL;
if (!url) throw new Error("Set QUICKNODE_RPC_URL");
const client = createPublicClient({ chain: worldchain, transport: http(url) });

const wallet = (process.env.WALLET ?? "0x4200000000000000000000000000000000000006") as `0x${string}`;
const tokens = [
  "0x4200000000000000000000000000000000000006", // WETH (OP Stack predeploy)
  "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1", // USDC on World Chain (check the token list before relying on it)
] as const;

const calls = tokens.flatMap((address) => [
  { address, abi: erc20Abi, functionName: "symbol" } as const,
  { address, abi: erc20Abi, functionName: "decimals" } as const,
  { address, abi: erc20Abi, functionName: "balanceOf", args: [wallet] } as const,
]);
const res = await client.multicall({ contracts: calls }); // needs chain.contracts.multicall3

for (let i = 0; i < tokens.length; i++) {
  const [sym, dec, bal] = res.slice(i * 3, i * 3 + 3);
  if (sym.status !== "success" || dec.status !== "success" || bal.status !== "success") {
    console.log(tokens[i], "call failed");
    continue;
  }
  console.log(sym.result, formatUnits(bal.result as bigint, dec.result as number));
}
```

**Notes**
- Tested on QuickNode's World Chain demo endpoint: printed `WETH` and `USDC` balances.
- viem has `multicall3` set for World Chain, Unichain and Arc. It is **not** set for `hedera`/`hederaTestnet` or `zeroGMainnet`/`zeroGTestnet` in viem 2.57.7. There, call `readContract` per token, or pass `multicallAddress` once you have confirmed a deployment. On Hedera, the Mirror Node (recipe 8) lists token balances directly.
- To enable any add-on: endpoint page → **Add-ons** tab, or https://dashboard.quicknode.com/add-ons.

---

## 8. Chain extras: Hedera Mirror Node and Unichain Flashblocks

### Hedera Mirror Node REST on your QuickNode Hedera endpoint

Based on: [Hedera Mirror Node REST on QuickNode](https://www.quicknode.com/docs/hedera/api-v1-accounts-idOrAliasOrEvmAddress) (list of routes in the [Hedera index](https://www.quicknode.com/docs/hedera/llms.txt)).

```ts
// Hedera Mirror Node REST is served on the same QuickNode Hedera endpoint: <endpoint URL>/api/v1/...
// Docs: https://www.quicknode.com/docs/hedera/api-v1-accounts-idOrAliasOrEvmAddress
const base = process.env.QN_HEDERA_TESTNET_URL; // https://<name>.hedera-testnet.quiknode.pro/<token>/
if (!base) throw new Error("Set QN_HEDERA_TESTNET_URL");

async function mirror<T>(path: string): Promise<T> {
  const r = await fetch(new URL(path.replace(/^\//, ""), base!.endsWith("/") ? base : base + "/"));
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

// Accepts 0.0.x ids, aliases or 0x EVM addresses
const acct = await mirror<{ account: string; evm_address: string; balance: { balance: number } }>(
  "/api/v1/accounts/0.0.2?transactions=false",
);
console.log(acct.account, acct.evm_address, "balance (tinybars):", acct.balance.balance);
```

- Tested on QuickNode's `docs-demo.hedera-testnet` endpoint and on the public Hedera testnet mirror node. Both returned the same account.
- The docs only show the demo URL, which has no token in the path. With your own endpoint, the code above puts `/api/v1/...` **after** the token. If that returns 404, try the host without the token and send the token as an `x-token` header. Check your endpoint page.
- Mirror Node balances are in **tinybars** (8 decimals). The JSON-RPC `eth_getBalance` result uses 18 decimals. Checked on testnet: `eth_getBalance` = tinybars × 10^10.

### Unichain Flashblocks (200 ms preconfirmations)

Based on: [Unichain Flashblocks on QuickNode](https://www.quicknode.com/docs/unichain/flashblocks/overview). No add-on is needed. Use the `pending` tag on your normal Unichain endpoint.

```ts
// Unichain Flashblocks: use blockTag "pending" on a normal Unichain endpoint (no add-on needed).
// Docs: https://www.quicknode.com/docs/unichain/flashblocks/overview
import { createPublicClient, http } from "viem";
import { unichainSepolia } from "viem/chains";

const url = process.env.QUICKNODE_RPC_URL; // https://<name>.unichain-sepolia.quiknode.pro/<token>/
if (!url) throw new Error("Set QUICKNODE_RPC_URL");
const client = createPublicClient({ chain: unichainSepolia, transport: http(url) });

const [latest, pending] = await Promise.all([
  client.getBlock({ blockTag: "latest" }),
  client.getBlock({ blockTag: "pending" }),
]);
console.log("latest", latest.number, "txs", latest.transactions.length);
console.log("pending (flashblock)", pending.number, "txs", pending.transactions.length);
```

- Tested on the public Unichain Sepolia RPC and on QuickNode's Unichain mainnet demo endpoint. Both answered `pending`.
- `eth_call`, `eth_getBalance`, `eth_getTransactionCount` and `eth_getLogs` also accept `"pending"` for Flashblock state.
