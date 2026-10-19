# Privy docs MCP server

Privy runs an official MCP server that lets your coding assistant search the Privy docs. It reads docs only; it cannot touch your Privy app or wallets.

Source: https://docs.privy.io/basics/get-started/using-llms

Server URL: `https://docs.privy.io/mcp`

## Claude Code

The Privy page shows JSON config for Cursor and Claude Desktop, not a `claude mcp add` command. With Claude Code's standard HTTP-server syntax:

```sh
claude mcp add --transport http privy-docs https://docs.privy.io/mcp
```

Then run `/mcp` in Claude Code to check that `privy-docs` is connected.

## Cursor

Settings > Tools & MCP > Add MCP Server, then in `mcp.json`:

```json
{
  "mcpServers": {
    "privy-docs": {
      "url": "https://docs.privy.io/mcp"
    }
  }
}
```

Save and restart Cursor.

## Claude Desktop

Add the same `mcpServers` block to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows), then restart.

## Other AI docs sources

- Index: https://docs.privy.io/llms.txt
- Full snapshot (about 4.5 MB): https://docs.privy.io/llms-full.txt
- Privy also publishes its own agent skill (`npx skills add https://docs.privy.io`), listed on the same page.
