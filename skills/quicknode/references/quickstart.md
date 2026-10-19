# QuickNode quickstart (full)

Tested 2026-10-19 with viem@2.57.7, ethers@6.17.0, Node 24. Sources are linked at each step.

## 1. Account and endpoint

1. Sign up: https://www.quicknode.com/signup. The free tier is listed as **Free trial, $0/mo, "includes 1 month free"**: 10M API credits, 15 requests/second, 1 endpoint ([pricing](https://www.quicknode.com/pricing.md)). Sign up close to the hackathon so the month covers it.
2. Dashboard → **Endpoints** (https://dashboard.quicknode.com/endpoints) → **Create Endpoint** (top right) → choose the chain (World Chain, Unichain, Hedera, Arc or 0G) → **Continue** → choose the network ([World Chain quickstart](https://www.quicknode.com/docs/worldchain/quickstart), [Hedera quickstart](https://www.quicknode.com/docs/hedera/quickstart)).
3. On the endpoint page copy the **HTTP Provider** and **WSS Provider** URLs:
   ```
   https://<name>.<network>.quiknode.pro/<token>/
   wss://<name>.<network>.quiknode.pro/<token>/
   ```
   `<network>` is for example `worldchain-sepolia` or `unichain-mainnet`. Ethereum mainnet has no network part. **Always copy the exact URL from the dashboard** ([URL structure](https://www.quicknode.com/guides/quicknode-products/how-to-use-multichain-endpoint)).
4. Free plan = 1 endpoint. Toggle **Multichain** on that endpoint, then pick any other network in the list to get its URL. Name and token stay the same, only the subdomain changes ([guide](https://www.quicknode.com/guides/quicknode-products/how-to-use-multichain-endpoint)).
5. Security: the token in the URL is the credential. You can send it as an `x-token` header instead, add more tokens, or disable token auth. JWT, referrer allowlists and domain masking need the Build plan ([World Chain endpoint security](https://www.quicknode.com/docs/worldchain/endpoint-security)). Keep the URL on your server. If you must call from the browser, put a referrer rule on it, or proxy the calls through your backend.

## 2. API key (only for Streams/Webhooks REST, the SDK or MCP with an API key)

Dashboard → avatar → **API Keys** (https://dashboard.quicknode.com/api-keys). Send it as the `x-api-key` header ([Webhooks REST](https://www.quicknode.com/docs/webhooks/rest-api/getting-started)). The pricing table lists the **Admin API** as Build plan and up. If a REST call is refused on the free plan, create the Stream or Webhook in the dashboard instead. The dashboard flow is what the docs' quickstarts use.

## 3. Project

```bash
mkdir qn-demo && cd qn-demo
npm init -y
npm pkg set type=module
npm i viem@2.57.7 ethers@6.17.0
npm i -D tsx typescript @types/node
```

`.env`:
```
QUICKNODE_RPC_URL=https://<name>.worldchain-sepolia.quiknode.pro/<token>/
QUICKNODE_WSS_URL=wss://<name>.unichain-mainnet.quiknode.pro/<token>/
```

## 4. Complete example (viem)

`index.ts`:
```ts
import { createPublicClient, http, formatEther } from "viem";
import { worldchainSepolia } from "viem/chains";

// Paste the HTTP Provider URL from your QuickNode endpoint page, e.g.
// https://<name>.worldchain-sepolia.quiknode.pro/<token>/
const url = process.env.QUICKNODE_RPC_URL;
if (!url) throw new Error("Set QUICKNODE_RPC_URL");

const client = createPublicClient({ chain: worldchainSepolia, transport: http(url) });

const [chainId, block, balance] = await Promise.all([
  client.getChainId(),
  client.getBlockNumber(),
  client.getBalance({ address: "0x4200000000000000000000000000000000000006" }),
]);
console.log({ chainId, block, wethBalance: formatEther(balance) });
```

Run: `npx tsx --env-file=.env index.ts`

Expected output (shape): `{ chainId: 4801, block: 35937621n, wethBalance: '2.39...' }`

## 5. Same thing with ethers v6

```ts
import { JsonRpcProvider, formatEther, Network } from "ethers";

const url = process.env.QUICKNODE_RPC_URL;
if (!url) throw new Error("Set QUICKNODE_RPC_URL");

// staticNetwork skips the extra eth_chainId call ethers makes before every request batch
const provider = new JsonRpcProvider(url, undefined, {
  staticNetwork: Network.from(Number(process.env.CHAIN_ID ?? 4801)),
});

const block = await provider.getBlockNumber();
const bal = await provider.getBalance("0x4200000000000000000000000000000000000006");
console.log({ block, balance: formatEther(bal) });
provider.destroy();
```
`staticNetwork` is an ethers v6 provider option ([ethers docs](https://docs.ethers.org/v6/api/providers/jsonrpc/#JsonRpcApiProviderOptions)). It saves credits and requests/second on a 15 rps plan.

## 6. Sending transactions

QuickNode does not hold keys: `eth_accounts` returns `[]` and `eth_signTransaction` is not supported. Sign locally (viem `privateKeyToAccount` + `createWalletClient`) and the client sends `eth_sendRawTransaction`, which costs 20 API credits on the Core API ([World Chain methods](https://www.quicknode.com/docs/worldchain/llms.txt), [viem send-tx guide](https://www.quicknode.com/guides/ethereum-development/transactions/how-to-send-a-transaction-using-viem)).

## 7. Testnet funds

- QuickNode faucet: https://faucet.quicknode.com/drip. Of the sponsor chains it lists **Unichain Sepolia** only: https://faucet.quicknode.com/unichain/sepolia ([faucet docs](https://faucet.quicknode.com/llms-full.txt)).
- How it works: pick the network, paste or connect your address, pass the reCAPTCHA. The Unichain page says the base drip needs no account, no X post and no mainnet balance, with one claim per 12 hours per network. Logging in as a QuickNode customer or sharing on X raises the amount.
- For World Chain Sepolia, Hedera testnet, Arc testnet and 0G Galileo, use each chain's own faucet (see the `sponsor-chains` skill).

## 8. Where to look next

- Docs index: https://www.quicknode.com/docs/llms.txt (append `.md` to any docs URL for Markdown)
- Guides index: https://www.quicknode.com/guides/llms.txt
- API credit costs per method: https://www.quicknode.com/api-credits
- Status: https://status.quicknode.com
