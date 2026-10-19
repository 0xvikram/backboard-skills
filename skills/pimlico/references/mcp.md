# Pimlico CLI as an MCP server

Pimlico's official CLI (`@pimlico/cli`) runs as an MCP server, so your coding agent can read your balance, usage, request and user operation logs, list policies, and (if you allow it) create API keys and sponsorship policies.
Source: https://docs.pimlico.io/references/platform/cli (read 2026-10-19; `@pimlico/cli` was 1.1.0 on npm).

## 1. Install and log in

```bash
npm install -g @pimlico/cli
pimlico telemetry disable   # the CLI sends usage telemetry unless you turn it off
pimlico login               # browser sign-in; pick personal or org
```
- Over SSH or in a container: `pimlico login --device` (prints a link and code).
- Permissions are chosen at login. Read-only is enough for logs and balance: `pimlico login --read-only`. To let the agent create keys and policies: `pimlico login --scopes keys,policies`.
- The CLI never shows an existing key. `pimlico keys create --name <name>` shows a new key once.
- Other install options (Homebrew, pnpm, bun) are on the CLI page. Prefer a package manager over piping an install script into a shell.

## 2. Claude Code

```bash
claude mcp add pimlico -- pimlico mcp
```
(command from the official CLI page). Check with `claude mcp list`.

## 3. Cursor

Pimlico's page gives only the Claude Code command. In Cursor, add the same command to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global), using Cursor's standard format:

```json
{
  "mcpServers": {
    "pimlico": {
      "command": "pimlico",
      "args": ["mcp"]
    }
  }
}
```

## 4. Without MCP

Agents with a shell can call the CLI directly. Every command takes `--json`, and `pimlico --help` lists them.

## Useful asks

- "Use the pimlico CLI to create an API key named ethglobal-mumbai and put it in .env as PIMLICO_API_KEY."
- "Show my last failed user operations on World Chain Sepolia."
- "Create a sponsorship policy capped at a small daily total and give me its ID."

Note: the MCP server manages your Pimlico account. It does not send transactions; your app code (permissionless.js) does that.
