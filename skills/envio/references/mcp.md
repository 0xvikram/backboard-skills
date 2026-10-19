# Envio docs MCP server

Envio runs an official MCP server for its documentation. It does not touch your indexer or deployments. It only searches and fetches docs, and it needs **no API key**.

- Official page: https://docs.envio.dev/docs/HyperIndex/mcp-server
- Endpoint (Streamable HTTP): `https://docs.envio.dev/mcp`
- Tools: `docs_search` (full-text search, returns titles, URLs and snippets) and `docs_fetch` (a full page as markdown).

## Claude Code

From the official page:

```sh
claude mcp add --transport http envio-docs https://docs.envio.dev/mcp
```

Check it with `claude mcp list`. Add `-s user` to make it available in every project.

## Cursor / VS Code

Put this in `.cursor/mcp.json` (or your VS Code MCP settings), from the official page:

```json
{
  "mcpServers": {
    "envio-docs": {
      "url": "https://docs.envio.dev/mcp"
    }
  }
}
```

## Without MCP

Since envio 3.1 the CLI has the same two tools built in, so an agent with a shell needs no setup:

```sh
npx envio tools search-docs "contractRegister factory"
npx envio tools fetch-docs https://docs.envio.dev/docs/HyperIndex/dynamic-contracts
```

`envio init` also writes Envio's own agent skills to `.claude/skills/` in the new project (for handlers, config, schema, testing, factories and more). Refresh them after upgrading envio with `npx envio skills update`.
