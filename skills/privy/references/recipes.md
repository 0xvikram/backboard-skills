# Privy recipes

All recipes assume the `PrivyProvider` from [quickstart.md](quickstart.md) wraps the app, and every component file starts with `'use client'` in Next.js. Type-checked on 2026-10-19 with @privy-io/react-auth@3.50.0, @privy-io/node@0.36.0, @privy-io/wagmi@4.0.19, wagmi@3.7.7, viem@2.57.5 (and built with next@16.4.2).

---

## 1. Custom email OTP login (whitelabel)

**Goal:** your own email + code form instead of the Privy modal.

Based on: https://docs.privy.io/authentication/user-authentication/login-methods/email, https://docs.privy.io/wallets/wallets/create/create-a-wallet, https://github.com/privy-io/examples/tree/main/privy-react-whitelabel-starter

```tsx
'use client';
import {useState} from 'react';
import {useLoginWithEmail, useCreateWallet, usePrivy} from '@privy-io/react-auth';

export function EmailLogin() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const {ready, authenticated, user} = usePrivy();
  const {createWallet} = useCreateWallet();
  const {sendCode, loginWithCode, state} = useLoginWithEmail();

  if (!ready) return null;

  if (authenticated) {
    const embedded = user?.linkedAccounts.find(
      (a) => a.type === 'wallet' && a.walletClientType === 'privy'
    );
    return embedded && embedded.type === 'wallet' ? (
      <p>Embedded wallet: {embedded.address}</p>
    ) : (
      <button onClick={() => createWallet()}>Create wallet</button>
    );
  }

  return (
    <div>
      <input value={email} onChange={(e) => setEmail(e.currentTarget.value)} placeholder="you@example.com" />
      <button onClick={() => sendCode({email})}>Send code</button>
      <input value={code} onChange={(e) => setCode(e.currentTarget.value)} placeholder="123456" />
      <button onClick={() => loginWithCode({code})}>Log in</button>
      <p>{state.status}</p>
    </div>
  );
}
```

**Notes**
- `createOnLogin` does **not** run for whitelabel logins (`loginWithCode`, `useLoginWithOAuth`). You must call `createWallet()` yourself (https://docs.privy.io/basics/react/advanced/automatic-wallet-creation).
- `state.status` moves through `initial`, `sending-code`, `awaiting-code-input`, `submitting-code`, `done` or `error`.
- SMS works the same way with `useLoginWithSms` and `sendCode({phoneNumber})`.

---

## 2. Google (or other social) login button

**Goal:** one "Log in with Google" button, no modal.

Based on: https://docs.privy.io/authentication/user-authentication/login-methods/oauth

```tsx
'use client';
import {useLoginWithOAuth} from '@privy-io/react-auth';

export function GoogleLogin() {
  const {initOAuth, state} = useLoginWithOAuth({
    onComplete: ({user, isNewUser}) => console.log(user.id, isNewUser),
    onError: (err) => console.error(err)
  });
  return (
    <button disabled={state.status === 'loading'} onClick={() => initOAuth({provider: 'google'})}>
      Log in with Google
    </button>
  );
}
```

**Notes**
- Enable the provider in the Dashboard first. Providers: `google`, `apple`, `twitter`, `github`, `discord`, `linkedin`, `spotify`, `tiktok`, `instagram`, `telegram`, `line`.
- Same as recipe 1: create the embedded wallet yourself after a whitelabel OAuth login.
- Google OAuth may fail inside in-app browsers (webviews), for example when a link is opened from a chat app.
- Easiest option: the Privy modal (`usePrivy().login`) with `loginMethods: ['email', 'google']` in the config. It also runs `createOnLogin`.

---

## 3. Send ETH or an ERC-20 from the embedded wallet

**Goal:** a transfer or contract call, with Privy's confirm modal.

Based on: https://docs.privy.io/wallets/using-wallets/ethereum/send-a-transaction, https://docs.privy.io/recipes/send-usdc

```tsx
'use client';
import {useSendTransaction} from '@privy-io/react-auth';
import {encodeFunctionData, erc20Abi, parseUnits} from 'viem';
import {worldchainSepolia} from 'viem/chains';

export function SendToken({token, to}: {token: `0x${string}`; to: `0x${string}`}) {
  const {sendTransaction} = useSendTransaction();
  return (
    <button
      onClick={async () => {
        const data = encodeFunctionData({abi: erc20Abi, functionName: 'transfer', args: [to, parseUnits('1', 6)]});
        const {hash} = await sendTransaction({to: token, data, chainId: worldchainSepolia.id});
        console.log(hash);
      }}
    >
      Send 1 token
    </button>
  );
}
```

For plain ETH: `sendTransaction({to, value: parseEther('0.001'), chainId})`.

**Notes**
- Second argument options: `{address}` picks which wallet signs (recommended when the user also has an external wallet), `{sponsor: true}` uses Privy gas sponsorship (turn it on in the Dashboard first, https://docs.privy.io/wallets/gas-and-asset-management/gas/overview), `{uiOptions: {showWalletUIs: false}}` hides the confirm modal.
- `chainId` must be in `supportedChains`, or the call throws.
- Use the token's decimals in `parseUnits` (USDC is 6).

---

## 4. Use viem with a Privy wallet

**Goal:** a viem `WalletClient` for code that already uses viem.

Based on: https://docs.privy.io/wallets/connectors/ethereum/integrations/viem

```tsx
'use client';
import {useWallets} from '@privy-io/react-auth';
import {createWalletClient, custom, parseEther} from 'viem';
import {unichainSepolia} from 'viem/chains';

export function SendWithViem() {
  const {ready, wallets} = useWallets();
  return (
    <button
      disabled={!ready}
      onClick={async () => {
        const wallet = wallets.find((w) => w.walletClientType === 'privy');
        if (!wallet) return;
        await wallet.switchChain(unichainSepolia.id);
        const provider = await wallet.getEthereumProvider();
        const client = createWalletClient({
          account: wallet.address as `0x${string}`,
          chain: unichainSepolia,
          transport: custom(provider)
        });
        const hash = await client.sendTransaction({
          to: '0x0000000000000000000000000000000000000000',
          value: parseEther('0.0001')
        });
        console.log(hash);
      }}
    >
      Send with viem
    </button>
  );
}
```

**Notes**
- Call `switchChain` **before** `getEthereumProvider`. An existing provider is not updated after a switch.
- For reads, use a normal `createPublicClient({chain, transport: http()})`.

---

## 5. Use wagmi hooks with Privy

**Goal:** `useAccount`, `useWriteContract` and the other wagmi hooks, with Privy handling login and wallets.

Based on: https://docs.privy.io/wallets/connectors/ethereum/integrations/wagmi

```sh
npm i @privy-io/react-auth@3.50.0 @privy-io/wagmi@4.0.19 wagmi@3.7.7 viem@2.57.5 @tanstack/react-query@5.104.4
```

`app/providers.tsx` (use this instead of the quickstart provider, not as well as it):

```tsx
'use client';
import {PrivyProvider, type PrivyClientConfig} from '@privy-io/react-auth';
import {WagmiProvider, createConfig} from '@privy-io/wagmi'; // NOT from 'wagmi'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {http} from 'wagmi';
import {worldchainSepolia, unichainSepolia} from 'viem/chains';

export const wagmiConfig = createConfig({
  chains: [worldchainSepolia, unichainSepolia],
  transports: {
    [worldchainSepolia.id]: http(),
    [unichainSepolia.id]: http()
  }
});

const privyConfig: PrivyClientConfig = {
  embeddedWallets: {ethereum: {createOnLogin: 'users-without-wallets'}},
  defaultChain: worldchainSepolia,
  supportedChains: [worldchainSepolia, unichainSepolia]
};

const queryClient = new QueryClient();

export default function Providers({children}: {children: React.ReactNode}) {
  return (
    <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
```

Usage (hooks come from `wagmi` as normal):

```tsx
'use client';
import {useAccount, useBalance, useWriteContract} from 'wagmi';
import {parseAbi} from 'viem';

const abi = parseAbi(['function increment()']);

export function Counter({address}: {address: `0x${string}`}) {
  const {address: user, chainId} = useAccount();
  const {data: balance} = useBalance({address: user});
  const {writeContract, data: hash} = useWriteContract();
  return (
    <div>
      <p>{user} on {chainId}: {balance?.value.toString()} wei</p>
      <button onClick={() => writeContract({address, abi, functionName: 'increment'})}>Increment</button>
      <p>{hash}</p>
    </div>
  );
}
```

**Notes**
- Order matters: `PrivyProvider` > `QueryClientProvider` > `WagmiProvider`.
- Log in and connect with Privy (`login`, `connectWallet`). Use wagmi only for reads and writes. wagmi's `useDisconnect` does not really disconnect; use Privy's `logout`.
- Keep wagmi `chains` and Privy `supportedChains` the same.
- Change which wallet wagmi uses with `useSetActiveWallet` from `@privy-io/wagmi`.
- `@privy-io/wagmi@4.0.19` declares an exact `viem` peer of `2.57.5`. Install that viem version to avoid peer warnings and duplicate viem copies.

---

## 6. Verify the user on your server

**Goal:** an API route that knows which Privy user is calling.

Based on: https://docs.privy.io/authentication/user-authentication/access-tokens, https://docs.privy.io/basics/nodeJS/setup

Client side:

```tsx
'use client';
import {usePrivy} from '@privy-io/react-auth';

export function CallApi() {
  const {getAccessToken} = usePrivy();
  return (
    <button
      onClick={async () => {
        const token = await getAccessToken(); // refreshes if expired
        const res = await fetch('/api/me', {headers: {Authorization: `Bearer ${token}`}});
        console.log(await res.json());
      }}
    >
      Call my API
    </button>
  );
}
```

Server side, `app/api/me/route.ts` (`npm i @privy-io/node@0.36.0`):

```ts
import {PrivyClient} from '@privy-io/node';

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
  // Optional: paste the verification key from Dashboard > App settings to skip a network fetch
  jwtVerificationKey: process.env.PRIVY_VERIFICATION_KEY
});

export async function GET(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({error: 'missing token'}, {status: 401});
  try {
    const claims = await privy.utils().auth().verifyAccessToken(token);
    return Response.json({userId: claims.user_id, sessionId: claims.session_id});
  } catch {
    return Response.json({error: 'invalid token'}, {status: 401});
  }
}
```

**Notes**
- In @privy-io/node 0.36.0, `verifyAccessToken` takes the token **string**. The docs page shows `verifyAccessToken({access_token})`; with this version that fails type-check and always throws at runtime (errors.md #1).
- The result is snake_case: `user_id` (the `did:privy:...` ID), `app_id`, `session_id`, `issued_at`, `expiration`, `issuer`.
- Tokens last about 1 hour. Expired, wrong-app, and forged tokens all throw `InvalidAuthTokenError`.
- If you turned on HTTP-only cookies in the Dashboard, read the `privy-token` cookie instead of the header.
- Use `@privy-io/node`, not `@privy-io/server-auth` (deprecated).

---

## 7. Add World Chain, Unichain or any custom chain

**Goal:** embedded wallets on a sponsor chain.

Based on: https://docs.privy.io/basics/react/advanced/configuring-evm-networks

Chains that are in `viem/chains` (World Chain and Unichain are):

```tsx
'use client';
import {PrivyProvider} from '@privy-io/react-auth';
import {worldchain, worldchainSepolia, unichain, unichainSepolia} from 'viem/chains';

export default function Providers({children}: {children: React.ReactNode}) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        embeddedWallets: {ethereum: {createOnLogin: 'users-without-wallets'}},
        defaultChain: worldchainSepolia,
        supportedChains: [worldchainSepolia, unichainSepolia, worldchain, unichain]
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```

A chain that is not in `viem/chains`:

```ts
import {defineChain} from 'viem';

export const myChain = defineChain({
  id: 123456789,
  name: 'My Chain',
  nativeCurrency: {name: 'Ether', symbol: 'ETH', decimals: 18},
  rpcUrls: {default: {http: ['https://rpc.my-chain.example']}},
  blockExplorers: {default: {name: 'Explorer', url: 'https://explorer.my-chain.example'}}
});
```

Use your own RPC for a viem chain (`npm i @privy-io/chains@0.6.1`):

```ts
import {addRpcUrlOverrideToChain} from '@privy-io/chains';
import {worldchainSepolia} from 'viem/chains';

// Pass worldchainSepoliaRpc (not worldchainSepolia) in defaultChain / supportedChains
export const worldchainSepoliaRpc = addRpcUrlOverrideToChain(worldchainSepolia, '<YOUR_RPC_URL>');
```

**Notes**
- `defaultChain` must also be in `supportedChains`, and `supportedChains` cannot be `[]`. Either mistake makes `PrivyProvider` throw.
- World Chain and Unichain are not in Privy's default chain list. Without `supportedChains`, embedded wallets start on Ethereum mainnet and cannot send on them.
- Chain IDs: World Chain 480, World Chain Sepolia 4801, Unichain 130, Unichain Sepolia 1301 (see [chains.md](chains.md)).
- The default public RPCs are rate limited. Use your own RPC for demos with real traffic.

---

## 8. World mini app login (SIWE through World App)

**Goal:** log a World App user into Privy with their World wallet.

Based on: https://docs.privy.io/recipes/world/mini-apps. That page uses the older MiniKit API (`import MiniKit from ...` and `MiniKit.commandsAsync.walletAuth`), which does **not** type-check with `@worldcoin/minikit-js@2.0.3`: there is no default export, and `commandsAsync` is typed `never`. The version below is adapted to the 2.0.3 types (`MiniKit.walletAuth`, result in `.data`).

```tsx
'use client';
import {useLoginWithSiwe} from '@privy-io/react-auth';
import {MiniKit} from '@worldcoin/minikit-js';

export function WorldLogin() {
  const {generateSiweNonce, loginWithSiwe} = useLoginWithSiwe();
  return (
    <button
      onClick={async () => {
        const nonce = await generateSiweNonce();
        const {data} = await MiniKit.walletAuth({nonce});
        await loginWithSiwe({message: data.message, signature: data.signature});
      }}
    >
      Log in with World App
    </button>
  );
}
```

**Notes**
- Type-checked only. It must run inside World App, so we did not run it. Check https://docs.world.org/mini-apps for current MiniKit setup (you install MiniKit and register the app in the World Developer Portal).
- To let an existing Privy user add their World wallet, use `useLinkWithSiwe` the same way (`generateSiweNonce`, `linkWithSiwe`).
