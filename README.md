# TogoDX MCP Server

An MCP server for the TogoDX `breakdown`, `suggest`, `locate`, `aggregate`, and `dataframe` APIs. It helps clients discover relevant attributes from natural language, refine filters step by step, and finally return a dataframe.

## Components

- `mcp/togodx-mcp-server.mjs`
  - Dependency-free MCP server supporting `stdio` and optional local HTTP mode
- `mcp/lib/togodx-client.mjs`
  - Thin TogoDX API client
- `mcp/lib/attribute-matcher.mjs`
  - Lightweight natural-language ranking for attributes
- `mcp/lib/attribute-catalog.mjs`
  - Normalizes upstream attribute metadata into the local catalog format
- `scripts/sync-attribute-catalog.mjs`
  - Builds the local catalog from `togodx-config-human`
- `config/togodx-mcp.example.json`
  - Example configuration
- `config/togodx-human.attributes.json`
  - Generated attribute catalog
- `test/*.test.mjs`
  - Basic unit tests

## What It Does

- Starts an exploration session from a natural-language request
- Calls `suggest`, `breakdown`, and `locate` for selected attributes
- Applies intermediate-node filters through `aggregate`
- Returns a final `dataframe`

## Setup

1. Generate the attribute catalog if needed:

```bash
npm run sync:attributes
```

2. Copy `config/togodx-mcp.example.json` and adjust `baseUrl` and `attributesPath` for your environment.
3. Optionally set `TOGODX_MCP_CONFIG=/path/to/config.json`.

For the public service, use:

- `baseUrl`: `https://togodx.dbcls.jp/human`
- `aggregate`: `https://togodx.dbcls.jp/human/aggregate`
- `breakdown`: `https://togodx.dbcls.jp/human/breakdown/{attributeId}`

## Running

`stdio` mode:

```bash
npm run mcp:togodx
```

Local HTTP mode:

```bash
npm run mcp:togodx:http
```

or

```bash
node mcp/togodx-mcp-server.mjs --port 3000
```

HTTP mode exposes:

- `GET /health`
- `POST /mcp`

Example calls:

```bash
curl -X POST http://127.0.0.1:3000/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26"}}'
```

```bash
curl -X POST http://127.0.0.1:3000/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

```bash
curl -X POST http://127.0.0.1:3000/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"start_session","arguments":{"request":"Show genes related to Parkinson disease"}}}'
```

## Tools

- `start_session`
  - Rank attribute candidates from a natural-language request and create a session
- `show_session`
  - Return selected filters, attribute candidates, and current leaf-node counts
- `search_attributes`
  - Search only for matching attributes
- `search_attribute_values`
  - Call `suggest` for a selected attribute
- `browse_attribute`
  - Call `breakdown` for a selected attribute
- `locate_ids`
  - Call `locate` for a list of user IDs
- `apply_filters`
  - Update session filters and refresh leaf nodes with `aggregate`
- `get_dataframe`
  - Return a dataframe for the current session

## Notes

- The server assumes there is no attribute-list API on the TogoDX side, so it loads a local JSON catalog.
- Actual response shapes for `suggest`, `locate`, `aggregate`, and `dataframe` may need to be adjusted to match the production API exactly.
- The Japanese documentation remains available in [README.ja.md](/Users/ktym/git/togodx-mcp/README.ja.md:1).
