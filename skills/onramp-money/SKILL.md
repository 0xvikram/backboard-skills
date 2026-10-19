---
name: onramp-money
description: "Onramp.money is a fiat-to-crypto on-ramp and off-ramp (INR via UPI/IMPS and 30+ other currencies) you add as a hosted link, an overlay or embedded widget, plus signed REST APIs and webhooks. Use when a hacker says Onramp, onramp.money, buy crypto with UPI or INR, fiat on-ramp, off-ramp to bank, sell USDT for rupees, @onramp.money/onramp-web-sdk, OnrampWebSDK, appId, X-ONRAMP-SIGNATURE, or Onramp webhook."
license: MIT
metadata:
  category: "Payments & stablecoins"
  website: "https://onramp.money/"
  source: "tested"
  tested: "2026-10-19"
  packages: "@onramp.money/onramp-web-sdk@2.0.1 (optional), express@5.3.0 (webhook recipe only)"
---

# Onramp.money

Onramp lets your users pay in fiat (INR by UPI or IMPS in India, plus TRY, AED, MXN, EUR, NGN, BRL and more) and get crypto sent to their wallet, or sell crypto and get fiat in their bank account. Onramp runs the KYC, payment and payout; you send users to its widget with a link or the web SDK.
Pick it when your app needs "pay with UPI, get USDT in your wallet" or a cash-out to an Indian bank. Skip it if you only move crypto between wallets. Real money and KYC are involved, so plan your demo around the sandbox.

## Quickstart

1. **Sandbox first, no signup.** The public test App ID is `2` (sandbox docs: https://docs.onramp.money/onramp/onramp-widget-integration/sandbox-mode). For your own App ID, sign up at https://playground.onramp.money/signup/ (Onramp then runs a KYB check and a call before it issues one: https://docs.onramp.money/onramp/merchant-onboarding-flow). The API key and secret for REST calls and webhooks come through this form: https://forms.gle/i1hpWi8oq5Zv2jpt8.
2. The hosted link needs no package. For the overlay or embedded widget, install the SDK:
   ```sh
   npm i @onramp.money/onramp-web-sdk@2.0.1
   ```
3. Env (placeholders): `ONRAMP_APP_ID=2` for the browser; for the server only, `ONRAMP_API_KEY=<YOUR_API_KEY>` and `ONRAMP_API_SECRET=<YOUR_API_SECRET>`.
4. The smallest working example builds a hosted buy or sell link (`onramp-url.ts`):
   ```ts
   export function buildOnrampUrl(flow: 'buy' | 'sell', params: Record<string, string | number | undefined>) {
     if (params.fiatAmount !== undefined && params.coinAmount !== undefined) throw new Error('fiatAmount or coinAmount, not both');
     const url = new URL(`https://onramp.money/main/${flow}/`);
     for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
     return url.toString();
   }
   console.log(buildOnrampUrl('buy', {
     appId: 2, coinCode: 'usdt', network: 'bep20-test',  // sandbox pair that loaded on 19 Oct 2026
     fiatType: 1, fiatAmount: 1000, paymentMethod: 1,      // INR, UPI
     walletAddress: '0xf142123879b4611Cd4a30C1E0929217C0d4fB37f',
   }));
   ```
5. Run it with `node onramp-url.ts` (Node 22.18+ runs TypeScript directly), then open the URL. In production, swap in your App ID and a real pair such as `usdt` + `bep20` or `matic20`.
6. Sandbox flow: you enter a phone number and OTP, the payment details are blurred on purpose, you click "I HAVE PAID", and test USDT is sent (https://docs.onramp.money/onramp/onramp-widget-integration/sandbox-mode/sandbox-quick-guide). Never send real money to a sandbox order.

Full walkthrough (dashboard, overlay, webhook): [references/quickstart.md](references/quickstart.md).

## Common tasks

- [Hosted buy link (on-ramp) with prefilled coin, network, fiat, wallet and redirect](references/recipes.md#1-hosted-buy-link-on-ramp)
- [Hosted sell link (off-ramp to a bank)](references/recipes.md#2-hosted-sell-link-off-ramp)
- [React: overlay or embedded widget with the web SDK](references/recipes.md#3-react-overlay-or-embedded-widget)
- [Look up coin codes, networks and prices (public API, no key)](references/recipes.md#4-coin-codes-networks-and-prices-public-api)
- [Signed REST calls: order status, fraud-proof link, merchant history](references/recipes.md#5-signed-rest-calls)
- [Webhook receiver with signature check](references/recipes.md#6-webhook-receiver)
- [India: INR, UPI, KYC and limits](references/recipes.md#7-india-inr-upi-and-kyc)
- Errors and gotchas: [references/errors.md](references/errors.md) · Sponsor chains: [references/chains.md](references/chains.md)

## Before you write more code

- Read the docs index first: https://docs.onramp.money/onramp/llms.txt. Every page is also available as Markdown if you add `.md` to its URL. The site's own AI index is https://onramp.money/llms.txt.
- Check the SDK version: `npm view @onramp.money/onramp-web-sdk version` (2.0.1 on 19 Oct 2026). The npm README, the docs and the SDK code disagree on a few names (errors.md #3). Log `e.type` from events instead of trusting any one of them.
- Coin and network support changes often. Read it live from the public API (recipe 4), not from the tables in the docs.
- When this skill and the official docs disagree, the docs win, unless what you see live (the API response or the widget) says otherwise.

## At ETHGlobal Mumbai

- **The Onramp team's own hackathon offer** (verified team on Backboard): "Zero Onramp fee for 2 month for your users after integration (Blockchain fee & provider fee still applicable)". Ask the team how to claim it.
- Sponsor chains: on 19 Oct 2026 Onramp's config API listed network codes `wld` (World Chain), `hbar` (Hedera) and `arc` (Arc), but the World Chain buy flow did not work in the widget for INR. Unichain, 0G and Whitechain were not listed. Details: [references/chains.md](references/chains.md).
- May help with: the World, Hedera and Arc tracks, and any consumer or payments project that needs an INR/UPI on-ramp for Indian users. Check each track's rules yourself: https://ethglobal.com/events/mumbai/prizes
- Help: support@onramp.money, Telegram https://t.me/onramp_money (linked from https://onramp.money/contact/), docs https://docs.onramp.money/onramp/llms.txt

## About

Hand-written for Backboard (https://backboard.0xvikram.me), an independent project not affiliated with ETHGlobal or Onramp.money. Tested 2026-10-19 with @onramp.money/onramp-web-sdk@2.0.1, express@5.3.0, Node 24, TypeScript 5.9.3.
