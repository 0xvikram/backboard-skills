# Namespace docs MCP server and official skills

Namespace hosts a docs MCP server (Mintlify). It has one tool, **Search**, which returns doc titles, context and links. It reads docs only; it does not create subnames or touch your keys.

Server URL: `https://docs.namespace.ninja/mcp`
Source: https://docs.namespace.ninja/developer-guide/ai-development#mcp-server

## Claude Code

```sh
claude mcp add --transport http Namespace https://docs.namespace.ninja/mcp
claude mcp list
```

## Cursor

Command palette > "Open MCP settings" > **Add custom MCP**, then in `mcp.json`:
```json
{
  "mcpServers": {
    "Namespace": {
      "url": "https://docs.namespace.ninja/mcp"
    }
  }
}
```
Test: ask Cursor chat "What tools do you have available?".

## VS Code

`.vscode/mcp.json`:
```json
{
  "servers": {
    "Namespace": { "type": "http", "url": "https://docs.namespace.ninja/mcp" }
  }
}
```

## Official Namespace skills

Namespace also publishes its own agent skills (https://docs.namespace.ninja/developer-guide/skills):
```sh
npx skills add thenamespace/skills -s offchain-ens-subname-sdk
npx skills add thenamespace/skills -s mint-manager-sdk
npx skills add thenamespace/skills -s ens-components
npx skills add thenamespace/skills -s resolvio
npx skills add thenamespace/skills -s avatar-sdk
```

An npm package named `@iflow-mcp/thenamespace-ens-mcp` exists, but it is not linked from the Namespace docs; treat it as unofficial.
