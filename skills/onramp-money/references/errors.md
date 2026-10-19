# Onramp.money errors and gotchas

"Observed" means checked live on 19 Oct 2026. Everything else cites its source.

## 1. Sandbox says "The selected network (MATIC20-TEST) is not supported for USDT transactions"

The sandbox docs still say USDT on `matic20-test` (Polygon Mumbai), and they give a Mumbai USDT contract to import into MetaMask (https://docs.onramp.money/onramp/onramp-widget-integration/sandbox-mode). Mumbai has been shut down. **Observed:** `https://onramp.money/main/buy/?appId=2&coinCode=usdt&network=matic20-test` shows the error above, while `network=bep20-test` (BNB Smart Chain testnet, chain id 97, per the live `coinNetworks` response) loads both the buy and the sell sandbox.
**Fix:** use `appId=2&coinCode=usdt&network=bep20-test`. If that stops working, call `coinNetworks?coinCode=usdt&fiatType=1` and look for a `*-test` network.

## 2. Wrong network or "chainId": Onramp ids are not EVM chain ids

`chainId` in Onramp's API and webhooks is Onramp's internal network id (3 = `matic20`, 1 = `bep20`, 0 = `erc20`). It is not 137, 56 or 1. **Observed:** the same id 10 means `bep20-test` in the buy `coinNetworks` response and `matic20-test` in the sell `allConfig` response.
**Fix:** pass `network` as the string `chainSymbol` (`bep20`, `matic20`, ...). Where both are allowed, `network` wins over `chainId` (https://docs.onramp.money/onramp/rest-api-endpoints/quotes-api-onramp). When you read a webhook, use its `network` and `coinCode` strings.

## 3. Event names or param values from the npm README don't match

The npm README for 2.0.1 uses `coinCode: "USDT"` and `network: "polygon"`, and lists events such as `ONRAMP_WIDGET_TX_SUCCESSFUL`. The docs use lowercase `usdt` and `matic20`, and list `ONRAMP_WIDGET_TX_COMPLETED`, `_INIT`, `_FINDING`, `_PURCHASING`, `_SENDING` and `_*_FAILED` (https://docs.onramp.money/onramp/onramp-widget-integration/overlay-mode). The SDK code forwards any event whose type starts with `ONRAMP_WIDGET_TX_`, so the names come from the widget itself.
**Fix:** use the docs' values (`usdt`, `matic20`); they match the live API. Log `e.type` while testing and handle both `..._COMPLETED` and `..._SUCCESSFUL` if you rely on the name.

## 4. `show()` throws before anything opens

The SDK checks its config before it opens the widget. Messages from 2.0.1, each reproduced in a test:
- `use either coinAmount or fiatAmount`: pass only one.
- `fiatAmount only accepts number values`: pass `1000`, not `'1000'`.
- `paymentMethod only accepts number values as 1 => UPI, 2 => Bank Transfers`.
- `Invalid phoneNumber format ...`: the SDK wants it already encoded, `encodeURIComponent('+91-9876543210')` → `%2B91-9876543210`. The hosted URL builder in recipe 1 takes the raw `+91-...` form, because `URLSearchParams` encodes it.
- `The memo parameter has been deprecated! Please use the addressTag parameter.`
- `containerId must start with #` and `Container with selector '#x' not found` (render the `<div>` before calling `show()`).
- `Invaid baseColor provided for lightMode!` (the typo is in the SDK): use a hex colour.
- `Widget is already rendered. Call close method to clear it up`, and `no widget to close, please call show method first`.
- `Failed to generate widget URL: <status>`: `show()` first calls `https://api.onramp.money/sdk-apis/generate-url`, so check the network, ad blockers and CSP `connect-src`.

## 5. `OnrampWebSDK is not a constructor`, or `document is not defined` (SSR / Node)

**Observed:** in plain Node, `import('@onramp.money/onramp-web-sdk')` returns no named exports. The package is `"type": "module"`, its `main` is a UMD build, and it has no `exports` map. Bundlers (Vite, webpack, esbuild) use the `module` field and get the real ES build (tested with esbuild 0.28.2). The constructor also touches `document`.
**Fix:** create the SDK only in the browser, for example with `await import(...)` inside a click handler or `useEffect` in a `'use client'` component (recipe 3). Never construct it in a server component or API route.

## 6. Event `e` is `any`, or the SDK's types don't load (TypeScript)

The SDK's `.d.ts` imports `./types` without a file extension. Under `"moduleResolution": "NodeNext"` that import fails, so `configType` and the event types become `any` (tsc `--traceResolution`: `Module name './types' was not resolved`). Under strict mode you then see `Parameter 'e' implicitly has an 'any' type`.
**Fix:** use `"moduleResolution": "bundler"` (the Next.js and Vite default), or type the callback parameter yourself.

## 7. 401 "Invalid client credentials/signature" or "Ahead of Time"

The HMAC must cover the exact base64 `X-ONRAMP-PAYLOAD` string you send, built from `{ timestamp, body }`, and `body` must also be the JSON body (https://docs.onramp.money/onramp/rest-api-endpoints/sample-request-for-endpoints). "Ahead of Time" means your clock is off: fetch `GET /onramp/api/v2/common/public/currentTimestamp` and use that value as `timestamp` (https://docs.onramp.money/onramp/rest-api-endpoints/current-timestamp/synchronisation-troubleshooting-guide).
Note: the sample on that troubleshooting page sends `X-RECON-*` headers. Every other endpoint page uses `X-ONRAMP-*`, so keep `X-ONRAMP-*`.

## 8. `generateLink` returns 400

The request table on https://docs.onramp.money/onramp/rest-api-endpoints/generate-widget-link lists `flowType` as required, but the Node and Python samples send `type: 1`. Not tested (needs keys).
**Fix:** if one name gets a 400, try the other, and ask Onramp which one is current.

## 9. Trusting client-side events or the redirect for payment

**Observed in the SDK code (2.0.1):** the `message` listener accepts any `postMessage` whose `eventData.isOnramp` is true and does not check `event.origin`. A test page dispatched a fake `ONRAMP_WIDGET_TX_COMPLETED` and the SDK passed it to `TX_EVENTS`. The `?status=success` on `redirectUrl` can also be typed by hand.
**Fix:** use events and redirects for UI only. Mark orders paid from the signed webhook (recipe 6) or `orderStatus` (recipe 5).

## 10. Webhook never arrives

From https://docs.onramp.money/onramp/onramp-widget-integration/webhook-updates:
- Webhooks are sent only when an order **completes** (crypto withdrawn for buy, fiat paid out for sell). There are no webhooks for pending or failed orders, so poll `orderStatus` for those.
- If the URL is set after the order completes, that order gets no webhook. Set it first with `setWebhookUrl`, then test with `sendDummyWebhook`.
- The endpoint needs HTTPS with a certificate browsers trust, and it must answer within 5 s or the webhook is retried.
- Duplicates happen, so key your processing on `orderId` + `status`.
- Without webhooks enabled, completed on-ramp orders end at status 4 or 15, and off-ramp orders at 14, 19 or 40.

## 11. "Transactions are not available for the selected coin: USDC"

**Observed:** with `appId=1`, `coinCode=usdc` and `fiatType=1`, the buy widget showed this message, even though the public `coinNetworks` API lists networks for USDC. USDT on `matic20` loaded normally.
**Fix:** check each coin and fiat pair in the widget, not only in the API. Your App ID's coin list is set during onboarding (https://docs.onramp.money/onramp/merchant-onboarding-flow), so ask Onramp to enable the pairs you need.

## HTTP error codes (REST)

From https://docs.onramp.money/onramp/response-codes/error-codes:
400 invalid request format · 401 invalid credentials or signature · 403 forbidden · 406 coin not supplied or not supported · 409 wrong parameter type · 413 volume out of bounds · 416 insufficient balance · 417 order no longer exists · 428 price far from market · 429 too many requests · 500 server problem · 503 maintenance.
