# Dynamic docs MCP server

Dynamic hosts an official MCP server that lets your editor's agent search and read the Dynamic docs. It is **docs only**: it can't change your dashboard or touch wallets. Source: the "Install the MCP" step on https://www.dynamic.xyz/docs/get-started/welcome and on the React quickstart https://www.dynamic.xyz/docs/react/reference/quickstart

Server URL (remote HTTP, no API key): `https://www.dynamic.xyz/docs/mcp`

## Claude Code

```bash
claude mcp add --transport http dynamic https://www.dynamic.xyz/docs/mcp
```

Check with `claude mcp list`, or `/mcp` inside a session.

## Cursor

One-click link from Dynamic's docs:
https://cursor.com/en/install-mcp?name=dynamic&config=eyJ1cmwiOiJodHRwczovL3d3dy5keW5hbWljLnh5ei9kb2NzL21jcCJ9

The link's `config` decodes to `{"url":"https://www.dynamic.xyz/docs/mcp"}`. To set it up by hand, put the same thing in `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "dynamic": { "url": "https://www.dynamic.xyz/docs/mcp" }
  }
}
```

## Codex

```bash
codex mcp add dynamic --url https://www.dynamic.xyz/docs/mcp
```

## Tools it exposes (seen via `tools/list` on 2026-10-19)

- `search_dynamic`: full-text search across the docs, returning page titles and links.
- `query_docs_filesystem_dynamic`: read-only shell-like access (`rg`, `head`, `cat`) to the docs pages as `.mdx` files. Useful for exact lookups, for example `rg -il "unichain" /`.

Tip: ask your agent to search the React SDK pages (`/react/...`) when using `@dynamic-labs/sdk-react-core`. The `/javascript/...` pages cover the newer headless JS SDK (`@dynamic-labs-sdk/*`), which has a different API.
