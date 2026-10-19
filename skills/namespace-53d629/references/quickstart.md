# Namespace quickstart (offchain subnames, full setup)

Goal: from nothing to `alice.yourname.eth` that resolves in any ENS app, with no gas per name.
Based on: https://docs.namespace.ninja/developer-guide/guide/create-offchain-subnames, https://docs.namespace.ninja/user-guide/dev-portal, https://docs.namespace.ninja/developer-guide/sdks/offchain-manager/installation

## 0. Pick a model

| Model | Cost per name | Who owns it | Package |
| - | - | - | - |
| Offchain | free, no transaction | the parent-name operator (you) manages records | `@thenamespace/offchain-manager` |
| L2 (Base, Optimism) | L2 gas + mint price | the user, as an NFT | `@thenamespace/mint-manager` + viem |
| L1 (Ethereum) | L1 gas + mint price | the user | `@thenamespace/mint-manager` + viem |

Source: https://docs.namespace.ninja/getting-started. For a 36-hour hackathon, offchain is the fastest path. The onchain path is [recipe 4](recipes.md#4-mint-an-onchain-l1-or-l2-subname-with-viem).

## 1. Own a parent ENS name

You need an ENS name whose owner wallet you control.
- Testing: register a cheap name on Sepolia at https://sepolia.app.ens.domains (Sepolia ETH from any faucet).
- Production: a mainnet `.eth` name (or a DNS name imported into ENS).

The SDK `mode` must match where that name lives: `'sepolia'` (Namespace staging API, `https://staging.offchain-manager.namespace.ninja`) or `'mainnet'` (`https://offchain-manager.namespace.ninja`). Source: the SDK's `dist/offchain-client/index.js` and https://docs.namespace.ninja/openapi/offchain-openapi.json.

## 2. Point the name at the Namespace resolver (one transaction)

From https://docs.namespace.ninja/user-guide/dev-portal#configure-the-resolver:
1. Open https://app.namespace.ninja/offchain and connect the wallet that owns the name.
2. In **Offchain**, select the name and open **Resolution**.
3. Click **Update resolver** and confirm in your wallet (skip if it already says **Updated**).
4. Click **Configure** and finish the wallet prompts. The status must read **Configured**.

Without this step the API still stores your subnames, but no wallet can resolve them.

## 3. Create an API key

From https://docs.namespace.ninja/user-guide/dev-portal#create-an-api-key:
1. Same app, select the parent name, open **API Keys** (direct link: https://app.namespace.ninja/offchain?activeTab=apiKeys), click **Create new key**.
2. Enter a key name and an expiry date. Pick a scope:
   - **Address based**: every ENS name the connected wallet owns. Use it as `defaultApiKey`.
   - **Domain based**: only the selected parent name. Use it in `domainApiKeys: { 'yourname.eth': key }`.
3. Click **Create** and copy the key. It disappears from the browser after about 24 hours; the key stays valid until expiry or revocation.

Limit: 2,000 subnames per parent name (ask in the Builders Telegram for more). Reads (availability, lookups, search) need no key; writes do.

## 4. Project setup

```sh
mkdir my-names && cd my-names
npm init -y && npm pkg set type=module
npm i @thenamespace/offchain-manager@1.0.13 dotenv@17.4.2
npm i -D tsx@4.23.15 typescript@7.0.2 @types/node@22
```

`.env` (add it to `.gitignore`):
```sh
NAMESPACE_API_KEY=<YOUR_NAMESPACE_API_KEY>
PARENT_NAME=<yourname.eth>
```

`tsconfig.json`:
```json
{ "compilerOptions": { "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext", "strict": true, "skipLibCheck": true, "noEmit": true, "types": ["node"] }, "include": ["src"] }
```

## 5. Client (server only)

`src/namespace.ts`:
```ts
import 'dotenv/config';
import { createOffchainClient } from '@thenamespace/offchain-manager';

const apiKey = process.env.NAMESPACE_API_KEY;
if (!apiKey) throw new Error('Missing NAMESPACE_API_KEY');

export const client = createOffchainClient({
  mode: 'sepolia',
  timeout: 10_000,
  defaultApiKey: apiKey, // or: domainApiKeys: { 'yourname.eth': apiKey }
});
```

## 6. Create a subname with records

`src/quickstart.ts`:
```ts
import { ChainName } from '@thenamespace/offchain-manager';
import { client } from './namespace.js';

const PARENT_NAME = process.env.PARENT_NAME;
if (!PARENT_NAME) throw new Error('Missing PARENT_NAME');

const label = process.argv[2] ?? 'alice';
const owner = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // the user's wallet
const fullName = `${label}.${PARENT_NAME}`;

const { isAvailable } = await client.isSubnameAvailable(fullName);
if (!isAvailable) throw new Error(`${fullName} is taken`);

await client.createSubname({
  label,
  parentName: PARENT_NAME,
  owner, // lets you look names up by owner later
  addresses: [{ chain: ChainName.Ethereum, value: owner }],
  texts: [
    { key: 'avatar', value: 'https://example.com/alice.png' },
    { key: 'description', value: 'Built at ETHGlobal Mumbai' },
  ],
});

console.log(await client.getSingleSubname(fullName));
```

Run:
```sh
npx tsx src/quickstart.ts alice
npx tsc --noEmit   # type-check
```

## 7. Check it resolves

- ENS app: `https://sepolia.app.ens.domains/alice.<yourname>.eth` (or app.ens.domains on mainnet).
- viem: [recipe 6](recipes.md#6-resolve-any-name-with-viem) with a Sepolia client.
- Resolvio (mainnet names): `https://api.resolvio.xyz/ens/v2/profile/alice.yourname.eth`.

If it does not resolve: confirm step 2 shows **Configured**, that `mode` matches the network, and that the reading app supports CCIP Read. More in [errors.md](errors.md).

## Notes

- Offchain subnames have **no reverse resolution**: you cannot get the name from an address through ENS. Store `owner` and query by owner ([recipe 3](recipes.md#3-find-names-by-owner-or-metadata)). Source: https://docs.namespace.ninja/developer-guide/guide/create-offchain-subnames#ens-client-compatibility
- Labels follow ENSIP-15 normalization (lowercase, emoji allowed). Pass only the label in `label`, the parent in `parentName`.
- REST instead of the SDK: `POST /api/v1/subnames` with header `x-auth-token: <YOUR_NAMESPACE_API_KEY>`. See https://docs.namespace.ninja/api-reference/introduction.
