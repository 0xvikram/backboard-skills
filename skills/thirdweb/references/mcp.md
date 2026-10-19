# thirdweb MCP server

Source: https://portal.thirdweb.com/ai/mcp (page source:
https://github.com/thirdweb-dev/js/blob/main/apps/portal/src/app/ai/mcp/page.mdx). Checked 2026-10-19.

The server is the thirdweb API exposed as MCP tools: wallets, contracts, transactions, payments, tokens and bridge. It is **not** a docs-search
server. It runs with your **project secret key**, so it can create server wallets and send transactions on your project.
For docs, point your assistant at https://portal.thirdweb.com/llms.txt instead.

Endpoint:
```
https://api.thirdweb.com/mcp?secretKey=<your-project-secret-key>
```
To expose only some tools, add `&tools=` with a comma-separated list, for example
`https://api.thirdweb.com/mcp?secretKey=<your-project-secret-key>&tools=getWalletBalance,readContract`.

## Claude Code (from the official page)

```bash
claude mcp add --transport http "thirdweb-api" "https://api.thirdweb.com/mcp?secretKey=YOUR_SECRET_KEY_HERE"
```

## Cursor: `.cursor/mcp.json` (from the official page)

```json
{
  "mcpServers": {
    "thirdweb-api": {
      "url": "https://api.thirdweb.com/mcp?secretKey=YOUR_SECRET_KEY_HERE"
    }
  }
}
```

The page also has setups for Windsurf (`~/.codeium/windsurf/mcp_config.json`) and VS Code (`.vscode/mcp.json`).

## Safety

- The secret key sits in the URL, which ends up in your MCP config file. Do not commit `.cursor/mcp.json` or a project-scoped
  Claude config that contains it. Use a separate project and key for hacking, and rotate the key afterwards.
- Use `&tools=` to leave out write tools (`sendTokens`, `writeContract`, `sendTransactions`, `deployContract`, ...) if you only need reads.
- Tools listed on the page (about 40 at the time of writing) include: `getWalletBalance`, `getWalletTokens`, `listServerWallets`,
  `createServerWallet`, `readContract`, `writeContract`, `deployContract`, `getContractEvents`, `sendTokens`, `createToken`,
  `bridgeSwap`, `fetchWithPayment`, `chat`. See the page for the full list.
