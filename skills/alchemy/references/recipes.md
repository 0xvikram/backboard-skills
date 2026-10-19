# Alchemy recipes

All code tested on 2026-10-19 with viem@2.57.7, ethers@6.17.0 and @alchemy/wallet-apis@5.3.0: type-checked with `tsc --strict`, and run where no real key was needed (see the notes under each recipe). Run any file with `npx tsx --env-file=.env <file>.ts`, with `"type": "module"` in `package.json`.

Do not use `alchemy-sdk`. It is deprecated ([source](https://www.alchemy.com/docs/data-apis-with-cursor)). Everything below is plain HTTP plus viem.

## 1. RPC URL per network, viem and ethers

**Goal:** one helper that gives you an Alchemy URL, a viem client and an ethers provider for World Chain, Unichain or Arc.

Based on: [supported chains / URLs](https://www.alchemy.com/docs/reference/node-supported-chains), [World Chain quickstart](https://www.alchemy.com/docs/reference/world-chain-api-quickstart), [Unichain quickstart](https://www.alchemy.com/docs/reference/unichain-api-quickstart), [Arc FAQ](https://www.alchemy.com/docs/reference/arc-api-faq).

```ts
// networks.ts — one helper for every Alchemy network you use
import { createPublicClient, http, type Chain } from "viem";
import {
  worldchain, worldchainSepolia,
  unichain, unichainSepolia,
  arc, arcTestnet,
} from "viem/chains";
import { JsonRpcProvider, Network } from "ethers";

// Alchemy network slug -> viem chain. Slugs come from
// https://www.alchemy.com/docs/reference/node-supported-chains
export const NETWORKS = {
  "worldchain-mainnet": worldchain,
  "worldchain-sepolia": worldchainSepolia,
  "unichain-mainnet": unichain,
  "unichain-sepolia": unichainSepolia,
  "arc-mainnet": arc,
  "arc-testnet": arcTestnet,
} as const satisfies Record<string, Chain>;

export type AlchemyNetwork = keyof typeof NETWORKS;

export function alchemyUrl(network: AlchemyNetwork, key = process.env.ALCHEMY_API_KEY): string {
  if (!key) throw new Error("Set ALCHEMY_API_KEY");
  return `https://${network}.g.alchemy.com/v2/${key}`;
}

// viem
export function viemClient(network: AlchemyNetwork) {
  return createPublicClient({ chain: NETWORKS[network], transport: http(alchemyUrl(network)) });
}

// ethers v6: AlchemyProvider has no World Chain / Unichain / Arc presets,
// so use JsonRpcProvider with the URL and a static network (skips the chainId probe).
export function ethersProvider(network: AlchemyNetwork) {
  const chain = NETWORKS[network];
  return new JsonRpcProvider(alchemyUrl(network), Network.from(chain.id), { staticNetwork: true });
}
```

Usage: `const block = await viemClient("unichain-sepolia").getBlockNumber();`

**Notes**
- Each app has a list of enabled chains. Enable every slug you use in the dashboard.
- The same viem and ethers code was run against each chain's public RPC: all six chain IDs matched and block numbers came back.
- To write, use `createWalletClient({ chain: NETWORKS[n], transport: http(alchemyUrl(n)), account })` with a testnet key.

## 2. ERC-20 balances on one chain

**Goal:** list the non-zero ERC-20 tokens a wallet holds, with symbol and decimals.

Based on: [alchemy_getTokenBalances](https://www.alchemy.com/docs/data/token-api/token-api-endpoints/alchemy-get-token-balances), [alchemy_getTokenMetadata](https://www.alchemy.com/docs/data/token-api/token-api-endpoints/alchemy-get-token-metadata).

Alchemy-only methods are not in viem's typed RPC schema, so use a small `fetch` helper (it reuses `alchemyUrl` from recipe 1):

```ts
// alchemy-rpc.ts — tiny typed helper for Alchemy-only JSON-RPC methods
import type { AlchemyNetwork } from "./networks.js";
import { alchemyUrl } from "./networks.js";

export async function alchemyRpc<T>(network: AlchemyNetwork, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(alchemyUrl(network), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: T; error?: { code: number; message: string } };
  if (!res.ok || json.error) {
    throw new Error(`${method} failed (HTTP ${res.status}): ${json.error?.message ?? "unknown error"}`);
  }
  return json.result as T;
}
```

```ts
// token-balances.ts — ERC-20 balances + metadata on one network
import { formatUnits, hexToBigInt, type Hex } from "viem";
import { alchemyRpc } from "./alchemy-rpc.js";

type Balances = {
  address: string;
  tokenBalances: { contractAddress: string; tokenBalance: Hex | null; error?: string | null }[];
  pageKey?: string;
};
type Metadata = { name: string | null; symbol: string | null; decimals: number | null; logo: string | null };

export async function getErc20Balances(owner: string) {
  // "erc20" = every ERC-20 the address has touched. Pass an array of token addresses instead to check only those.
  const { tokenBalances } = await alchemyRpc<Balances>("worldchain-mainnet", "alchemy_getTokenBalances", [owner, "erc20"]);
  const nonZero = tokenBalances.filter((t) => t.tokenBalance && hexToBigInt(t.tokenBalance) > 0n);

  return Promise.all(
    nonZero.map(async (t) => {
      const meta = await alchemyRpc<Metadata>("worldchain-mainnet", "alchemy_getTokenMetadata", [t.contractAddress]);
      return {
        token: t.contractAddress,
        symbol: meta.symbol ?? "?",
        amount: formatUnits(hexToBigInt(t.tokenBalance!), meta.decimals ?? 18),
      };
    }),
  );
}

console.log(await getErc20Balances(process.argv[2] ?? "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"));
```

**Notes**
- The second parameter can be `"erc20"` (every token the address has touched), `"NATIVE_TOKEN"`, or an array of token contract addresses. `"DEFAULT_TOKENS"` is deprecated.
- `tokenBalance` is a hex string. Convert it with `hexToBigInt`, then `formatUnits` with the token's `decimals`.
- Long lists come back paged (`pageKey`). Pass `{ pageKey }` as the third parameter to get the next page.
- To check one known token, `readContract` with the ERC-20 ABI on a viem client also works.
- Check that the Token API is enabled for your chain at https://dashboard.alchemy.com/chains.

## 3. Balances across chains (Portfolio API)

**Goal:** native and ERC-20 balances for one wallet on several networks in one request.

Based on: [Token Balances By Wallet](https://www.alchemy.com/docs/data/portfolio-apis/portfolio-api-endpoints/portfolio-api-endpoints/get-token-balances-by-address).

```ts
// portfolio.ts — balances for one wallet across several networks in one call (Portfolio API)
const key = process.env.ALCHEMY_API_KEY;
if (!key) throw new Error("Set ALCHEMY_API_KEY");

type PortfolioResponse = {
  data: { tokens: { network: string; address: string; tokenAddress: string | null; tokenBalance: string }[]; pageKey?: string };
  error?: { message: string; partialErrors: { network: string; message: string }[] };
};

const res = await fetch(`https://api.g.alchemy.com/data/v1/${key}/assets/tokens/balances/by-address`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    // max 3 address/network pairs, max 20 networks; network slugs: https://dashboard.alchemy.com/chains
    addresses: [{ address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", networks: ["eth-mainnet", "base-mainnet"] }],
    includeNativeTokens: true,
    includeErc20Tokens: true,
  }),
});
if (!res.ok) throw new Error(`Portfolio API HTTP ${res.status}: ${await res.text()}`);
const body = (await res.json()) as PortfolioResponse;
if (body.error) console.warn("Some networks failed:", body.error.partialErrors); // still HTTP 200
for (const t of body.data.tokens) console.log(t.network, t.tokenAddress ?? "native", BigInt(t.tokenBalance));
```

**Notes**
- Limit: 3 address/network pairs and 20 networks per request.
- If some networks fail, the response is still **HTTP 200**, with `error.partialErrors` listing the failed networks. Always check for it.
- The docs say the endpoint covers "Ethereum, Solana, and 30+ EVM chains". This skill did not confirm that World Chain, Unichain or Arc are among them. Check https://dashboard.alchemy.com/chains, or use recipe 2 per chain.
- There is also "Tokens By Wallet", which adds prices and metadata: [docs](https://www.alchemy.com/docs/data/portfolio-apis/portfolio-api-endpoints/portfolio-api-endpoints/get-tokens-by-address).

## 4. NFTs owned by a wallet

**Goal:** every NFT a wallet owns on World Chain, with name and image.

Based on: [NFTs By Owner (getNFTsForOwner v3)](https://www.alchemy.com/docs/reference/nft-api-endpoints/nft-api-endpoints/nft-ownership-endpoints/get-nf-ts-for-owner-v-3). The docs name World Chain as supported.

```ts
// nfts.ts — all NFTs a wallet owns on World Chain (NFT API v3, REST GET)
const key = process.env.ALCHEMY_API_KEY;
if (!key) throw new Error("Set ALCHEMY_API_KEY");

type Nft = { contract: { address: string; name?: string }; tokenId: string; tokenType: string; name?: string; image?: { cachedUrl?: string } };
type Page = { ownedNfts: Nft[]; totalCount: number; pageKey?: string };

export async function getAllNfts(owner: string): Promise<Nft[]> {
  const all: Nft[] = [];
  let pageKey: string | undefined;
  do {
    const url = new URL(`https://worldchain-mainnet.g.alchemy.com/nft/v3/${key}/getNFTsForOwner`);
    url.searchParams.set("owner", owner);
    url.searchParams.set("withMetadata", "true");
    url.searchParams.set("pageSize", "100"); // max 100
    if (pageKey) url.searchParams.set("pageKey", pageKey);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`getNFTsForOwner HTTP ${res.status}: ${await res.text()}`);
    const page = (await res.json()) as Page;
    all.push(...page.ownedNfts);
    pageKey = page.pageKey;
  } while (pageKey);
  return all;
}

const nfts = await getAllNfts(process.argv[2] ?? "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
for (const n of nfts) console.log(n.contract.address, n.tokenId, n.name ?? "", n.image?.cachedUrl ?? "");
```

**Notes**
- The NFT API is REST (GET), not JSON-RPC. Its path is `/nft/v3/<key>/...`, not `/v2/<key>`.
- `pageSize` max is 100. Loop until `pageKey` is missing.
- Filter one collection with `contractAddresses[]=0x...` (max 45).
- Spam filtering (`excludeFilters[]=SPAM`) is paid-tier only.
- Use `getOwnersForNFT` or `getOwnersForContract` for "who holds my collection" ([docs](https://www.alchemy.com/docs/reference/nft-api-endpoints)).

## 5. Transfer history (activity feed)

**Goal:** sent and received transfers for an address (native, ERC-20, NFTs), newest first.

Based on: [alchemy_getAssetTransfers](https://www.alchemy.com/docs/data/transfers-api/transfers-endpoints/alchemy-get-asset-transfers), [Transfers API overview](https://www.alchemy.com/docs/reference/transfers-api-quickstart).

```ts
// transfers.ts — activity feed (in + out) for an address via alchemy_getAssetTransfers
import { alchemyRpc } from "./alchemy-rpc.js";

type Transfer = {
  blockNum: string; hash: string; from: string; to: string | null;
  value: number | null; asset: string | null; category: string; uniqueId: string;
};
type Result = { transfers: Transfer[]; pageKey?: string };

async function fetchAll(params: Record<string, unknown>): Promise<Transfer[]> {
  const out: Transfer[] = [];
  let pageKey: string | undefined;
  do {
    const r = await alchemyRpc<Result>("unichain-mainnet", "alchemy_getAssetTransfers", [
      { ...params, ...(pageKey ? { pageKey } : {}) },
    ]);
    out.push(...r.transfers);
    pageKey = r.pageKey; // page keys expire after 10 minutes
  } while (pageKey);
  return out;
}

export async function activity(address: string) {
  const base = {
    fromBlock: "0x0",
    toBlock: "latest",
    // "internal" is only on Ethereum, Polygon, Base and Arc — leave it out on World Chain / Unichain
    category: ["external", "erc20", "erc721", "erc1155"],
    excludeZeroValue: true,
    maxCount: "0x64", // hex string, 100 per page (default and max 0x3e8 = 1000)
    order: "desc",
  };
  // one address filter per call: fetch sent and received separately, then merge
  const [sent, received] = await Promise.all([fetchAll({ ...base, fromAddress: address }), fetchAll({ ...base, toAddress: address })]);
  const seen = new Set<string>();
  return [...sent, ...received]
    .filter((t) => (seen.has(t.uniqueId) ? false : (seen.add(t.uniqueId), true)))
    .sort((a, b) => Number(BigInt(b.blockNum) - BigInt(a.blockNum)));
}

const feed = await activity(process.argv[2] ?? "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
for (const t of feed.slice(0, 20)) console.log(BigInt(t.blockNum), t.category, t.asset, t.value, t.from, "->", t.to, t.hash);
```

**Notes**
- If you set both `fromAddress` and `toAddress`, a transfer must match both. For "in and out", make two calls (as above) and merge them by `uniqueId`.
- `maxCount` is a **hex string** (`"0x64"`), not a number. Up to 1000 per page.
- `pageKey` expires after 10 minutes.
- The `internal` category is only on Ethereum, Polygon, Base, Arc Mainnet and Arc Testnet. On World Chain and Unichain, leave it out.
- `withMetadata: true` (block timestamps) works only on ETH, Base, Polygon, Arbitrum and Optimism. Elsewhere, call `getBlock({ blockNumber })` for timestamps.
- Check chain support for the Transfers API at https://dashboard.alchemy.com/chains.

## 6. Address Activity webhook

**Goal:** get a POST to your server when watched addresses send or receive ETH, ERC-20, ERC-721 or ERC-1155. For example, "payment received" in a World Chain app.

Based on: [Webhooks quickstart + signature](https://www.alchemy.com/docs/reference/notify-api-quickstart), [Address Activity webhook](https://www.alchemy.com/docs/reference/address-activity-webhook), [Create webhook API](https://www.alchemy.com/docs/data/webhooks/webhooks-api-endpoints/notify-api-endpoints/create-webhook), [Add/remove addresses](https://www.alchemy.com/docs/data/webhooks/webhooks-api-endpoints/notify-api-endpoints/update-webhook-addresses).

You can also create it in the dashboard: https://dashboard.alchemy.com/apps/latest/webhooks → **Create Webhook**. Or create it with the API:

```ts
// webhook-create.ts — create an Address Activity webhook on World Chain (Notify API)
const token = process.env.ALCHEMY_WEBHOOK_AUTH_TOKEN; // dashboard -> Webhooks -> "Auth Token" (not your API key)
if (!token) throw new Error("Set ALCHEMY_WEBHOOK_AUTH_TOKEN");

const res = await fetch("https://dashboard.alchemy.com/api/create-webhook", {
  method: "POST",
  headers: { "content-type": "application/json", "X-Alchemy-Token": token },
  body: JSON.stringify({
    network: "WORLDCHAIN_MAINNET", // or UNICHAIN_MAINNET, ARC_TESTNET, WORLDCHAIN_SEPOLIA ...
    webhook_type: "ADDRESS_ACTIVITY",
    webhook_url: "https://<your-public-host>/alchemy-webhook",
    addresses: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"],
  }),
});
const body = (await res.json()) as { data?: { id: string; signing_key?: string } };
console.log(res.status, body);

// Later, add/remove addresses without recreating it:
// PATCH https://dashboard.alchemy.com/api/update-webhook-addresses
// { "webhook_id": "wh_...", "addresses_to_add": ["0x..."], "addresses_to_remove": [] }
```

The receiver checks `X-Alchemy-Signature` (HMAC-SHA256 of the **raw** body with the webhook's signing key):

```ts
// webhook-server.ts — receive Alchemy webhooks and check the signature (no framework)
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY; // per-webhook key from the webhook's detail page
if (!signingKey) throw new Error("Set ALCHEMY_WEBHOOK_SIGNING_KEY");

export function isValidSignature(rawBody: string, signature: string, key: string): boolean {
  const digest = createHmac("sha256", key).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

type AddressActivityEvent = {
  webhookId: string; id: string; createdAt: string; type: "ADDRESS_ACTIVITY";
  event: { network: string; activity: { fromAddress: string; toAddress: string; value: number | null; asset: string | null; category: string; hash: string; blockNum: string }[] };
};

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/alchemy-webhook") return res.writeHead(404).end();
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8"); // verify the RAW body, before JSON.parse

  const sig = req.headers["x-alchemy-signature"];
  if (typeof sig !== "string" || !isValidSignature(raw, sig, signingKey)) return res.writeHead(401).end("bad signature");

  const evt = JSON.parse(raw) as AddressActivityEvent;
  for (const a of evt.event.activity) console.log(evt.event.network, a.category, a.asset, a.value, a.fromAddress, "->", a.toAddress, a.hash);
  res.writeHead(200).end("ok"); // reply 200 fast, or Alchemy retries
}).listen(Number(process.env.PORT ?? 8080), () => console.log("listening on", process.env.PORT ?? 8080));
```

**Notes**
- Network enums for create: `WORLDCHAIN_MAINNET`, `WORLDCHAIN_SEPOLIA`, `UNICHAIN_MAINNET`, `UNICHAIN_SEPOLIA`, `ARC_MAINNET`, `ARC_TESTNET` (from the create-webhook API schema).
- Two different secrets. The **Auth Token** (top of the webhooks dashboard) is for managing webhooks through the API. The **signing key** (per webhook, also returned as `signing_key` on create) is for checking deliveries.
- Up to 100,000 addresses per webhook. Free tier: 5 webhooks.
- Non-200 replies are retried with backoff. Free/PAYG retries go on for up to 10 minutes. Make your handler idempotent by keying on `id`.
- For local testing, tunnel your port (the docs use ngrok) and press **Test Webhook** in the dashboard.
- Internal (contract-to-contract) ETH transfers are reported on Arc but not on World Chain or Unichain (see the support note on the Address Activity page).
- The receiver above was tested locally: a correctly signed POST got 200, and a bad or missing signature got 401.

## 7. Gas-sponsored transactions (Wallet APIs)

**Goal:** users send transactions without holding gas. You sponsor it with a Gas Manager policy.

Based on: [Wallet APIs SDK quickstart](https://www.alchemy.com/docs/wallets/quickstart), [Create sponsorship policies](https://www.alchemy.com/docs/wallets/transactions/sponsor-gas/sponsorship-policy-management), [Wallet APIs supported chains](https://www.alchemy.com/docs/wallets/supported-chains).

`npm i @alchemy/wallet-apis@5.3.0 viem@2.57.7`

```ts
// sponsored.ts — gas-sponsored transaction with Alchemy Wallet APIs (v5 SDK)
import { createSmartWalletClient, alchemyWalletTransport } from "@alchemy/wallet-apis";
import { worldchainSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { zeroAddress, type Hex } from "viem";

const client = createSmartWalletClient({
  transport: alchemyWalletTransport({ apiKey: process.env.ALCHEMY_API_KEY! }),
  chain: worldchainSepolia,
  signer: privateKeyToAccount(process.env.PRIVATE_KEY as Hex), // throwaway testnet key only
  paymaster: { policyId: process.env.ALCHEMY_POLICY_ID! }, // dashboard -> Gas Sponsorship -> policy ID
});

// Defaults to EIP-7702: your EOA is delegated to a smart wallet on the first call.
const { id } = await client.sendCalls({
  calls: [{ to: zeroAddress, value: 0n }], // put your contract calls here; several calls = one batch
});
const status = await client.waitForCallsStatus({ id });
console.log(id, status.status);
```

**Notes**
- Use `@alchemy/wallet-apis` (v5). Account Kit (`@account-kit/*`) is deprecated ([source](https://www.alchemy.com/docs/wallets/account-kit-deprecated)). For social login or email login, pair Wallet APIs with a signer such as Privy ([docs](https://www.alchemy.com/docs/wallets/third-party/signers/privy)).
- Get a policy ID: dashboard → [Gas Sponsorship](https://dashboard.alchemy.com/apps/latest/gas-sponsorship) → create a policy → pick chains (they must be enabled on the app) → copy the **Policy ID**. It must be a UUID.
- **Alchemy says every team must pass a short review before it can sponsor gas: email support@alchemy.com.** Sponsoring on mainnet needs a PAYG or Enterprise plan. Gas sponsorship is free on testnets. Ask early in the hackathon.
- World Chain, Unichain and Arc (mainnet and testnet) all show Bundler, Gas Sponsorship, ERC-20 gas payments and BSO support in the supported-chains table.
- On **Arc**, sending value to `address(0)` reverts ([Arc EVM differences](https://docs.arc.io/arc/references/evm-differences.md)). Do not copy the zero-address test call there; call a real contract instead.
- Without a policy, drop the `paymaster` option and the wallet pays its own gas.
- If you would rather not use the SDK, the raw JSON-RPC flow is `wallet_prepareCalls` → sign → `wallet_sendPreparedCalls` → `wallet_getCallsStatus` ([docs](https://www.alchemy.com/docs/wallets/transactions/using-api)).
- Tested: type-check passed. Run with an invalid key: the SDK built a `wallet_prepareCalls` request for chain `0x12c1` (4801) and Alchemy answered `Must be authenticated!`. Nothing was sent on-chain.
