# QuickNode MCP server

Official, remote, Streamable HTTP: `https://mcp.quicknode.com/mcp`, with OAuth 2.1 sign-in. Source: https://www.quicknode.com/docs/build-with-ai/quicknode-mcp (checked 2026-10-19). We did not connect it: that needs a QuickNode login.

## What it does

- **Account tools** (Admin API): `list-endpoints`, `create-endpoint`, `delete-endpoint`, endpoint metrics and logs, rate limits, security rules (IP, JWT, referrer, token), `get-rpc-usage`, `get-billing`, `list-chains`.
- **`call-rpc`**: read-only JSON-RPC on any supported network through your account's **Tooling Access** setting, with no endpoint needed. An Admin must turn it on once (`enable-tooling-access`). Write methods such as `eth_sendRawTransaction` are refused. Send transactions from your own code.
- Roles: **Viewer** (read-only) or **Admin** (can create and delete things). Admin actions ask you to confirm first. Pick Viewer unless you want the assistant to create endpoints.
- The pricing table lists the Admin API for the Build plan and up. If account tools fail on the free plan, that may be why. Check the docs.

## Claude Code

```bash
claude mcp add --transport http quicknode https://mcp.quicknode.com/mcp
```
Then start Claude Code, type `/mcp`, and finish the OAuth login in the browser (pick the account and role). Add `--scope user` to make it available in all projects, or `--scope project` to share it through `.mcp.json`.

Without a browser (CI, remote VM), use an API key from https://dashboard.quicknode.com/api-keys. The key's role sets the permissions:
```bash
claude mcp add quicknode --transport http https://mcp.quicknode.com/mcp --header "Authorization: Bearer <YOUR_API_KEY>"
```
Don't commit a config that contains the key.

## Cursor

Settings → **Tools & MCPs** → **New MCP Server**, or `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "quicknode": {
      "url": "https://mcp.quicknode.com/mcp"
    }
  }
}
```
Save, click **Connect** next to the server, and log in in the browser window.

With an API key instead of OAuth (official snippet):
```json
{
  "mcpServers": {
    "quicknode": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.quicknode.com/mcp", "--header", "Authorization: Bearer <YOUR_API_KEY>"]
    }
  }
}
```

## Other clients

- Codex: `/plugin` → **Quicknode** → **Install plugin**, or `codex mcp add quicknode --url https://mcp.quicknode.com/mcp --bearer-token-env-var <ENV_VAR_NAME>`. The docs page writes `YOUR_API_KEY` in that slot, but the flag takes the **name** of an environment variable.
- VS Code, Windsurf, Zed and Claude Desktop: see the official page.
- Coding plugin (skill + this MCP in one install), for Claude Code: `/plugin marketplace add quicknode/agent-plugins`, then `/plugin install build-web3@quicknode-agent-plugins` ([docs](https://www.quicknode.com/docs/build-with-ai/build-web3-plugin)).

## Example prompts (not tested here)

- "Create a Unichain Sepolia endpoint and give me the HTTP and WSS URLs" (Admin role)
- "What is the latest block on worldchain-mainnet?" (`call-rpc`)
- "Show my RPC usage by chain this month", useful to watch the 10M free credits
- "Add a referrer rule to my endpoint so only my-app.vercel.app can use it" (referrer rules need the Build plan)
