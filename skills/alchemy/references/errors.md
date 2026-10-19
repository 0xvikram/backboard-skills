# Alchemy errors and gotchas

Main reference: [Error Reference](https://www.alchemy.com/docs/reference/error-reference). "Seen" means we hit the error ourselves on 2026-10-19.

Alchemy can return **HTTP 200 with an `error` field** in the JSON. Check both the HTTP status and `json.error`.

## 1. `Must be authenticated!` (HTTP 401, code -32600)

Seen with a wrong or missing key. viem shows `InvalidRequestRpcError: JSON is not a valid request object. Details: Must be authenticated!`. ethers shows `server response 401 Unauthorized`.
**Fix:** the key goes in the URL path: `https://<network>.g.alchemy.com/v2/<KEY>` for JSON-RPC, `.../nft/v3/<KEY>/...` for NFTs, `https://api.g.alchemy.com/data/v1/<KEY>/...` for the Portfolio API. Make sure `.env` is actually loaded (`npx tsx --env-file=.env file.ts`).

## 2. `Unspecified origin not on whitelist` / `Origin not on whitelist` (HTTP 403)

The app has an allowlist (origin, IP, address or network) and your request does not match ([source](https://www.alchemy.com/docs/reference/error-reference)). Seen: the `docs-demo` key in the docs' code samples is locked like this, so it does not work from your own code.
**Fix:** use your own key, and update the app's allowlist in the dashboard.

## 3. `Only core evm requests are allowed.` (code -32600)

Seen when calling `alchemy_getTokenBalances` or `alchemy_getAssetTransfers` on `https://worldchain-mainnet.g.alchemy.com/public`. viem uses that URL by default for `worldchain`/`worldchainSepolia` if you call `http()` with no URL.
**Fix:** always pass your own Alchemy URL with a key to `http(...)`. The public endpoint is only for basic `eth_*` calls.

## 4. `unsupported network` / `unknown network` from ethers `AlchemyProvider`

Seen with ethers 6.17.0: `new AlchemyProvider(480, key)` throws `unsupported network`, and `"worldchain"` throws `unknown network`. Its built-in list covers only mainnet, sepolia, arbitrum, base, bnb, matic and optimism.
**Fix:** `new JsonRpcProvider(alchemyUrl, Network.from(chainId), { staticNetwork: true })` ([recipe 1](recipes.md#1-rpc-url-per-network-viem-and-ethers)).

## 5. HTTP 429: `Your app has exceeded its compute units per second capacity.`

Free tier has 300 CU/s ([pricing](https://www.alchemy.com/docs/reference/pricing-plans)). Enhanced APIs cost more CU than plain calls (for example `alchemy_getAssetTransfers` is 120 CU).
**Fix:** retry with backoff (viem: `http(url, { retryCount: 5, retryDelay: 500 })`), cache results, and don't fire a `Promise.all` over hundreds of tokens. See [throughput](https://www.alchemy.com/docs/reference/throughput).

## 6. Monthly capacity limit exceeded / App is inactive (HTTP 403)

You have used up the free monthly CUs, or the app is disabled ([source](https://www.alchemy.com/docs/reference/error-reference)).
**Fix:** check usage in the dashboard. Use a second app or key for heavy indexing scripts so your demo key stays alive.

## 7. A chain works for one app but not another

Each app only serves the chains you enabled when you created it ([source](https://www.alchemy.com/docs/create-an-api-key)).
**Fix:** open the app → Networks/Endpoints and enable World Chain / Unichain / Arc. Gas sponsorship policies also need the chain enabled on the app ([source](https://www.alchemy.com/docs/wallets/transactions/sponsor-gas/sponsorship-policy-management)).

## 8. Transfers API quirks

From [alchemy_getAssetTransfers](https://www.alchemy.com/docs/data/transfers-api/transfers-endpoints/alchemy-get-asset-transfers):
- The `internal` category works only on Ethereum, Polygon, Base, Arc Mainnet and Arc Testnet. Leave it out on World Chain and Unichain.
- `withMetadata` (timestamps) works only on ETH, Base, Polygon, Arbitrum and Optimism.
- `maxCount` is a hex string (`"0x64"`), not a number.
- `pageKey` expires after 10 minutes ([overview](https://www.alchemy.com/docs/reference/transfers-api-quickstart)).

## 9. Webhook signature never matches

The signature is HMAC-SHA256 over the **raw request body**, not over re-serialized JSON ([source](https://www.alchemy.com/docs/reference/notify-api-quickstart)). Also, the per-webhook **signing key** is not the dashboard **Auth Token** and not your API key.
**Fix:** read the raw body before parsing (or `express.json({ verify })` to keep it). Use the signing key of that webhook. Compare with `timingSafeEqual`. Webhook management calls without a valid `X-Alchemy-Token` return `401 { message: 'Unauthenticated request.', name: 'AuthError' }` (seen).

## 10. Gas sponsorship fails before it starts

- `Invalid params: /capabilities/paymasterService/policyId: Must be a valid UUID string` (seen): pass the real Policy ID from the Gas Sponsorship dashboard, not a name or placeholder.
- "All teams must undergo a short review process before they can start sponsoring gas", so email support@alchemy.com. Mainnet sponsorship needs PAYG or Enterprise ([source](https://www.alchemy.com/docs/wallets/transactions/sponsor-gas/sponsorship-policy-management)).
- `EIP-7702 is not enabled on {chainName}...`: that chain does not support 7702. Follow the non-7702 mode in the [EIP-7702 docs](https://www.alchemy.com/docs/wallets/transactions/using-eip-7702).

## 11. Deprecated packages

- `alchemy-sdk`: deprecated, "Never install `alchemy-sdk`" ([source](https://www.alchemy.com/docs/data-apis-with-cursor)). npm still serves 3.6.5 (last published Sept 2025) without a deprecation flag, so tutorials still use it.
- Account Kit (`@account-kit/react`, signer and embedded wallets): deprecated. Use Wallet APIs (`@alchemy/wallet-apis`) with a signer such as Privy ([source](https://www.alchemy.com/docs/wallets/account-kit-deprecated)).
- Old hostnames `eth-mainnet.alchemy.io` cause `ENOTFOUND getaddrinfo`. Use `*.g.alchemy.com` ([source](https://www.alchemy.com/docs/reference/error-reference)).

## 12. Your API key leaks in error messages

Seen: ethers errors include `requestUrl: https://...g.alchemy.com/v2/<KEY>`, and viem errors include the URL too.
**Fix:** never send raw RPC errors to the browser or post them in public Discord threads. Log them on the server only.
