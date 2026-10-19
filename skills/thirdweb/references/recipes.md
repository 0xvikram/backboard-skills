# thirdweb recipes (SDK v5, tested with thirdweb@5.122.0)

All snippets were type-checked (`tsc --noEmit`, strict). The React ones were also built with `next build` (Next 16.4.2).
Recipe 3's read and recipe 6's custom chains were run against public RPCs. Nothing here sent a transaction.
Every snippet assumes `client` from `src/app/client.ts` (see quickstart.md).

---

## 1. Client setup

**Goal:** one `client` for the browser (Client ID) and a separate one for the server (Secret Key).

```ts
// browser: src/app/client.ts
import { createThirdwebClient } from "thirdweb";
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
if (!clientId) throw new Error("Set NEXT_PUBLIC_THIRDWEB_CLIENT_ID");
export const client = createThirdwebClient({ clientId });
```

```ts
// server only: route handlers, scripts. Never import this file from a "use client" file.
import { createThirdwebClient } from "thirdweb";
export const serverClient = createThirdwebClient({ secretKey: process.env.THIRDWEB_SECRET_KEY! });
```

**Notes**
- Client ID requests are checked against the project's allowed domains. Secret Key requests are not, so keep the key secret.
- Source: https://portal.thirdweb.com/references/typescript/v5/createThirdwebClient

---

## 2. ConnectButton and in-app wallets

**Goal:** one button that lets users log in with Google, email or passkey (they get an in-app wallet) or connect MetaMask.

```tsx
"use client";
import { ConnectButton, useActiveAccount, useActiveWalletChain } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { baseSepolia } from "thirdweb/chains";
import { client } from "./client";

const wallets = [
  inAppWallet({
    auth: { options: ["google", "email", "passkey"] }, // also "apple", "discord", "x", "telegram", "phone", ...
    metadata: { name: "My Hack" },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
];

export function Login() {
  const account = useActiveAccount();      // undefined until connected
  const chain = useActiveWalletChain();
  return (
    <>
      <ConnectButton client={client} wallets={wallets} chain={baseSepolia} />
      {account && <p>{account.address} on chain {chain?.id}</p>}
    </>
  );
}
```

**Notes**
- `<ThirdwebProvider>` must wrap the tree (quickstart step 5). `ConnectButton` already auto-reconnects on reload.
- Use `ConnectEmbed` for an inline sign-in form instead of a modal button.
- In-app wallets are scoped to your Client ID: the same user gets the same address in your app only.
- Sources: https://portal.thirdweb.com/react/v5/in-app-wallet/get-started,
  https://portal.thirdweb.com/references/typescript/v5/ConnectButton,
  sign-in methods: https://portal.thirdweb.com/connect/wallet/sign-in-methods/configure

---

## 3. Read a contract

**Goal:** read state with a Solidity signature (typed) or with a prebuilt extension.

React:
```tsx
"use client";
import { getContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { balanceOf } from "thirdweb/extensions/erc20";
import { client } from "./client";

const token = getContract({
  client,
  chain: baseSepolia,
  address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
});

export function ReadExample() {
  const account = useActiveAccount();

  // a) raw read: the method signature types params and result
  const { data: symbol } = useReadContract({
    contract: token,
    method: "function symbol() view returns (string)",
    params: [],
  });

  // b) prebuilt extension
  const { data: bal, isLoading } = useReadContract(balanceOf, {
    contract: token,
    address: account?.address ?? "0x0000000000000000000000000000000000000000",
    queryOptions: { enabled: !!account },
  });

  if (!account) return <p>Connect a wallet first</p>;
  return <p>{isLoading ? "Loading..." : `${bal?.toString()} (raw units) ${symbol ?? ""}`}</p>;
}
```

Node / server:
```ts
import { getContract, readContract } from "thirdweb";
const decimals = await readContract({
  contract: getContract({ client, chain: baseSepolia, address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" }),
  method: "function decimals() view returns (uint8)",
  params: [],
});
```

**Notes**
- `getContract` needs no ABI when you pass a method signature. To pass a full ABI, use `getContract({ ..., abi })` with the ABI `as const`.
- `resolveMethod("name")` fetches the ABI at runtime. It is untyped and slower.
- Extensions exist for ERC-20, 721, 1155 and more (`thirdweb/extensions/erc20`, `.../erc721`, ...).
- Sources: https://portal.thirdweb.com/references/typescript/v5/readContract,
  https://portal.thirdweb.com/references/typescript/v5/useReadContract,
  https://portal.thirdweb.com/typescript/v5/extensions/use

---

## 4. Write to a contract

**Goal:** send a transaction from the connected wallet (React) or from a server key (Node).

React, with a hook or the prebuilt button:
```tsx
"use client";
import { getContract, prepareContractCall } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { TransactionButton, useSendTransaction } from "thirdweb/react";
import { client } from "./client";

const contract = getContract({
  client,
  chain: baseSepolia,
  address: "0xYOUR_CONTRACT_ADDRESS", // must be a real 0x address or getContract throws
});

export function WriteExample() {
  const { mutate: sendTx, isPending, error, data } = useSendTransaction();

  return (
    <div>
      <button
        disabled={isPending}
        onClick={() =>
          sendTx(
            prepareContractCall({
              contract,
              method: "function setGreeting(string _greeting)",
              params: ["gm Mumbai"],
            }),
          )
        }
      >
        {isPending ? "Sending..." : "Set greeting"}
      </button>
      {error && <p>Error: {error.message}</p>}
      {data && <p>Tx hash: {data.transactionHash}</p>}

      {/* Handles switch-network, pending and confirm states for you */}
      <TransactionButton
        transaction={() =>
          prepareContractCall({ contract, method: "function increment()", params: [] })
        }
        onTransactionConfirmed={(receipt) => console.log("confirmed", receipt.transactionHash)}
        onError={(err) => alert(err.message)}
      >
        Increment
      </TransactionButton>
    </div>
  );
}
```

Node (testnet key only, never a key with real funds):
```ts
import { createThirdwebClient, getContract, prepareContractCall, sendAndConfirmTransaction } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { privateKeyToAccount } from "thirdweb/wallets";

const client = createThirdwebClient({ secretKey: process.env.THIRDWEB_SECRET_KEY! });
const account = privateKeyToAccount({ client, privateKey: process.env.PRIVATE_KEY! });

const transaction = prepareContractCall({
  contract: getContract({ client, chain: baseSepolia, address: process.env.CONTRACT_ADDRESS! }),
  method: "function transfer(address to, uint256 value) returns (bool)",
  params: ["0x0000000000000000000000000000000000000001", 1_000_000n], // bigint, not number
});

const receipt = await sendAndConfirmTransaction({ account, transaction });
console.log(receipt.status, receipt.transactionHash);
```

**Notes**
- `sendTransaction` returns `{ transactionHash }` right away. `sendAndConfirmTransaction` waits for the receipt.
  You can also call `waitForReceipt({ client, chain, transactionHash })`.
- Payable call: add `value: toWei("0.01")` (`import { toWei } from "thirdweb/utils"`) to `prepareContractCall`.
- `useSendTransaction` does not throw into your UI. Read its `error` (see errors.md #6).
- Sources: https://portal.thirdweb.com/references/typescript/v5/prepareContractCall,
  https://portal.thirdweb.com/references/typescript/v5/sendTransaction,
  https://portal.thirdweb.com/references/typescript/v5/sendAndConfirmTransaction,
  https://portal.thirdweb.com/references/typescript/v5/useSendTransaction,
  https://portal.thirdweb.com/references/typescript/v5/TransactionButton

---

## 5. Deploy a contract

**Goal:** deploy your own Solidity contract, or a thirdweb prebuilt token, from a script.

```ts
import { createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { deployContract, deployERC20Contract } from "thirdweb/deploys";
import { privateKeyToAccount } from "thirdweb/wallets";

const client = createThirdwebClient({ secretKey: process.env.THIRDWEB_SECRET_KEY! });
const account = privateKeyToAccount({ client, privateKey: process.env.PRIVATE_KEY! });

// A. Your contract: ABI + bytecode from `forge build` (out/Greeter.sol/Greeter.json → abi, bytecode.object)
const abi = [
  { type: "constructor", inputs: [{ name: "_greeting", type: "string" }], stateMutability: "nonpayable" },
  { type: "function", name: "greet", inputs: [], outputs: [{ name: "", type: "string" }], stateMutability: "view" },
] as const;
const bytecode = "0x6080..." as `0x${string}`;

const greeter = await deployContract({
  client, chain: baseSepolia, account, abi, bytecode,
  constructorParams: { _greeting: "gm" }, // keys are the constructor parameter names
  // salt: "my-salt",                     // optional: deterministic address
});

// B. thirdweb prebuilt ERC-20, no Solidity needed
const token = await deployERC20Contract({
  client, chain: baseSepolia, account,
  type: "TokenERC20",
  params: { name: "Mumbai Token", symbol: "MUM" },
});
console.log({ greeter, token });
```

From a Foundry/Hardhat folder, the CLI opens a browser page where you deploy with your own wallet:
```bash
npx thirdweb@5.122.0 deploy -k "$THIRDWEB_SECRET_KEY"
```

**Notes**
- `deployERC20Contract`, `deployERC721Contract` and the others also deploy thirdweb's infra contracts on chains that lack them. The first deploy on a new chain costs more gas.
- `deployPublishedContract({ contractId, publisher, contractParams })` deploys any contract published on thirdweb.
- The CLI wrapper runs `npx @thirdweb-dev/cli@latest` under the hood (see `dist/esm/cli/bin.js`), so that part is not pinned.
- Sources: https://portal.thirdweb.com/contracts/deploy,
  https://portal.thirdweb.com/references/typescript/v5/deploy/deployContract,
  https://portal.thirdweb.com/references/typescript/v5/deploy/deployERC20Contract,
  https://portal.thirdweb.com/references/typescript/v5/deploy/deployPublishedContract

---

## 6. Custom chains with defineChain

**Goal:** use any EVM chain, including the ETHGlobal Mumbai sponsor chains.

```ts
import { defineChain } from "thirdweb";
import { arcTestnet } from "thirdweb/chains"; // built in: id 5042002

// By ID: thirdweb uses its RPC edge https://<id>.rpc.thirdweb.com/<clientId> and looks up metadata
export const worldChain = defineChain(480);
export const worldChainSepolia = defineChain(4801);
export const unichain = defineChain(130);
export const unichainSepolia = defineChain(1301);
export const zgGalileo = defineChain(16602); // 0G Galileo testnet

// Full object with your own RPC
export const zgMainnet = defineChain({
  id: 16661,
  name: "0G Mainnet",
  rpc: "https://evmrpc.0g.ai",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  blockExplorers: [{ name: "0G Chainscan", url: "https://chainscan.0g.ai" }],
});
export { arcTestnet };
```

Use the chain anywhere a `chain` is expected: `getContract({ client, chain: worldChain, address })`,
`<ConnectButton chain={worldChain} chains={[worldChain, unichain]} />`, and so on.

**Notes**
- `defineChain(id)` needs a valid Client ID or Secret Key on the client, because RPC calls go to thirdweb's edge.
  With `rpc: "https://..."`, calls go straight to that URL. Tested: World Chain, Unichain, Base Sepolia, 0G Galileo,
  Hedera testnet and Whitechain testnet reads all worked through custom public RPCs.
- `getRpcUrlForChain` is exported from `"thirdweb/chains"`, not from `"thirdweb"`.
- Chain IDs, RPCs and thirdweb support per chain: [chains.md](chains.md).
- Sources: https://portal.thirdweb.com/references/typescript/v5/defineChain, https://portal.thirdweb.com/typescript/v5/chain,
  chain list: https://thirdweb.com/chainlist

---

## 7. Gas sponsorship and account abstraction

**Goal:** users send transactions without holding gas.

```tsx
"use client";
import { ConnectButton } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { baseSepolia } from "thirdweb/chains";
import { client } from "./client";

// A. Recommended: EIP-7702. Same address as the user's EOA, and gas is paid by your project.
const wallets7702 = [
  inAppWallet({
    auth: { options: ["google", "email"] },
    executionMode: { mode: "EIP7702", sponsorGas: true },
  }),
];

// B. ERC-4337 smart account, for chains without EIP-7702. The address differs from the signer.
const wallets4337 = [
  inAppWallet({
    executionMode: { mode: "EIP4337", smartAccount: { chain: baseSepolia, sponsorGas: true } },
  }),
];

export const Sponsored7702 = () => <ConnectButton client={client} wallets={wallets7702} chain={baseSepolia} />;
export const Sponsored4337 = () => <ConnectButton client={client} wallets={wallets4337} chain={baseSepolia} />;

// C. Turn EVERY connected wallet (MetaMask too) into a sponsored ERC-4337 smart account
export const SponsoredAll = () => (
  <ConnectButton client={client} chain={baseSepolia} accountAbstraction={{ chain: baseSepolia, sponsorGas: true }} />
);
```
After that, recipe 4's `useSendTransaction` and `TransactionButton` calls are sponsored with no other changes.

**Notes**
- Testnet sponsorship is free. Mainnet sponsorship needs a credit card on file
  (https://portal.thirdweb.com/react/v5/in-app-wallet/enable-gasless).
- Limit spend per chain, contract or wallet under project → account abstraction → settings
  (https://portal.thirdweb.com/wallets/sponsorship-policies).
- `inAppWallet({ smartAccount })` is deprecated. Use `executionMode` (from the SDK's type definitions).
- Not every chain has thirdweb's 4337 bundler/paymaster. Check [chains.md](chains.md) before you pick a sponsor chain.
- Sources: https://portal.thirdweb.com/wallets/sponsor-gas, https://portal.thirdweb.com/references/typescript/v5/inAppWallet,
  https://portal.thirdweb.com/references/typescript/v5/smartWallet
