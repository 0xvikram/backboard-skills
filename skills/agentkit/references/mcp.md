# MCP and AgentKit

Two different things:

1. **AgentKit as an MCP server.** Your agent wallet's actions become tools in Claude Code, Claude Desktop or Cursor. You run it yourself: there is no hosted AgentKit MCP. Built from `@coinbase/agentkit-model-context-protocol`.
2. **CDP Docs MCP**: an official, hosted, search-only server over docs.cdp.coinbase.com. Good for CDP keys, wallets and faucets. It no longer covers AgentKit, because those pages were removed from the site.

---

## 1. AgentKit MCP server (local, stdio)

Source: https://github.com/coinbase/agentkit/tree/main/typescript/framework-extensions/model-context-protocol · template from `npm create onchain-agent@0.5.7` → framework "Model Context Protocol".

### Fastest: scaffold it

```sh
npm create onchain-agent@0.5.7     # choose "Model Context Protocol", EVM, Testnet, base-sepolia, CDPEvmWallet
cd onchain-agent
npm install
npm run build                      # tsup → build/index.js
```

It generates `claude_desktop_config.json` with the absolute path to `build/index.js` and empty env vars (`CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`, `NETWORK_ID`, `ADDRESS`, `RPC_URL`, `IDEMPOTENCY_KEY`). Tested: install, `tsc` and build pass. Started without keys, it prints `Missing required environment variables...` and exits.

### Or write it yourself (`src/index.ts`)

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getMcpTools } from "@coinbase/agentkit-model-context-protocol";
import { AgentKit, CdpEvmWalletProvider, walletActionProvider, erc20ActionProvider, cdpApiActionProvider } from "@coinbase/agentkit";

const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
  networkId: process.env.NETWORK_ID || "base-sepolia",
  address: process.env.ADDRESS as `0x${string}` | undefined,
});
const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [walletActionProvider(), erc20ActionProvider(), cdpApiActionProvider()],
});

const { tools, toolHandler } = await getMcpTools(agentkit);
const server = new Server({ name: "agentkit", version: "0.1.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (request) =>
  toolHandler(request.params.name, request.params.arguments),
);
await server.connect(new StdioServerTransport());
```

Install: `npm i @coinbase/agentkit@0.10.4 @coinbase/agentkit-model-context-protocol@0.2.0 @modelcontextprotocol/sdk@1.32.1 zod@3.25.76`. Never `console.log` to stdout in a stdio MCP server (it corrupts the protocol). Use `console.error`.

Tested: `getMcpTools` returned 13 tools for a ViemWalletProvider agent on World Chain Sepolia, and `toolHandler("WalletActionProvider_get_wallet_details", {})` returned the wallet details.

### Add to Claude Code

```sh
claude mcp add agentkit \
  -e CDP_API_KEY_ID=<YOUR_CDP_API_KEY_ID> \
  -e CDP_API_KEY_SECRET=<YOUR_CDP_API_KEY_SECRET> \
  -e CDP_WALLET_SECRET=<YOUR_CDP_WALLET_SECRET> \
  -e NETWORK_ID=base-sepolia \
  -e ADDRESS=<YOUR_AGENT_WALLET_ADDRESS> \
  -- node /ABSOLUTE/PATH/onchain-agent/build/index.js
```

(`claude mcp add <name> -e KEY=value -- <command> [args]`, from `claude mcp add --help`.) Set `ADDRESS`, or each start creates a new wallet.

### Add to Cursor / Claude Desktop

`.cursor/mcp.json` (project) or `~/.cursor/mcp.json`. Claude Desktop uses the same shape in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentkit": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/onchain-agent/build/index.js"],
      "env": {
        "CDP_API_KEY_ID": "<YOUR_CDP_API_KEY_ID>",
        "CDP_API_KEY_SECRET": "<YOUR_CDP_API_KEY_SECRET>",
        "CDP_WALLET_SECRET": "<YOUR_CDP_WALLET_SECRET>",
        "NETWORK_ID": "base-sepolia",
        "ADDRESS": "<YOUR_AGENT_WALLET_ADDRESS>"
      }
    }
  }
}
```

Don't commit a config file that holds keys.

---

## 2. CDP Docs MCP (official, hosted, read-only)

Source: https://docs.cdp.coinbase.com/ai-agents/cdp-for-agents/cdp-docs-mcp

Server URL: `https://docs.cdp.coinbase.com/mcp` (documentation search only, no API calls).

Claude Code:

```sh
claude mcp add --transport http coinbase-cdp https://docs.cdp.coinbase.com/mcp
```

Cursor (`.cursor/mcp.json`), as given on the docs page:

```json
{
  "mcpServers": {
    "coinbase-cdp": {
      "url": "https://docs.cdp.coinbase.com/mcp"
    }
  }
}
```

Check it with: "What MCP tools do you have available?"

Not the same as Coinbase's **Wallet MCP** (`https://wallet-mcp.coinbase.com`, your own Coinbase Wallet, you approve each write) or **CDP MCP** (`@coinbase/cdp-cli`, the full CDP API from a coding agent). Compare them: https://docs.cdp.coinbase.com/ai-agents/overview
