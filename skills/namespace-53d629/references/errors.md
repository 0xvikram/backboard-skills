# Namespace errors and gotchas

"Tested" means seen on 2026-10-19 with @thenamespace/offchain-manager@1.0.13, mint-manager@2.0.0, indexer@1.0.2, ens-components@2.2.0. "SDK source" means read from the installed package's `dist/` code, not run.

## 1. `401` / `403` from the Offchain API

The API key is missing, expired, or not valid for this parent name.
- Create or copy a key in https://app.namespace.ninja/offchain?activeTab=apiKeys.
- Check your server actually loaded `NAMESPACE_API_KEY` (dotenv imported first; not a `NEXT_PUBLIC_` variable).
- Address-based key goes in `defaultApiKey`; a domain-based key must be mapped to the **exact** parent: `domainApiKeys: { 'yourname.eth': key }`.
- The key's network must match `mode` (`'sepolia'` uses the staging API, `'mainnet'` the production API).

Source: https://docs.namespace.ninja/developer-guide/troubleshooting#authentication-errors

## 2. `Api key is not present for name: yourname.eth`

Thrown by the SDK before any request, on writes (`createSubname`, `add*Record`, `deleteSubname`...) when no key is set for that parent. Set `defaultApiKey` or `setApiKey('yourname.eth', key)`. Reads (`isSubnameAvailable`, `getSingleSubname`, `getFilteredSubnames`, `getTextRecords`) need no key.
Source: SDK source (`fetchApiKeyForName`); key-less reads tested live.

## 3. `createSubname` silently overwrites an existing name

The REST endpoint is "Create **or update** a subname" (`POST /api/v1/subnames`). The docs mark this as a danger: call `isSubnameAvailable` and await it before every create, and use the record helpers to change existing names.
Source: https://docs.namespace.ninja/developer-guide/sdks/offchain-manager/is-subname-available, https://docs.namespace.ninja/api-reference/offchain-manager/create-or-update-a-subname

## 4. `updateSubname` wipes records you did not pass

The docs example `client.updateSubname(name, { texts: [...] })` looks like a partial update. In 1.0.13 it re-posts the whole subname with only the fields you pass: `addresses` becomes `[]`, other omitted fields are dropped, and `owner` is not sent. The single-record helpers (`addTextRecord`, `addAddressRecord`, `deleteTextRecord`, `setDefaultEvmAddress`, `addDataRecord`) read the current subname and merge, so prefer them. If you use `updateSubname`, pass every record you want to keep.
Source: SDK source (`_updateSubname` vs `_addTextRecord` in `dist/offchain-client/private-actions.js`); type comment says "replaces existing text records". Not run (needs a key). Verify on a test name if it matters.

## 5. `getSingleSubname` throws on a missing name instead of returning `null`

The docs say it returns `null`. In 1.0.13 a missing name throws an AxiosError with `response.status === 404` (the `try` in the SDK does not `await`). Wrap it in `try/catch`, or use `isSubnameAvailable` to test existence.
Source: tested live (`zz-missing-<timestamp>.artii.eth` threw 404). Docs: https://docs.namespace.ninja/developer-guide/sdks/offchain-manager/get-single-subname

## 6. `instanceof AuthenticationError` never matches

The package exports `AuthenticationError`, `SubnameAlreadyExistsError`, `RateLimitError`... and its README shows `instanceof` checks, but 1.0.13 never throws them. Failures are plain axios errors. Branch on `err.response?.status` (401/403 auth, 404 missing, 429 rate limit, 5xx retry with backoff).
Source: SDK source (no `new AuthenticationError` anywhere in `dist/`); retry advice from https://docs.namespace.ninja/developer-guide/troubleshooting#network-and-rpc-errors

## 7. Mint Manager `checkName` says `available` for a name that is already minted

Tested on the Optimism listing `oppunk.eth`: `lucas.oppunk.eth` is minted (the Indexer shows an owner, `isL2SubnameAvailable` returns `false`), yet `checkName(name, { minterAddress })` with the default `rpc: 'auto'` returned `available`, and `getMintDetails` returned `canMint: true`. With `rpc: 'always'` it correctly returned `taken`. Fix: pass `rpc: 'always'` for user-facing checks, and always `simulateContract` before `writeContract` so a taken name reverts in simulation, not after gas is spent.
Source: tested live; options documented at https://docs.namespace.ninja/developer-guide/sdks/mint-manager/check-name#when-the-registry-is-consulted

## 8. `LISTING_NOT_FOUND`, `UNSUPPORTED_CHAIN`, `RPC_ERROR` (Mint Manager)

- `LISTING_NOT_FOUND`: the parent is not activated on this network. Activate it at https://app.namespace.ninja/onchain, and match `isTestnet` (a mainnet listing is invisible to `isTestnet: true`). Tested: an unlisted parent threw this code.
- `UNSUPPORTED_CHAIN`: no Namespace deployment for that chain in this environment. L2 minting is Base, Optimism (and Base Sepolia for testnet) only.
- `RPC_ERROR`: the registry read failed. The name's status is **unknown**, not taken. Retry, and pass your own `customRpcUrls` (the default endpoints are shared and rate limited).
- `PRICE_EXCEEDS_MAX` / `SIGNATURE_EXPIRED`: re-run `checkName`, show the new price, call `prepareMint` again right before sending.
- Simulation fails: wallet and public clients must be on `check.chainId`; pass `value` unchanged; enough ETH for price + gas.

Always branch on `error.code` of `MintManagerError`, not the message.
Source: https://docs.namespace.ninja/developer-guide/sdks/mint-manager/errors

## 9. ENS Components wants wagmi 2

`@thenamespace/ens-components@2.2.0` declares peers `wagmi ^2.19.5`, `viem ^2.46.3`, `react >=19`. In a wagmi 3 app npm will report a peer conflict. Use wagmi 2.19.5 for the app that renders these components (type-checks clean with wagmi@2.19.5 + viem@2.57.7), or build your own form on the SDKs. The app must provide `WagmiProvider` and `QueryClientProvider`.
Source: `npm view @thenamespace/ens-components peerDependencies`; https://docs.namespace.ninja/developer-guide/sdks/ens-components

## 10. Offchain name does not resolve, or reverse lookup is empty

- Parent resolver not set: in the Namespace App, Offchain > Resolution must show **Updated** and **Configured**.
- The reading app must support CCIP Read (viem, ethers v6, ENS app do).
- Wrong network: a Sepolia parent with `mode: 'mainnet'` (or the reverse) stores the name in the other database.
- Offchain subnames have no reverse resolution: `getEnsName(address)` will not return them. Query `getFilteredSubnames({ owner })` instead.
- Record keys are case-sensitive; addresses come back keyed by coin type (`"60"` for ETH).
- Test the name with Resolvio (`https://api.resolvio.xyz/ens/v2/profile/<name>`) to tell a resolver problem from an app problem.

Source: https://docs.namespace.ninja/developer-guide/troubleshooting#resolution-errors, https://docs.namespace.ninja/developer-guide/guide/create-offchain-subnames#ens-client-compatibility

## Docs vs SDK differences found (follow the SDK)

| Topic | Docs say | SDK / live API does |
| - | - | - |
| Indexer `getL2Subname` | `texts`, `addresses` top-level | under `records.texts`, `records.addresses` |
| Indexer `getL2Subnames` | `page: 0` | pages start at 1 (`page: 0` returns page 1) |
| `getSingleSubname` missing | returns `null` | throws 404 |
| API key page | README: dev.namespace.ninja | docs: app.namespace.ninja/offchain?activeTab=apiKeys (use this) |
| ENS Components CSS | `@thenamespace/ens-components/styles` | both that and `/styles.css` are exported |
