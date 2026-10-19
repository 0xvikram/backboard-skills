# Alchemy quickstart (full)

Tested 2026-10-19 with Node 24, viem@2.57.7, ethers@6.17.0.

## 1. Account and API key

From the official guide ([Create an Alchemy API key](https://www.alchemy.com/docs/create-an-api-key)):

1. Sign up at https://dashboard.alchemy.com/signup. A new account already has a **default app and API key**. Use it unless you want a separate app.
2. To make a new app: sign in → open **Team Overview** from the team menu → **Apps** tab → **Create new app**.
3. Give it a name, pick the **chains** the app should support (for example World Chain, Unichain, Arc, mainnet and testnet), choose the services, then **Create App**.
4. On the app details page, copy the **API key** at the top right.
5. The **Endpoints** tab shows the HTTP and WebSocket URLs for every chain enabled on the app.

The key works only on chains enabled for that app. If a chain fails while another works, check this first.

## 2. RPC URLs

Pattern: `https://<network>.g.alchemy.com/v2/<YOUR_API_KEY>` ([source](https://www.alchemy.com/docs/reference/node-supported-chains)).

| Chain | Network slug | viem chain (`viem/chains`) | Chain ID |
|---|---|---|---|
| World Chain Mainnet | `worldchain-mainnet` | `worldchain` | 480 |
| World Chain Sepolia | `worldchain-sepolia` | `worldchainSepolia` | 4801 |
| Unichain Mainnet | `unichain-mainnet` | `unichain` | 130 |
| Unichain Sepolia | `unichain-sepolia` | `unichainSepolia` | 1301 |
| Arc Mainnet | `arc-mainnet` | `arc` | 5042 |
| Arc Testnet | `arc-testnet` | `arcTestnet` | 5042002 |

Chain IDs were read from viem@2.57.7 and confirmed live with `eth_chainId` on each chain's public RPC on 2026-10-19. Other chains: replace the slug, for example `eth-mainnet` or `base-sepolia`. Full list: https://www.alchemy.com/docs/reference/node-supported-chains

Keep the key on the server. Do not put it in frontend code. If you must call from a browser, set an origin allowlist on the app or proxy through your own API route. Alchemy's guide for that: https://www.alchemy.com/docs/add-alchemy-rpc-to-any-project

## 3. Project setup

```bash
mkdir alchemy-demo && cd alchemy-demo
npm init -y
npm pkg set type=module
npm i viem@2.57.7
npm i -D tsx
```

`.env` (add `.env` to `.gitignore`):

```
ALCHEMY_API_KEY=<YOUR_API_KEY>
```

## 4. Complete runnable example (viem)

Based on the [World Chain quickstart](https://www.alchemy.com/docs/reference/world-chain-api-quickstart) and [Set up Alchemy with viem](https://www.alchemy.com/docs/set-up-alchemy-with-viem).

`index.ts`:

```ts
import { createPublicClient, http, formatEther } from "viem";
import { worldchain } from "viem/chains";

const key = process.env.ALCHEMY_API_KEY;
if (!key) throw new Error("Set ALCHEMY_API_KEY");

const client = createPublicClient({
  chain: worldchain,
  transport: http(`https://worldchain-mainnet.g.alchemy.com/v2/${key}`),
});

const block = await client.getBlockNumber();
const balance = await client.getBalance({
  address: "0x4200000000000000000000000000000000000006", // WETH predeploy on OP Stack chains
});
console.log("World Chain block:", block);
console.log("Balance (ETH):", formatEther(balance));
```

Run:

```bash
npx tsx --env-file=.env index.ts
```

Expected output: a block number and a balance. With a wrong key, viem throws `InvalidRequestRpcError ... Details: Must be authenticated!`.

Unichain or Arc: swap the import and the slug, for example `import { unichain } from "viem/chains"` with `https://unichain-mainnet.g.alchemy.com/v2/${key}` ([Unichain quickstart](https://www.alchemy.com/docs/reference/unichain-api-quickstart), [Arc quickstart](https://www.alchemy.com/docs/reference/arc-api-quickstart)).

Arc uses USDC as its gas token, not ETH. Read Arc's own notes before you send value or estimate gas: https://docs.arc.io/arc/references/evm-differences.md

## 5. Same thing with ethers v6

`npm i ethers@6.17.0`

```ts
import { JsonRpcProvider, Network, formatEther } from "ethers";

const provider = new JsonRpcProvider(
  `https://worldchain-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  Network.from(480),
  { staticNetwork: true },
);
console.log(await provider.getBlockNumber());
console.log(formatEther(await provider.getBalance("0x4200000000000000000000000000000000000006")));
```

Do not use `new AlchemyProvider(...)` for World Chain, Unichain or Arc. ethers 6.17.0 has no preset for them, so it throws `unsupported network`.

## 6. Writing (sending a transaction)

Sending works the same as on any RPC. Use a viem `createWalletClient` with the same Alchemy URL as transport. Use a throwaway testnet key and testnet funds only. For gasless or batched transactions, see [recipe 7](recipes.md#7-gas-sponsored-transactions-wallet-apis).

## Next

- Recipes: [recipes.md](recipes.md)
- If something fails: [errors.md](errors.md)
