# Onramp.money quickstart (full)

Tested 19 Oct 2026 with Node 24.21, TypeScript 5.9.3, `@onramp.money/onramp-web-sdk@2.0.1`, `express@5.3.0`.

## 0. Pick an integration mode

| Mode | What it is | Needs |
| - | - | - |
| Hosted | A link to `https://onramp.money/main/buy/` or `/main/sell/` with query params; opens in a new tab or redirects | nothing |
| Overlay | The widget opens in an iframe over your page | `@onramp.money/onramp-web-sdk` |
| Embedded | The same iframe inside a `<div>` you choose (`containerId`) | the SDK |
| REST API + webhooks | Order status, fraud-proof links, history, webhook URL | API key and secret (server only) |

Source: https://docs.onramp.money/onramp/onramp-widget-integration/quick-start

## 1. Accounts and keys

1. **Sandbox (now):** use `appId=2`, the public test App ID. No signup is needed. https://docs.onramp.money/onramp/onramp-widget-integration/sandbox-mode
2. **Your own App ID:** create an account at https://playground.onramp.money/signup/. Per https://docs.onramp.money/onramp/merchant-onboarding-flow, Onramp runs a KYB check of your company, schedules a call, then gives you an **App ID**. In the same process you set fees (Onramp's fee, an optional client fee, or zero fee for the user) and the coins you support.
3. **API key and secret** (REST and webhook signatures): request them through the form linked from the webhook page, https://forms.gle/i1hpWi8oq5Zv2jpt8 (source: https://docs.onramp.money/onramp/onramp-widget-integration/webhook-updates). Keep the secret on the server.
4. Onboarding takes people and time. Start it on day one, or build your demo on the sandbox.

## 2. Env

```sh
# browser-safe
ONRAMP_APP_ID=2                       # sandbox; your own App ID later
# server only
ONRAMP_API_KEY=<YOUR_API_KEY>
ONRAMP_API_SECRET=<YOUR_API_SECRET>
```

## 3. Hosted link (no install)

`onramp-url.ts`:

```ts
// Params: https://docs.onramp.money/onramp/onramp-widget-integration/hosted-mode
export type OnrampFlow = 'buy' | 'sell';

export interface OnrampUrlParams {
  appId: number;                 // your App ID; 2 = public sandbox app
  coinCode?: string;             // lowercase key from listAllCoins / allConfig, e.g. 'usdt'
  network?: string;              // chainSymbol, e.g. 'bep20', 'matic20', 'erc20', 'arbitrum', 'base', 'bep20-test'
  fiatType?: number;             // 1 = INR, 2 = TRY, 3 = AED ... (Fiat Currencies page)
  fiatAmount?: number;           // pass fiatAmount OR coinAmount, not both
  coinAmount?: number;
  walletAddress?: string;        // buy: where the crypto is sent
  paymentMethod?: 1 | 2;         // 1 = instant (UPI in India), 2 = bank transfer (IMPS)
  merchantRecognitionId?: string;// your own order/user id, echoed back in webhooks
  redirectUrl?: string;          // hosted mode only; gets ?orderId=..&status=success|pending
  phoneNumber?: string;          // '+91-9876543210' (country code, hyphen, number)
  addressTag?: string;           // memo/tag for XRP, XLM, ...
  lang?: string;                 // 'en', 'tr', 'vi', 'es', 'pt', ...
}

export function buildOnrampUrl(flow: OnrampFlow, params: OnrampUrlParams): string {
  if (params.fiatAmount !== undefined && params.coinAmount !== undefined) {
    throw new Error('Pass fiatAmount or coinAmount, not both');
  }
  const url = new URL(`https://onramp.money/main/${flow}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString(); // URLSearchParams turns '+91-...' into '%2B91-...', as the docs require
}

// Demo call; delete it once other files import this module.
console.log(buildOnrampUrl('buy', {
  appId: 2, coinCode: 'usdt', network: 'bep20-test', fiatType: 1, fiatAmount: 1000, paymentMethod: 1,
  walletAddress: '0xf142123879b4611Cd4a30C1E0929217C0d4fB37f',
}));
```

Run: `node onramp-url.ts` and open the printed URL.

With `appId: 1, coinCode: 'usdt', network: 'matic20', fiatAmount: 150, fiatType: 1, paymentMethod: 1` it produces exactly the example URL from the hosted-mode docs. This was tested.

## 4. Overlay widget (SDK)

```ts
// Browser only. https://docs.onramp.money/onramp/onramp-widget-integration/overlay-mode
import { OnrampWebSDK } from '@onramp.money/onramp-web-sdk';

const onramp = new OnrampWebSDK({
  appId: 2,
  flowType: 1,            // 1 buy, 2 sell, 3 merchant checkout
  walletAddress: '0xf142123879b4611Cd4a30C1E0929217C0d4fB37f',
  coinCode: 'usdt',
  network: 'bep20-test',
  fiatType: 1,
  fiatAmount: 1000,       // must be a number
  paymentMethod: 1,
});
onramp.on('TX_EVENTS', (e) => console.log('tx', e.type, e.data));
onramp.on('WIDGET_EVENTS', (e) => console.log('widget', e.type));
await onramp.show();      // async: it first fetches a signed widget URL from api.onramp.money
```

- Every instance is one widget. To open it again after closing, create a new instance (docs note).
- Add `containerId: '#onramp-widget'` to render inside your own `<div id="onramp-widget">` instead of an overlay (from the SDK code and README).
- React version: [recipes.md #3](recipes.md#3-react-overlay-or-embedded-widget).

## 5. Know when an order is done

- `redirectUrl` (hosted): Onramp redirects to `your-url?orderId=123&status=success` or `status=pending`.
- Widget events (`TX_EVENTS`): good for UI only. They are not proof of payment (errors.md #9).
- **Webhook** (server): this is the one to trust. Recipe 6 checks the signature, and the API key and secret come from step 1.3.
- **Order status API** (server): `POST /onramp/api/v2/common/transaction/orderStatus`, recipe 5.

## 6. Test checklist

- [ ] The sandbox link loads with `appId=2&coinCode=usdt&network=bep20-test`. The docs' `matic20-test` shows "not supported" (errors.md #1).
- [ ] The phone number has the `+91-` form (country code, hyphen, number).
- [ ] `fiatAmount` is at or above the minimum the widget shows. On 19 Oct 2026 that was ₹640 for USDT on Polygon with App ID 1, while the docs' limits table says ₹100.
- [ ] The webhook URL is HTTPS with a valid certificate, is set before the first order, and answers within 5 seconds.
