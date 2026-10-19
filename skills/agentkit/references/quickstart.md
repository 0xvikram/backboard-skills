# AgentKit quickstart (TypeScript, CDP wallet, LangChain)

Tested 2026-10-19 with the exact versions below. Sources: AgentKit README https://github.com/coinbase/agentkit (Quickstart), package README https://github.com/coinbase/agentkit/tree/main/typescript/agentkit (Usage, CdpEvmWalletProvider), CDP keys https://docs.cdp.coinbase.com/wallets/quickstart/api-key-auth.

## 1. Accounts and keys

1. Sign in at https://portal.cdp.coinbase.com (create a project if asked).
2. **Secret API key**: open https://portal.cdp.coinbase.com/api-keys/secret and create a key. Copy the **API key ID** and the **secret** (the secret is shown once).
3. **Wallet Secret**: open https://portal.cdp.coinbase.com/wallets/non-custodial/security and generate one. It authorizes signing for your CDP server wallets. It is also shown once.
4. **OpenAI key** (or any LangChain chat model): https://platform.openai.com/api-keys.

The keys go in `.env` only. Never commit them, never put them in frontend code.

## 2. Project

```sh
mkdir my-agent && cd my-agent
npm init -y && npm pkg set type=module
npm i @coinbase/agentkit@0.10.4 @coinbase/agentkit-langchain@0.3.0 \
  @langchain/core@0.3.80 @langchain/langgraph@0.4.10 @langchain/openai@0.6.17 \
  viem@2.38.3 zod@3.25.76 dotenv@17.2.3
npm i -D tsx@4.23.15 typescript@5.9.3 @types/node@22
```

Why these exact pins (all checked, see errors.md):
- `@coinbase/agentkit-langchain@0.3.0` depends on `@langchain/core@^0.3`, so LangGraph 0.4.x and `@langchain/openai` 0.6.x (the last lines on core 0.3). LangGraph 1.x does not type-check with it.
- `viem@2.38.3` is the exact viem AgentKit 0.10.4 pins. A newer viem breaks `new ViemWalletProvider(client)` types.
- `zod@3.25.76`: AgentKit 0.10.4 schemas are zod 3. Zod 4 schemas don't type-check in custom actions.

`tsconfig.json` (the decorator flags matter only if you write `@CreateAction` actions, see recipes.md #5):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "types": ["node"]
  }
}
```

`.env`:

```sh
CDP_API_KEY_ID=<YOUR_CDP_API_KEY_ID>
CDP_API_KEY_SECRET=<YOUR_CDP_API_KEY_SECRET>
CDP_WALLET_SECRET=<YOUR_CDP_WALLET_SECRET>
OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>
# After the first run, paste the printed address here to keep the same wallet:
# ADDRESS=<THE_PRINTED_ADDRESS>
```

## 3. `agent.ts`: a chat agent with a Base Sepolia wallet

```ts
import "dotenv/config";
import * as readline from "node:readline/promises";
import {
  AgentKit,
  CdpEvmWalletProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpEvmWalletActionProvider,
  pythActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

// CDP server wallet. Without `address`, a NEW wallet is created on every run.
const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
  walletSecret: process.env.CDP_WALLET_SECRET,
  networkId: "base-sepolia",
  address: process.env.ADDRESS as `0x${string}` | undefined,
});

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    walletActionProvider(), // get_wallet_details, native_transfer
    erc20ActionProvider(), // get_balance, transfer, approve, ...
    cdpApiActionProvider(), // request_faucet_funds (Base Sepolia / Ethereum Sepolia)
    cdpEvmWalletActionProvider(), // swap, get_swap_price, spend permissions
    pythActionProvider(), // fetch_price
  ],
});

const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
  tools: await getLangChainTools(agentkit),
  checkpointSaver: new MemorySaver(),
  prompt:
    "You are an onchain agent using Coinbase AgentKit. Get wallet details before your first action. " +
    "On base-sepolia you can request test funds from the faucet. Be concise.",
});

console.log("Wallet address:", walletProvider.getAddress());
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const config = { configurable: { thread_id: "agentkit-chat" } };
while (true) {
  const text = await rl.question("\nYou: ");
  if (text.trim() === "exit") break;
  const result = await agent.invoke({ messages: [new HumanMessage(text)] }, config);
  console.log("Agent:", result.messages.at(-1)?.content);
}
rl.close();
```

## 4. Run

```sh
npx tsx agent.ts
```

Try: `what is my wallet address?`, `get test ETH from the faucet`, `send 0.00001 ETH to 0x...`, `what is the ETH price?`. Type `exit` to quit.

What you should see: `Wallet address: 0x...`. Put it in `.env` as `ADDRESS` so the next run uses the same wallet and its funds.

## 5. Notes

- `npx tsx` is fine here. If you add `@CreateAction` decorator actions, tsx can't run them (errors.md #3). Compile with `tsc` or use `customActionProvider`.
- AgentKit sends usage analytics (event name, wallet address, network, action name) to `https://cca-lite.coinbase.com` when a wallet provider is created and on every action call. 0.10.4 has no opt-out setting. If the request fails, the process can crash (errors.md #8). Source: https://github.com/coinbase/agentkit/blob/433bdc262038eca2bea923d87dc26f8fb76337d9/typescript/agentkit/src/analytics/sendAnalyticsEvent.ts
- AgentKit does not add spend caps, address allowlists or human approval. Use a testnet and a small balance, and treat any text the agent reads (web pages, tweets) as possible prompt injection. See "Managing Risk" in https://github.com/coinbase/agentkit#%EF%B8%8F-managing-risk
