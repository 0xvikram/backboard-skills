# Reown docs MCP server

The Reown docs site (built on Mintlify) serves an MCP server at `https://docs.reown.com/mcp`. It is **docs only**: it searches and reads the public Reown docs and can't touch your dashboard or projects. On 2026-10-19 it identified itself as `"Reown Docs"` and offered these tools: `search_reown_docs`, `query_docs_filesystem_reown_docs` (read-only browsing of the docs pages) and `submit_feedback` (reports a docs problem to Reown's docs team, so it sends what you write).

I couldn't find a docs page that announces this server. It is the standard Mintlify endpoint on Reown's own docs domain. For a documented option, Reown publishes an agent skill: `npx skills add https://github.com/reown-com/skills --skill appkit --agent '*'` (from https://docs.reown.com/appkit/next/core/installation.md).

## Claude Code

```bash
claude mcp add --transport http reown-docs https://docs.reown.com/mcp
```

Check with `claude mcp list`, or `/mcp` inside a session.

## Cursor

`.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "reown-docs": { "url": "https://docs.reown.com/mcp" }
  }
}
```

## Without MCP

- Index: https://docs.reown.com/llms.txt
- Any page as markdown: add `.md`, e.g. https://docs.reown.com/appkit/react/core/hooks.md
