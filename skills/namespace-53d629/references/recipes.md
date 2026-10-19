# Namespace recipes

All code type-checked on 2026-10-19 with the versions in SKILL.md. Offchain writes need a real API key, so they were type-checked only. Reads, `checkName`, the Indexer, viem and Resolvio calls were run live. See the test notes in each recipe.

---

## 1. Give every user a subname at signup

**Goal:** a user types a username in your app and gets `username.yourapp.eth` right away, for free. The API key stays on your server.

Next.js App Router, `app/api/subname/route.ts`:
```ts
import { createOffchainClient, ChainName } from '@thenamespace/offchain-manager';

const PARENT = 'yourapp.eth';
const client = createOffchainClient({
  mode: 'sepolia',
  defaultApiKey: process.env.NAMESPACE_API_KEY, // server env var, never NEXT_PUBLIC_
});

export async function POST(req: Request) {
  const { label, owner } = (await req.json()) as { label: string; owner: `0x${string}` };
  // TODO: check the caller is signed in and controls `owner` (SIWE, Privy, Dynamic...)
  if (!/^[a-z0-9-]{3,32}$/.test(label)) return new Response('bad label', { status: 400 });

  const fullName = `${label}.${PARENT}`;
  const { isAvailable } = await client.isSubnameAvailable(fullName);
  if (!isAvailable) return new Response('name taken', { status: 409 });

  await client.createSubname({
    label,
    parentName: PARENT,
    owner,
    addresses: [{ chain: ChainName.Ethereum, value: owner }],
    texts: [{ key: 'description', value: `Member of ${PARENT}` }],
  });
  return Response.json({ name: fullName });
}
```

**Notes**
- `createSubname` is "create **or update**" (one POST endpoint). It does not refuse an existing name, so always check availability first, or one user can overwrite another user's name.
- Validate labels yourself. The SDK normalizes per ENSIP-15, but your rules (length, no profanity) are yours.
- Source: https://docs.namespace.ninja/developer-guide/guide/create-offchain-subnames, https://docs.namespace.ninja/developer-guide/sdks/offchain-manager/is-subname-available

---

## 2. Set or change records

**Goal:** set addresses, avatar and text records on an existing offchain subname.

```ts
import { ChainName } from '@thenamespace/offchain-manager';
import { client } from './namespace.js'; // the server client from quickstart.md

const name = 'alice.yourname.eth';
const wallet = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

// One record at a time: the SDK reads the subname, merges, and writes it back.
await client.addTextRecord(name, 'com.twitter', 'alice');
await client.addTextRecord(name, 'avatar', 'https://example.com/alice.png');
await client.addAddressRecord(name, ChainName.Base, wallet);
await client.setDefaultEvmAddress(name, wallet); // same address on every EVM chain
await client.addDataRecord(name, 'tier', 'pro'); // metadata: not resolvable, used for filtering
await client.deleteTextRecord(name, 'com.twitter');

console.log(await client.getTextRecords(name));
console.log((await client.getTextRecord(name, 'avatar')).record);
console.log(await client.getDataRecords(name));
```

**Notes**
- Prefer the `add*` / `delete*` helpers. `updateSubname(name, { texts })` **replaces** the whole record set with what you pass: addresses you leave out are cleared, and it does not send `owner`. See [errors.md #4](errors.md#4-updatesubname-wipes-records-you-did-not-pass).
- Common text keys: `avatar`, `description`, `url`, `com.twitter`, `com.github`, `email`. Keys are case-sensitive.
- `ChainName` has `Ethereum`, `Base`, `Optimism`, `Arbitrum`, `WorldChain`, `Unichain`, `Solana`, `Bitcoin` and more: https://docs.namespace.ninja/developer-guide/sdks/offchain-manager/chainname
- Sources: https://docs.namespace.ninja/developer-guide/sdks/offchain-manager/text-records, https://docs.namespace.ninja/developer-guide/sdks/offchain-manager/address-records, https://docs.namespace.ninja/developer-guide/sdks/offchain-manager/set-default-evm-address, https://docs.namespace.ninja/developer-guide/sdks/offchain-manager/data-records

### 2b. Upload an avatar image (instead of hosting it yourself)

```ts
import { readFile } from 'node:fs/promises';
import { createAvatarClient } from '@thenamespace/avatar';
import { createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as Hex);
const walletClient = createWalletClient({ account, chain: sepolia, transport: http() });

const avatar = createAvatarClient({ domain: 'myapp.com', network: 'sepolia', provider: walletClient });
const result = await avatar.uploadAvatar({
  subname: 'alice.yourname.eth',
  file: await readFile('./alice.png'),
  onProgress: (p) => console.log(`upload ${p}%`),
});
console.log(result.url);
```

- `npm i @thenamespace/avatar@2.0.2 viem@2.57.7`. The wallet signs a SIWE message, so it must be the name's owner (check the docs for who may upload). In a browser, pass the wagmi/viem wallet client instead of a private key.
- Limits: avatar 2 MB, header 5 MB; JPEG, PNG, GIF, WebP. The provider's chain must match `network` (1 or 11155111) or it throws `PROVIDER_CHAIN_MISMATCH`.
- Not run live (needs a signing wallet). Source: https://docs.namespace.ninja/developer-guide/sdks/avatar/upload-images

---

## 3. Find names by owner or metadata

**Goal:** show "you are alice.yourapp.eth" for a connected wallet. Offchain names have no ENS reverse record, so query Namespace.

```ts
import { createOffchainClient } from '@thenamespace/offchain-manager';

const reader = createOffchainClient({ mode: 'sepolia' }); // reads need no API key

const page = await reader.getFilteredSubnames({
  parentName: 'yourname.eth',
  owner: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  page: 1,
  size: 10,
});
console.log(page.totalItems, page.items.map((s) => s.fullName));

// filter by your own metadata (set with addDataRecord / createSubname({ metadata }))
const pros = await reader.getFilteredSubnames({ parentName: 'yourname.eth', metadata: { tier: 'pro' } });

// one name, all records
try {
  const sub = await reader.getSingleSubname('alice.yourname.eth');
  console.log(sub?.texts, sub?.addresses); // addresses are keyed by coin type, e.g. "60"
} catch {
  console.log('not found'); // 1.0.13 throws on 404, it does not return null
}
```

**Notes**
- Tested live (read-only) against `artii.eth` on mainnet: `isSubnameAvailable`, `getSingleSubname`, `getFilteredSubnames` all worked with no key; a missing name threw a 404 error.
- Store the `owner` field when creating names, or this lookup returns nothing.
- Source: https://docs.namespace.ninja/developer-guide/sdks/offchain-manager/get-filtered-subnames, https://docs.namespace.ninja/developer-guide/sdks/offchain-manager/get-single-subname

---

## 4. Mint an onchain L1 or L2 subname with viem

**Goal:** a user mints `alice.yourname.eth` as an NFT on Base / Optimism (L2) or Ethereum (L1). First activate the parent at https://app.namespace.ninja/onchain (**Activate Name**, choose L1 or L2 + network, set price and rules). Source: https://docs.namespace.ninja/user-guide/app

```sh
npm i @thenamespace/mint-manager@2.0.0 viem@2.57.7 dotenv@17.4.2
```

`src/mint-clients.ts`:
```ts
import 'dotenv/config';
import { createMintClient } from '@thenamespace/mint-manager';
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
const privateKey = process.env.WALLET_PRIVATE_KEY as Hex | undefined;
if (!rpcUrl) throw new Error('Missing BASE_SEPOLIA_RPC_URL');
if (!privateKey) throw new Error('Missing WALLET_PRIVATE_KEY');

export const account = privateKeyToAccount(privateKey);

// isTestnet: true = Sepolia / Base Sepolia listings + Namespace staging API
export const mintClient = createMintClient({
  isTestnet: true,
  mintSource: 'my-hackathon-app',
  customRpcUrls: { [baseSepolia.id]: rpcUrl },
});

export const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
export const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(rpcUrl) });
```

`src/mint.ts`:
```ts
import { parseEther } from 'viem';
import { ChainName, MintManagerError } from '@thenamespace/mint-manager';
import { account, mintClient, publicClient, walletClient } from './mint-clients.js';

const fullName = process.argv[2] ?? 'alice.yourname.eth';

try {
  // rpc: 'always' also asks the registry; see errors.md #7
  const check = await mintClient.checkName(fullName, { minterAddress: account.address, expiryInYears: 1, rpc: 'always' });
  if (check.status !== 'available') {
    throw new Error(`${check.name} is ${check.status}: ${check.reasons.join(', ')}`);
  }
  if (check.chainId !== publicClient.chain.id) {
    throw new Error(`Listing is on chain ${check.chainId}; point your viem clients at it`);
  }

  const tx = await mintClient.prepareMint(check, {
    minterAddress: account.address,
    owner: account.address,
    expiryInYears: 1,
    maxValue: parseEther((check.estimatedPriceEth + check.estimatedFeeEth).toFixed(18)),
    records: {
      texts: [{ key: 'avatar', value: 'https://example.com/alice.png' }],
      addresses: [{ chain: ChainName.Base, value: account.address }],
    },
  });

  const { request } = await publicClient.simulateContract({
    account,
    address: tx.contractAddress,
    abi: tx.abi,
    functionName: tx.functionName,
    args: tx.args,
    value: tx.value,
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('minted', check.name, receipt.status, hash);
} catch (error) {
  if (error instanceof MintManagerError) {
    console.error(error.code, error.message, error.details);
  } else {
    throw error;
  }
}
```

**Notes**
- The SDK never holds keys or sends transactions; it returns `contractAddress`, `abi`, `functionName`, `args`, `value` (already wei). In a React app, pass the same fields to wagmi `useSimulateContract` / `useWriteContract`.
- The chain comes from the listing (`check.chainId`). Supported: Ethereum 1, Sepolia 11155111, Base 8453, Base Sepolia 84532, Optimism 10 (https://docs.namespace.ninja/developer-guide/sdks/mint-manager/installation#supported-networks).
- `maxValue` caps price + fee; if the price moves you get `PRICE_EXCEEDS_MAX` and nothing is sent. Signed params expire quickly (`SIGNATURE_EXPIRED`): prepare right before sending.
- Mint-time `records.addresses` uses the Mint Manager `ChainName`, which is shorter than the offchain one (no `WorldChain` / `Unichain` in 2.0.0).
- Tested: type-check, plus live read-only `checkName` on the mainnet `oppunk.eth` Optimism listing. No mint was sent.
- Sources: https://docs.namespace.ninja/developer-guide/guide/mint-l1-l2-subnames, https://docs.namespace.ninja/developer-guide/sdks/mint-manager/check-name, https://docs.namespace.ninja/developer-guide/sdks/mint-manager/get-mint-transaction-parameters

---

## 5. Read minted L2 subnames (Indexer)

**Goal:** list a user's L2 subnames, or every subname under your parent, without scanning logs.

```ts
import { createIndexerClient } from '@thenamespace/indexer';

const indexer = createIndexerClient();

const one = await indexer.getL2Subname({ chainId: 10, nameOrNamehash: 'lucas.oppunk.eth' });
console.log(one.name, one.owner, one.records.texts, one.records.addresses);

const registry = await indexer.getL2Registry({ chainId: 10, nameOrNamehash: 'oppunk.eth' });
console.log(registry.tokenName, registry.tokenAddress);

const list = await indexer.getL2Subnames({ parent: 'oppunk.eth', chainId: 10, page: 1, size: 5 });
console.log(list.total, list.items.map((s) => s.name));
// by owner: indexer.getL2Subnames({ owner: '0x...', chainId: 8453, page: 1, size: 10 })
```

**Notes**
- `npm i @thenamespace/indexer@1.0.2`. Chains: Optimism 10, Base 8453, Base Sepolia 84532.
- Records are under `records.texts` / `records.addresses` (the docs page shows them top-level; the SDK types and live API put them under `records`). Pages start at 1 (`page: 0` returns page 1).
- Tested live on Optimism (`oppunk.eth`, 214 subnames).
- Source: https://docs.namespace.ninja/developer-guide/sdks/indexer-manager/fetch-l2-subnames

---

## 6. Resolve any name with viem

**Goal:** turn `alice.yourname.eth` into an address, avatar or text. Works for normal ENS names, Namespace L2 subnames and offchain subnames, because viem follows CCIP Read through the ENS Universal Resolver.

```ts
import { createPublicClient, http } from 'viem';
import { mainnet, base } from 'viem/chains';
import { normalize, toCoinType } from 'viem/ens';

const ens = createPublicClient({ chain: mainnet, transport: http(process.env.MAINNET_RPC_URL) });

const name = normalize(process.argv[2] ?? 'nick.eth');
const address = await ens.getEnsAddress({ name });
const baseAddress = await ens.getEnsAddress({ name, coinType: toCoinType(base.id) });
const avatar = await ens.getEnsAvatar({ name });
const url = await ens.getEnsText({ name, key: 'url' });
const primary = address ? await ens.getEnsName({ address }) : null;

console.log({ name, address, baseAddress, avatar, url, primary });
```

**Notes**
- Use a `sepolia` client for names on Sepolia ENS. ENS lookups always go through the L1 (mainnet or Sepolia) client, even for L2 subnames.
- Tested live on mainnet: `nick.eth`, and the Namespace L2 subname `lucas.oppunk.eth` (address and avatar came back through the L2 resolver).
- `getEnsName` (reverse) does not work for offchain subnames; use recipe 3.
- Source: https://viem.sh/docs/ens/actions/getEnsAddress, https://docs.namespace.ninja/developer-guide/guide/create-offchain-subnames#ens-client-compatibility

---

## 7. Resolve profiles over HTTP with Resolvio

**Goal:** one request for a full profile (texts, addresses, contenthash), no RPC and no API key. Handy for leaderboards and server code.

```ts
type Profile = {
  name: string;
  texts: { key: string; value?: string; exists: boolean }[];
  addresses: { coin: number; chain?: string; value?: string; exists: boolean }[];
  contenthash: { value?: string; exists: boolean };
  resolver?: string;
};

const name = process.argv[2] ?? 'nick.eth';
const url = `https://api.resolvio.xyz/ens/v2/profile/${encodeURIComponent(name)}?texts=avatar,url,com.twitter&addresses=eth,base`;
const res = await fetch(url);
if (!res.ok) throw new Error(`Resolvio ${res.status}: ${await res.text()}`);
const profile = (await res.json()) as Profile;

const text = (k: string) => profile.texts.find((t) => t.key === k && t.exists)?.value;
const addr = (c: string) => profile.addresses.find((a) => a.chain === c && a.exists)?.value;
console.log({ name: profile.name, avatar: text('avatar'), url: text('url'), eth: addr('eth'), base: addr('base') });
```

**Notes**
- Reverse: `GET https://api.resolvio.xyz/ens/v2/reverse/<address>` returns `{ name, hasReverseRecord }`. Chain names: `GET /ens/v2/chains`. Other endpoints (bulk, texts, contenthash, cache clear): https://docs.namespace.ninja/api-reference/introduction
- `addresses=` takes chain names (`eth`, `base`, `op`, `hbar`...) or numeric coin types. World Chain and Unichain have no short name in Resolvio; pass `2147484128` (World Chain) or `2147483778` (Unichain), which equal viem `toCoinType(480)` / `toCoinType(130)`.
- Mainnet ENS only (the server is `https://api.resolvio.xyz`). Tested live: `nick.eth`, `lucas.oppunk.eth`, reverse lookup.
- Source: https://docs.namespace.ninja/api-reference/resolvio/get-ens-profile, https://docs.namespace.ninja/user-guide/resolvio

---

## 8. Drop-in React UI: ENS Components

**Goal:** a ready "claim your name" form (offchain) or "mint a subname" form (onchain) in a React / Next.js app.

```sh
npm i @thenamespace/ens-components@2.2.0 @thenamespace/offchain-manager@1.0.13 wagmi@2.19.5 viem@2.57.7 @tanstack/react-query@5.104.4
```

Providers (wagmi **2**, see [errors.md #9](errors.md#9-ens-components-wants-wagmi-2)):
```tsx
'use client';
import '@thenamespace/ens-components/styles.css';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const config = createConfig({
  chains: [sepolia, mainnet],
  connectors: [injected()],
  transports: { [sepolia.id]: http(), [mainnet.id]: http() },
});
const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
```

Forms:
```tsx
'use client';
import { OffchainSubnameForm, SubnameMintForm } from '@thenamespace/ens-components';
import { createOffchainClient } from '@thenamespace/offchain-manager';
import { useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

// No API key in the browser: this client only does the form's reads (availability, lookup).
const readOnlyClient = createOffchainClient({ mode: 'sepolia' });

export function ClaimOffchain() {
  return (
    <OffchainSubnameForm
      name="yourname.eth"
      isTestnet
      offchainManager={readOnlyClient}
      avatarUploadDomain="myapp.com"
      onSubnameCreated={async (data) => {
        // The form does not write. Send the data to your server, which holds the API key.
        const res = await fetch('/api/subname', { method: 'POST', body: JSON.stringify(data) });
        if (!res.ok) throw new Error(await res.text()); // the form shows this message
      }}
    />
  );
}

export function MintOnchain() {
  const { connect } = useConnect();
  return (
    <SubnameMintForm
      parentName="yourname.eth"
      isTestnet
      onConnectWallet={() => connect({ connector: injected() })}
      onSubnameMinted={(d) => console.log('minted', d.fullSubname, d.txHash, d.chainId)}
    />
  );
}
```

**Notes**
- `OffchainSubnameForm` only collects the label and records and calls `onSubnameCreated(data)` / `onSubnameUpdated(data)`; you do the write. The official README writes from the browser with an API key in `createOffchainClient({ domainApiKeys })`: that leaks your key, so post to a server route like [recipe 1](#1-give-every-user-a-subname-at-signup) (`data` has `label`, `parentName`, `fullSubname`, `addresses`, `texts`, `owner`).
- Other components: `EnsNameRegistrationForm` (register a `.eth`), `EnsRecordsForm` (edit records on a name the wallet owns), `SelectRecordsForm` (record editor, no wallet).
- Theme with CSS variables such as `--ns-color-primary`. Both `@thenamespace/ens-components/styles.css` (README) and `.../styles` (docs) are exported.
- Tested: type-check only (no browser run).
- Sources: https://docs.namespace.ninja/developer-guide/sdks/ens-components, https://github.com/thenamespace/ens-components, https://enscomponents.com/Skill.md
