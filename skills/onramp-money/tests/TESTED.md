Original log from 2026-10-19; current checks: see README.md

# TESTED: onramp-money (not part of the skill)

Date: 2026-10-19. Machine: macOS, Node v24.21.0, npm 11.
Test folder: `scratchpad/deep/_test/onramp-money/`. No API key or secret was used, and no real money was involved.

## Sources read

- Docs index https://docs.onramp.money/onramp/llms.txt. The root `https://docs.onramp.money/` and `/llms.txt` redirect to a GitBook login, and only the `/onramp/` space is public. All 92 pages were downloaded as `.md` and read: hosted, sandbox, overlay, webhook (on and off), REST sample, order status, generateLink, quotes, setWebhookUrl, sendDummyWebhook, current timestamp and sync guide, error codes, status codes, KYC tiers, India KYC, fiat currencies, payment methods, limits, change logs, onboarding.
- https://onramp.money/llms.txt, `.well-known/agent-skills/*` and `.well-known/mcp/server-card.json`. The MCP card is a browser-side "webmcp" transport, not a server you install with `claude mcp add`, so there is no `mcp.md`.
- npm: `@onramp.money/onramp-web-sdk` (latest 2.0.1, published 2026-01-27); its README, `.d.ts` and the full `dist/onramp-web-sdk.es5.js` source. The React Native SDK (1.0.0) was noted but not covered.

## Versions installed

| Package | Version | Use |
| - | - | - |
| @onramp.money/onramp-web-sdk | 2.0.1 | SDK under test |
| express | 5.3.0 | webhook recipe |
| react / react-dom | 19.3.1 | React recipe type-check |
| @types/react | 19.3.0 | |
| @types/express | 5.0.6 | |
| @types/node | 24.19.2 | |
| typescript | 5.9.3 | |
| crypto-js | 4.2.0 | dev only: to prove node:crypto matches the docs' signing |
| jsdom | 26.1.0 | dev only: DOM for SDK tests |
| esbuild | 0.28.2 | dev only: check bundler resolution |

## What I ran and the results

1. **Type-check, Node side** (`tsc -p tsconfig.json`, strict, NodeNext): URL builder, signing/verify helpers, coin lookups, Express 5 webhook server, tests. **PASS.**
2. **Type-check, React side** (`tsc -p tsconfig.react.json`, strict, moduleResolution bundler): `BuyCryptoButton.tsx` plus an SDK types probe with two `@ts-expect-error` checks (`containerId` must be `#...`; `appId` is required). **PASS.**
   - Under NodeNext the React file failed: `TS7006 Parameter 'e' implicitly has an 'any' type`. `--traceResolution` shows `Module name './types' was not resolved` inside the SDK's d.ts. This became errors.md #6.
3. **Every code block in the skill**: a script pulled all 9 ```ts/```tsx blocks from SKILL.md, quickstart.md and recipes.md into `fromdocs/` and type-checked them (bundler resolution, strict). **PASS.** Run as well: the SKILL quickstart block (prints the sandbox URL), the quickstart `onramp-url.ts`, recipe 1, and recipe 4 (live public API). **PASS.**
4. **URL builder tests** (`tests/url.test.ts`): output equals the docs' example URL byte for byte; `+91-...` becomes `%2B91-...`; `redirectUrl` is encoded; passing both amounts throws. **PASS.**
5. **Signing tests** (`tests/sign.test.ts`): `node:crypto` HMAC-SHA512 hex over the base64 `{timestamp, body}` payload equals the docs' `crypto-js` output; the payload decodes back to the input; webhook verify passes with the right secret and fails with a wrong secret, a tampered payload, a missing header or a short signature. **PASS.**
6. **Webhook server** (`tests/webhook.test.ts`): ran `server/webhook.ts` on localhost:3917 with a test secret. A self-signed POST got 200, the duplicate got 200 and was logged once, and a bad signature got 403. **PASS.** (Localhost only.)
7. **SDK behaviour in jsdom** (`tests/sdk-jsdom.test.mjs`, `fetch` stubbed so nothing left the machine): 7 config errors reproduced with their exact messages (errors.md #4). `show()` requests `https://api.onramp.money/sdk-apis/generate-url` with `appId`, `mode=embedded`, `network` and `fiatAmount`; the iframe mounts inside `#onramp-widget`; a second `show()` throws; `close()` removes the iframe and a second `close()` throws; `sandbox: true` points at `https://test.onramp.money/onramp/main`. Simulated `postMessage` events reached `TX_EVENTS` and `WIDGET_EVENTS` **with no origin check** (errors.md #9). **PASS.**
8. **Node import of the SDK**: `import()` and `require()` both return `{}` (UMD main, `"type": "module"`, no exports map). An esbuild browser bundle resolves `dist/onramp-web-sdk.es5.js` and `typeof OnrampWebSDK === 'function'`. This became errors.md #5.
9. **Live public reads** (GET, no key): `v3/buy/public/listAllCoins` 200; `coinNetworks` without params gives 400 `Missing parameter(s) -> coinCode, fiatType`; `coinNetworks?coinCode=usdt|usdc|eth|wld|hbar&fiatType=1` 200; `coinDetails` for USDT/matic20/₹1000 gives price 106 and has a `tdsFee` field; `v2/sell/public/allConfig` 200 (141 networks); `currentTimestamp` 200.
10. **`sdk-apis/generate-url`** (the GET the SDK itself makes, only public params): `appId=2` returns an `onramp.money/main/buy/?appId=2&...&isRestricted=true` URL; `sandbox=true` returns `test.onramp.money/onramp-gobhi/main/buy/...`.
11. **Widget pages in a headless browser** (Playwright, page loads only, nothing submitted):
    - `buy/?appId=2&coinCode=usdt&network=matic20-test` (the docs' sandbox): "The selected network (MATIC20-TEST) is not supported for USDT transactions". **The docs are stale.**
    - `buy/?appId=2&coinCode=usdt&network=bep20-test`: loads (INR, UPI, "BEP20-TEST · Network Fee").
    - `sell/?appId=2&coinCode=usdt&network=bep20-test`: loads (min ₹50).
    - `buy/?appId=1&coinCode=usdt&network=matic20&fiatType=1&fiatAmount=500&paymentMethod=1`: loads, "min amount is ₹ 640", UPI.
    - `buy/?appId=1&coinCode=usdc&network=wld...`: "Transactions are not available for the selected coin: USDC".
    - `buy/?appId=1&coinCode=wld&network=wld...`: the address prompt says "BEP20 network address". World Chain buy is not confirmed.

## Not tested

- Any signed REST call against the real API (`orderStatus`, `generateLink`, `quotes`, `merchantHistory`, `setWebhookUrl`, `sendDummyWebhook`). No keys.
- A real webhook from Onramp, and the actual content of the `x-onramp-payload` header. The verify follows the docs' sample (HMAC of the header string). My test used a self-made base64 payload.
- A full sandbox order (needs a phone number and OTP) and real event names from the live widget.
- `sandbox: true` in the SDK (test.onramp.money/onramp-gobhi) beyond the generated URL.
- Hedera and Arc in the widget. The React Native, Android and iOS SDKs.

## Doubts for the reviewer

1. Sandbox network: `bep20-test` was observed working; the docs say `matic20-test`. If Onramp changes the sandbox again, errors.md #1 needs an update.
2. Event names: the docs (`ONRAMP_WIDGET_TX_COMPLETED`) and the npm README (`ONRAMP_WIDGET_TX_SUCCESSFUL`) disagree. The skill tells users to log `e.type`.
3. `generateLink` body field `flowType` vs `type`: the docs contradict themselves. Not resolved.
4. Arc: Onramp's `arc` network gives no chain id, so it is unknown whether it is mainnet or testnet.
5. Sign-up path: the docs mention both https://playground.onramp.money/signup/ (returns 200) and Google Forms. Which one Onramp prefers for hackers is unclear; the perk text says to contact the team.
6. The perk is quoted exactly as given: "Zero Onramp fee for 2 month for your users after integration (Blockchain fee & provider fee still applicable)".
