# QuickNode errors and gotchas

Checked 2026-10-19 against the docs linked in each item and @quicknode/sdk@3.8.2.

## 1. `Core` is not exported by `@quicknode/sdk`

**Symptom:** `TypeError: Core is not a constructor`, or TS2305 `Module '"@quicknode/sdk"' has no exported member 'Core'`.
**Cause:** the chain quickstart pages (for example [World Chain](https://www.quicknode.com/docs/worldchain/quickstart) and [Hedera](https://www.quicknode.com/docs/hedera/quickstart)) still show `const { Core } = require('@quicknode/sdk')`. That was the old viem wrapper. `@quicknode/sdk` v3 (3.8.2 today) exports `QuicknodeSdk` for the Admin, Streams, Webhooks, KV, SQL and RPC-tooling APIs ([SDK docs](https://www.quicknode.com/docs/sdk)). We confirmed this by type-checking the docs snippet. At runtime, `Core` is `undefined`.
**Fix:** use viem or ethers with your endpoint URL for RPC ([recipe 1](recipes.md#1-one-endpoint-for-every-sponsor-chain-viem-and-ethers)). Use `@quicknode/sdk` only for account APIs.

## 2. SDK sample for Webhooks does not type-check

**Symptom:** TS2353 `'wallet' does not exist in type '{ templateId: "evmWalletFilter"; args: any; }'`.
**Cause:** the QNSDK tab on [Create webhook from template](https://www.quicknode.com/docs/webhooks/rest-api/webhooks/webhooks-rest-create-from-template) passes `templateArgs: { templateId, wallet }`. In SDK 3.8.2 the type is `{ templateId, args: { wallets: [...] } }`.
**Fix:** `templateArgs: TemplateArgs.evmWalletFilter({ wallets: ["0x..."] })` ([recipe 3](recipes.md#3-webhooks-get-a-post-when-a-wallet-is-active)). The REST body keeps the wire shape `templateArgs: { wallets: [...] }`.

## 3. `@quicknode/sdk` fails to load on Windows, Intel Mac or in the browser

**Cause:** the SDK is a Rust core with native bindings. Prebuilt binaries exist only for Linux (glibc/musl, x64/arm64) and macOS Apple Silicon ([platform support](https://www.quicknode.com/docs/sdk#platform-support)).
**Fix:** call the REST APIs with `fetch` (recipes 3 and 5). On Windows, use WSL2. Never import it in frontend code.

## 4. HTTP 429 / `-32007` / `-32008` / `-32011` / `-32029`: rate limited

**Message:** `The requests per second (RPS) of your requests are higher than your plan allows.`
**Cause:** the free plan allows 15 requests/second. `-32007` = per-second limit, `-32008` = per-minute limit, `-32011` = method rate-limit rule, `-32029` = method or connection limit. **Every call inside a JSON-RPC batch counts** ([error reference](https://www.quicknode.com/docs/worldchain/error-references), [agents reference](https://www.quicknode.com/agents.md)).
**Fix:** viem `http(url, { retryCount: 3, retryDelay: 1000 })` retries 429 with backoff and honours `Retry-After`. Keep concurrent calls under about 70% of your limit (about 10 on the free plan). Use Multicall3 for many reads. In ethers, set `staticNetwork` so it doesn't send an extra `eth_chainId` per batch.

## 5. `eth_getLogs` fails for ranges over 5 blocks

**Cause:** the block-range limit is **5 blocks on the free plan** and 10,000 on paid plans ([eth_getLogs](https://www.quicknode.com/docs/worldchain/eth_getLogs), [support article](https://support.quicknode.com/articles/3261121056-understanding-the-10-000-block-range-limit-for-querying-logs-and-events)). viem's `getContractEvents`/`getLogs` with a wide `fromBlock` hits it immediately.
**Fix:** chunk in 5-block steps ([recipe 6](recipes.md#6-eth_getlogs-on-the-free-plan)). For live data use WebSockets or Streams. For history use a Streams backfill or a paid plan. On QuickNode's `docs-demo` endpoints we also saw `-32010 "log requests limited to 1/sec"`, so pause between chunks.

## 6. Free credits gone in a few days (Streams)

**Cause:** Streams bill **per block processed** (block count × the multiplier for that chain and dataset). The filter result does not matter: `return null` still costs credits ([Streams billing](https://www.quicknode.com/docs/streams/billing), [Filters](https://www.quicknode.com/docs/streams/filters)). One-second chains like Unichain make about 2.6M blocks a month. The free plan has 10M credits and no overage.
**Fix:** use Webhooks (30 credits per delivered payload) for a few wallets or contracts. Use the `block` dataset rather than `block_with_receipts` (about 50% fewer credits). Run one Stream per chain with a combined filter. **Pause the Stream** between demos. Watch usage in the dashboard.

## 7. Stream paused by itself / webhook keeps retrying

**Cause:** your endpoint did not return 2xx in time (default timeout 30 s). After `max_retry` failures the Stream **pauses**. Streams also block: the next batch waits for your 2xx ([Webhook destination](https://www.quicknode.com/docs/streams/destinations/webhooks)).
**Fix:** reply `200` right away and do slow work after (queue it). Make sure ngrok is still running and its URL has not changed. Then reactivate the Stream (dashboard, or `POST /streams/rest/v1/streams/{id}/activate`).

## 8. Signature never matches

**Causes** ([validation guide](https://www.quicknode.com/guides/quicknode-products/streams/validating-incoming-streams-webhook-messages)):
- You hashed re-serialized JSON (`JSON.stringify(req.body)`) instead of the raw body string.
- The body was gzip and you hashed the compressed bytes. The HMAC is over the **uncompressed** JSON. In the other direction, Express/body-parser already inflates gzip, and gunzipping again throws "incorrect header check".
- Wrong order. It is `nonce + timestamp + payload`, keyed with the Stream's **Security token** (Streams: Settings tab, rotatable) or the Webhook's validation token.
- `crypto.timingSafeEqual` **throws** when the buffers have different lengths. The official sample has this problem. Check the lengths first ([recipe 4](recipes.md#4-verify-the-x-qn-signature-hmac)).

## 9. Tip Stream rejected with 422

**Cause:** for Streams that follow the tip on chains with block times under one second, `dataset_batch_size` must be at least 5 (or your plan's maximum) ([Streams REST: batch size](https://www.quicknode.com/docs/streams/rest-api)).
**Fix:** set `dataset_batch_size: 5` and `elastic_batch_enabled: true`.
Related doc gap: the create-stream page marks `filter_function` as optional, but the [Streams OpenAPI](https://api.quicknode.com/streams/rest/openapi.json) lists it as required. Send one (an identity filter `function main(stream) { return stream; }` is fine).

## 10. `401` / `403` / wrong-URL errors

- **401:** the token is missing or wrong. The token is the last path segment of the endpoint URL, or the `x-token` header. Regenerating a token kills the old one at once ([endpoint security](https://www.quicknode.com/docs/worldchain/endpoint-security)).
- **403:** a security rule (IP, referrer, method filter) blocked you, or the endpoint is disabled. Check the endpoint's **Logs** tab.
- **404:** wrong hostname or path, for example a network subdomain typo. Copy the URL from the dashboard. With Multichain, each network has its own subdomain.
- REST APIs (`api.quicknode.com`) use a different credential: an **API key** in `x-api-key`, not the endpoint token.
- The MCP `call-rpc` tool is read-only. `eth_sendRawTransaction` returns "RPC method ... is not allowed" ([MCP docs](https://www.quicknode.com/docs/build-with-ai/quicknode-mcp#blockchain-rpc-calls)). Send transactions from your own code.
