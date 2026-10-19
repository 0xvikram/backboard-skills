# Alchemy MCP server

Source: [Alchemy MCP Server docs](https://www.alchemy.com/docs/alchemy-mcp-server) (checked 2026-10-19).

The official MCP server is hosted at `https://mcp.alchemy.com/mcp` (Streamable HTTP). It signs you in with your Alchemy account through OAuth. You do not need an API key or a local install. It gives the agent live tools for chain data: JSON-RPC calls, Token, NFT, Transfers, Prices, Portfolio, simulation, trace/debug, bundler and smart-wallet calls, Solana DAS, and app management.

Use it to **look things up while you build**, for example "what tokens does this address hold on World Chain", "decode this tx", or "create an app with Unichain enabled". For code your app ships, use the HTTP APIs in [recipes.md](recipes.md).

## Claude Code

```bash
claude mcp add alchemy --transport http https://mcp.alchemy.com/mcp
```

Restart Claude Code (or start a new conversation), then run `/mcp`, pick `alchemy`, and sign in. A browser window opens the first time a tool is used.

Then tell the agent "Select an Alchemy app" (`select_app`). RPC and data tools need a selected app.

Alternative: the official Claude Code plugin bundles the MCP server, slash commands and Alchemy's own skills ([docs](https://www.alchemy.com/docs/alchemy-claude-plugin)):

```text
/plugin marketplace add alchemyplatform/alchemy-claude-plugin
/plugin install alchemy@alchemy
/alchemy:setup
```

## Cursor

Add this to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "alchemy": {
      "type": "streamable-http",
      "url": "https://mcp.alchemy.com/mcp"
    }
  }
}
```

Restart Cursor and check **Cursor Settings → MCP**.

## Codex

```bash
codex mcp add alchemy --url https://mcp.alchemy.com/mcp
codex mcp list
```

## Notes

- The server uses OAuth 2.1 with PKCE. Any MCP client that speaks Streamable HTTP can point at the same URL.
- The admin tools (`create_app`, `update_allowlist`) change your real Alchemy account. Read what the agent is about to do before you approve it.
- To see whether a chain is available, ask the agent to run `list_chains`.
