# Onramp.money recipes

Every block here was type-checked (TypeScript 5.9.3, strict) and the runnable ones were run on 19 Oct 2026. See the test notes at the end of each recipe.

## 1. Hosted buy link (on-ramp)

**Goal:** a "Buy USDT with UPI" button that opens Onramp with everything prefilled, then comes back to your app.

```ts
import { buildOnrampUrl } from './onramp-url.ts'; // from quickstart.md step 3

const link = buildOnrampUrl('buy', {
  appId: Number(process.env.ONRAMP_APP_ID ?? 2),
  coinCode: 'usdt',
  network: 'bep20',              // sandbox: 'bep20-test'
  fiatType: 1,                   // INR
  fiatAmount: 1000,              // or coinAmount (not both)
  paymentMethod: 1,              // 1 UPI, 2 IMPS
  walletAddress: '0xf142123879b4611Cd4a30C1E0929217C0d4fB37f',
  merchantRecognitionId: 'order-42',           // comes back in the webhook
  redirectUrl: 'https://myapp.xyz/onramp/done', // gets ?orderId=..&status=success|pending
  phoneNumber: '+91-9876543210',               // encoded to %2B91-9876543210
});
// <a href={link} target="_blank" rel="noopener">Buy with UPI</a>
```

Notes
- With every parameter prefilled, the user lands straight on the payment confirmation step.
- `redirectUrl` works only in hosted mode. Treat `status=success` in the redirect as a hint, and confirm with the webhook or the order status API.
- `coinCode` is lowercase and `network` is the Onramp `chainSymbol` (`erc20`, `bep20`, `matic20`, `trc20`, `arbitrum`, `base`, `optimism`, ...), not an EVM chain id. Read valid pairs live with recipe 4.
- Source: https://docs.onramp.money/onramp/onramp-widget-integration/hosted-mode

## 2. Hosted sell link (off-ramp)

**Goal:** the user sells USDT and gets INR in their bank account.

```ts
import { buildOnrampUrl } from './onramp-url.ts';

const sellLink = buildOnrampUrl('sell', {
  appId: Number(process.env.ONRAMP_APP_ID ?? 2),
  coinCode: 'usdt',
  network: 'bep20',             // sandbox: 'bep20-test'
  coinAmount: 10,               // or fiatAmount
  fiatType: 1,
  merchantRecognitionId: 'payout-7',
});
```

Notes
- The user sends crypto to an address that Onramp shows, then Onramp pays out to the user's bank. They need KYC and a bank account in their own name; a name mismatch fails the order (status -3).
- Off-ramp status codes differ from on-ramp ones. 6, 14 and 40 mean "fiat withdrawal processed" and 19 means success. Full table: https://docs.onramp.money/onramp/response-codes/order-status-codes
- Sandbox off-ramp: `appId=2`. On 19 Oct 2026 the sell page loaded with `coinCode=usdt&network=bep20-test` (minimum ₹50).
- Source: https://docs.onramp.money/onramp/offramp-widget-integration/user-flow/hosted-mode

## 3. React: overlay or embedded widget

**Goal:** open the widget inside your React/Next.js app and show progress.

```tsx
'use client';
// https://docs.onramp.money/onramp/onramp-widget-integration/overlay-mode
import { useState } from 'react';

type Props = { appId: number; walletAddress: string; embedded?: boolean };

export function BuyCryptoButton({ appId, walletAddress, embedded = false }: Props) {
  const [status, setStatus] = useState('idle');

  async function open() {
    // Import in the click handler: the SDK touches `document` and must not run during SSR.
    const { OnrampWebSDK } = await import('@onramp.money/onramp-web-sdk');
    const onramp = new OnrampWebSDK({
      appId,                       // 2 = sandbox
      flowType: 1,                 // 1 buy, 2 sell, 3 merchant checkout
      walletAddress,
      coinCode: 'usdt',
      network: appId === 2 ? 'bep20-test' : 'bep20',
      fiatType: 1,                 // INR
      fiatAmount: 1000,            // number, not string
      paymentMethod: 1,            // 1 UPI, 2 IMPS
      merchantRecognitionId: `order-${Date.now()}`,
      ...(embedded ? { containerId: '#onramp-widget' as const } : {}),
    });
    onramp.on('TX_EVENTS', (e) => setStatus(e.type));
    onramp.on('WIDGET_EVENTS', (e) => {
      if (e.type === 'ONRAMP_WIDGET_CLOSE_REQUEST_CONFIRMED') setStatus('closed');
      if (e.type === 'ONRAMP_WIDGET_FAILED') setStatus('widget failed: check params');
    });
    await onramp.show();
  }

  return (
    <div>
      <button onClick={open}>Buy crypto with UPI</button>
      <p>Status: {status}</p>
      {embedded && <div id="onramp-widget" style={{ width: 420, height: 640 }} />}
    </div>
  );
}
```

Notes
- Your tsconfig needs `"moduleResolution": "bundler"` (the Next.js and Vite default). Under `NodeNext` the SDK's types do not resolve and the event types fall back to `any` (errors.md #6).
- `on()` keeps one callback per group (`TX_EVENTS`, `WIDGET_EVENTS`, `KYC_EVENTS`). Calling it again replaces the earlier callback.
- `show()` throws if the widget is already open, and `close()` throws if it is not open.
- Docs event names: `ONRAMP_WIDGET_TX_INIT`, `_FINDING`, `_PURCHASING`, `_SENDING`, `_COMPLETED`, plus the `_FAILED` variants. The npm README lists other names (errors.md #3).
- Theme: `theme: { lightMode: { baseColor: '#6366f1' }, darkMode: { baseColor: '#4f46e5' } }`. `baseColor` must be a hex value, or `show()` throws.
- Sources: overlay docs above, the SDK README on npm (https://www.npmjs.com/package/@onramp.money/onramp-web-sdk), and the SDK code (`dist/onramp-web-sdk.es5.js` in 2.0.1).

## 4. Coin codes, networks and prices (public API)

**Goal:** fill a coin/network picker with live data, show a price, and validate the user's address. No key is needed.

```ts
// https://docs.onramp.money/onramp/onramp-widget-integration/allconfig-all-coin-details/coinnetwork-get-all-supported-networks
// https://docs.onramp.money/onramp/onramp-widget-integration/allconfig-all-coin-details/coindetails-price-details-for-desired-amount
const BASE = 'https://api.onramp.money/onramp/api/v3/buy/public';

type NetworkConfig = Record<string, { chainSymbol: string; chainName: string; networkId?: number; addressRegex: string }>;

export async function getBuyNetworks(coinCode: string, fiatType = 1) {
  const res = await fetch(`${BASE}/coinNetworks?coinCode=${coinCode}&fiatType=${fiatType}`);
  const json = await res.json();
  if (json.status !== 1) throw new Error(json.error ?? 'coinNetworks failed');
  const { coinConfig, networkConfig } = json.data as { coinConfig?: { networks: number[] }; networkConfig: NetworkConfig };
  return (coinConfig?.networks ?? [])
    .filter((id) => networkConfig[String(id)]?.chainSymbol)
    .map((id) => ({ chainId: id, ...networkConfig[String(id)] }));
}

// chainId here is Onramp's internal id (e.g. 3 = matic20), NOT the EVM chain id.
export async function getBuyPrice(coinCode: string, chainId: number, fiatAmount: number, fiatType = 1) {
  const q = new URLSearchParams({ coinCode, chainId: String(chainId), fiatAmount: String(fiatAmount), fiatType: String(fiatType) });
  const json = await (await fetch(`${BASE}/coinDetails?${q}`)).json();
  if (json.status !== 1) throw new Error(json.error ?? 'coinDetails failed');
  return json.data as { price: number; gasFee: { withdrawalFee: string; minimumWithdrawal: string } };
}

const nets = await getBuyNetworks('usdt', 1);
const polygon = nets.find((n) => n.chainSymbol === 'matic20')!;
console.log(nets.map((n) => n.chainSymbol), await getBuyPrice('usdt', polygon.chainId, 1000, 1));
```

Notes
- Pass the `chainSymbol` to the widget as `network`. Use `addressRegex` to check the wallet address before you open the widget.
- `coinCode` and `fiatType` are both required. Without them the API returns `400 Missing parameter(s) -> coinCode, fiatType`.
- Run live on 19 Oct 2026: USDT/INR had 26 networks, including `bep20`, `matic20`, `erc20`, `arbitrum`, `optimism`, `trc20`, `spl`, `ton` and `bep20-test`. The price was about ₹106 per USDT.
- Sell-side coins and networks: `GET https://api.onramp.money/onramp/api/v2/sell/public/allConfig` (https://docs.onramp.money/onramp/offramp-widget-integration/get-all-coin-details-v2).
- Server time (for signing): `GET https://api.onramp.money/onramp/api/v2/common/public/currentTimestamp`.

## 5. Signed REST calls

**Goal:** check an order, make a fraud-proof link, or list your merchant transactions from your server.

How signing works (https://docs.onramp.money/onramp/rest-api-endpoints/sample-request-for-endpoints): `payload = base64(JSON.stringify({ timestamp: Date.now(), body }))` and `signature = hex(HMAC-SHA512(payload, apiSecret))`. Send them in the `X-ONRAMP-APIKEY`, `X-ONRAMP-PAYLOAD` and `X-ONRAMP-SIGNATURE` headers, and send `body` as the JSON body. Node's `crypto` gives exactly the same output as the docs' `crypto-js` (tested).

```ts
// onramp-api.ts (server only)
import { createHmac, timingSafeEqual } from 'node:crypto';

const API = 'https://api.onramp.money';

export function signOnrampRequest(body: object, apiKey: string, apiSecret: string, timestamp = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ timestamp, body })).toString('base64');
  const signature = createHmac('sha512', apiSecret).update(payload).digest('hex');
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'X-ONRAMP-APIKEY': apiKey,
    'X-ONRAMP-PAYLOAD': payload,
    'X-ONRAMP-SIGNATURE': signature,
  };
}

export async function onrampPost<T = unknown>(path: string, body: object): Promise<T> {
  const headers = signOnrampRequest(body, process.env.ONRAMP_API_KEY!, process.env.ONRAMP_API_SECRET!);
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok || json.status !== 1) throw new Error(`Onramp ${path} failed: ${res.status} ${JSON.stringify(json)}`);
  return json as T;
}

// type: 1 = onramp (buy), 2 = offramp (sell)
export function getOrderStatus(orderId: number, type: 1 | 2) {
  return onrampPost<{ status: number; code: number; data: { orderStatus: number } }>(
    '/onramp/api/v2/common/transaction/orderStatus', { orderId, type });
}

export function verifyOnrampWebhook(payloadHeader: string | undefined, signatureHeader: string | undefined, apiSecret: string): boolean {
  if (!payloadHeader || !signatureHeader) return false;
  const expected = createHmac('sha512', apiSecret).update(payloadHeader).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Other endpoints, all called the same way with `onrampPost(path, body)`:

| Path | Body | Doc |
| - | - | - |
| `/onramp/api/v1/transaction/merchantHistory` | `{ page: 1, pageSize: 50, order: 'DESC', type: 1 }` | https://docs.onramp.money/onramp/rest-api-endpoints/merchant-transaction-history |
| `/onramp/api/v2/common/transaction/generateLink` | `{ coinCode: 'usdt', network: 'bep20', fiatAmount: 200, fiatType: 1, type: 1 }`, returns `data.link` and `data.urlHash` | https://docs.onramp.money/onramp/rest-api-endpoints/generate-widget-link |
| `/onramp/api/v2/common/transaction/quotes` | `{ coinCode: 'usdt', network: 'bep20', fiatAmount: 200, fiatType: 1, type: 1 }` | https://docs.onramp.money/onramp/rest-api-endpoints/quotes-api-onramp |
| `/onramp/api/v1/merchant/setWebhookUrl` | `{ webhookUrl: 'https://...' }` | https://docs.onramp.money/onramp/rest-api-endpoints/set-update-webhook-url |
| `/onramp/api/v1/merchant/sendDummyWebhook` | `{ webhookUrl?: 'https://...' }` | https://docs.onramp.money/onramp/rest-api-endpoints/send-dummy-webhook |

Notes
- Use `generateLink` when the amount or address must not be editable: the link carries a `urlHash` in place of plain query params. Its docs table says `flowType` while the sample sends `type` (errors.md #8).
- On-ramp `orderStatus`: 4 or 15 = withdrawal complete (crypto sent), 5 or 16 = webhook sent, negative = failed. Table: https://docs.onramp.money/onramp/response-codes/order-status-codes
- Signing was tested offline only. No real key was used, so no request was sent to the signed endpoints.

## 6. Webhook receiver

**Goal:** mark an order paid on your server only when Onramp says so.

```ts
// Express 5. Onramp only calls this for completed orders and expects an answer within 5 s.
import express from 'express';
import { verifyOnrampWebhook } from './onramp-api.ts';

const app = express();
app.use(express.json());
const seen = new Set<string>(); // use your database in a real app

app.post('/onramp/webhook', (req, res) => {
  const ok = verifyOnrampWebhook(
    req.get('x-onramp-payload'), req.get('x-onramp-signature'), process.env.ONRAMP_API_SECRET!);
  if (!ok) return res.status(403).send('Invalid signature');

  const { orderId, eventType, status, merchantRecognitionId, transactionHash } = req.body;
  const key = `${eventType}:${orderId}:${status}`;
  if (!seen.has(key)) {
    seen.add(key);
    console.log('onramp order', { orderId, eventType, status, merchantRecognitionId, transactionHash });
  }
  res.status(200).send('ok');
});

app.listen(Number(process.env.PORT ?? 3001), () => console.log('webhook listening'));
```

Notes
- The signature is HMAC-SHA512 (hex) of the `x-onramp-payload` **header**, keyed with your API secret. This follows the docs' Node sample (https://docs.onramp.money/onramp/onramp-widget-integration/webhook-updates). The comparison above is constant-time; the docs use `==`.
- `eventType` is `onramp` or `offramp`. Match orders to your users with `merchantRecognitionId`.
- Webhooks are sent only for completed orders, and only if the URL was set before the order finished. You may get duplicates, so process them idempotently. The endpoint must use HTTPS with a valid certificate; a tunnel such as ngrok works while you hack.
- Set the URL with `setWebhookUrl` and test it with `sendDummyWebhook` (recipe 5).
- Tested locally: a self-signed request got 200, a duplicate got 200 and was logged once, and a bad signature got 403. A real Onramp webhook was not received (that needs keys).

## 7. India: INR, UPI and KYC

**Goal:** get the defaults right for Indian users.

- `fiatType: 1` is INR (the default). `paymentMethod: 1` is UPI ("PhonePe, GPay, etc." in the widget) and `2` is IMPS. Source: https://docs.onramp.money/onramp/supported-assets-and-fiat/payment-methods
- Limits from the docs' table: on-ramp ₹100 to ₹5,00,000 and off-ramp ₹50 to ₹5,00,000 per transaction (https://docs.onramp.money/onramp/supported-assets-and-fiat/transaction-limits). The live widget can ask for more; it showed a ₹640 minimum for USDT on Polygon on 19 Oct 2026.
- KYC is run inside the widget. For India it needs Aadhaar and PAN through DigiLocker, about 1-2 minutes (https://docs.onramp.money/onramp/kyc-tiers-for-users/basic-kyc-for-india). Video KYC and EDD (bank statement, ITR) apply at higher limits (https://docs.onramp.money/onramp/kyc-tiers-for-users). Your app never sees the documents.
- Webhooks and events carry `kycNeeded` (0 = basic KYC enough, 1 = more KYC needed). SDK 2.0.1 also emits `KYC_EVENTS` (`ONRAMP_KYC_*`).
- Users must pay from a bank account in their own name. Status -3 means the bank name and KYC name do not match.
- The `coinDetails` response includes a `tdsFee` field (India's tax on crypto transfers). Show it in your price breakdown if it is non-zero.
- For a live demo, a real UPI purchase means real KYC and real money. Use the sandbox (`appId=2`) on stage.
