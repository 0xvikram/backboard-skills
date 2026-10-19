# Goldsky docs MCP server

Source: https://docs.goldsky.com/mcp-server (checked 2026-10-19).

Goldsky hosts a **read-only docs** MCP server at `https://docs.goldsky.com/mcp`. It searches the live Goldsky documentation. It does not deploy anything and does not touch your project, and it needs no API key.

Checked live on 2026-10-19 with an MCP `initialize` and `tools/list` (streamable HTTP, no auth). It has 3 tools:
- `search_goldsky`: search the docs, code examples and API references.
- `query_docs_filesystem_goldsky`: run read-only shell-style commands (such as `rg`, `cat`) over the docs as files.
- `submit_feedback`: report a docs problem to Goldsky. It **sends** text to Goldsky, so only use it on purpose.

## Claude Code

```sh
claude mcp add --transport http Goldsky https://docs.goldsky.com/mcp
claude mcp list        # "Goldsky" should appear
```

## Cursor

Command palette, then **Open MCP settings**, then **Add custom MCP**. In `mcp.json`:

```json
{
  "mcpServers": {
    "Goldsky": {
      "url": "https://docs.goldsky.com/mcp"
    }
  }
}
```

## VS Code (Copilot)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "Goldsky": {
      "type": "http",
      "url": "https://docs.goldsky.com/mcp"
    }
  }
}
```

## Also available

Goldsky publishes its own agent skill pack (`npx skills add goldsky-io/goldsky-agent`), with workflows such as `/subgraph-builder`, `/turbo-builder` and `/subgraph-doctor` ([Agent Skills](https://docs.goldsky.com/ai-skills)). It was not tested for this skill.
