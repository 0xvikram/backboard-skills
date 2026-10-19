# Subgraph MCP server

The Graph runs an official MCP server, built from [graphops/subgraph-mcp](https://github.com/graphops/subgraph-mcp). It lets an AI assistant:
- search subgraphs by keyword
- find the top subgraphs indexing a contract
- read a subgraph's GraphQL schema
- run queries against subgraphs on The Graph Network

It only reads published subgraphs. It does not deploy anything, and it needs a gateway **API key** from [Subgraph Studio](https://thegraph.com/studio/) (API Keys).

Official pages: [Introduction](https://thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/introduction/), [Claude Desktop](https://thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/claude/), [Cursor](https://thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/cursor/).

Endpoint (SSE): `https://subgraphs.mcp.thegraph.com/sse`. It returned HTTP 200 on 2026-10-19. There is no `/mcp` streamable-HTTP path, which returned 404.

## Claude Code

The official docs only cover Claude Desktop, Cline and Cursor. These two commands map their config to `claude mcp add`. Pick one:

```sh
# Direct SSE connection with the auth header
claude mcp add --transport sse subgraph https://subgraphs.mcp.thegraph.com/sse \
  --header "Authorization: Bearer <GATEWAY_API_KEY>"

# Or the same bridge the official docs use (mcp-remote over stdio)
claude mcp add subgraph -e AUTH_HEADER="Bearer <GATEWAY_API_KEY>" -- \
  npx mcp-remote --header 'Authorization:${AUTH_HEADER}' https://subgraphs.mcp.thegraph.com/sse
```

Check with `claude mcp list`. Add `-s user` to make it available in all projects. We checked the flags against `claude mcp add --help` but did not connect with a real key.

## Cursor

`~/.cursor/mcp.json` (or **Cursor Settings → MCP → Add new global MCP Server**), from the official page:

```json
{
  "mcpServers": {
    "subgraph": {
      "command": "npx",
      "args": ["mcp-remote", "--header", "Authorization:${AUTH_HEADER}", "https://subgraphs.mcp.thegraph.com/sse"],
      "env": {
        "AUTH_HEADER": "Bearer GATEWAY_API_KEY"
      }
    }
  }
}
```

Replace `GATEWAY_API_KEY` and restart Cursor.

## Notes

- In Claude Desktop, the docs say you may have to add the `graphql://subgraph` resource ("Subgraph Server Instructions") to each chat before the tools get used.
- Timeouts show up as `MCP error -32001` on heavy queries ([README](https://github.com/graphops/subgraph-mcp)).
- Queries through the MCP count against your API key's usage like any other gateway query.
- The Graph also lists agent skills for subgraph development (`claude plugins add PaulieB14/subgraphs-skills`, a community repo linked from the [docs](https://thegraph.com/docs/en/subgraphs/tooling/skills/)). Not reviewed here.
