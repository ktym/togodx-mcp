# HISTORY

## 2026-05-22

This project was started to extract the non-visual exploration flow of TogoDX into a standalone MCP server. The goal is to let users choose attributes in natural language, refine intermediate nodes, and finally receive a `dataframe` result without depending on the original web UI.

### Context

- The backend APIs come from [togodx/togodx-server](https://github.com/togodx/togodx-server).
- The intended flow uses:
  - `breakdown/{attribute}`
  - `suggest/{attribute}`
  - `locate/{attribute}`
  - `aggregate`
  - `dataframe`
- Attribute trees consist of intermediate nodes and leaf nodes, where leaf nodes represent underlying database entry IDs.

### Initial implementation

- Work accidentally started in another repository and was later moved into this standalone project.
- Because external network access was restricted during the first pass, the implementation was designed from the supplied API description rather than live endpoint validation.
- A lightweight Node.js implementation was chosen to keep the MCP server dependency-free and easy to run over `stdio`.

### Implemented structure

- `mcp/togodx-mcp-server.mjs`
  - MCP request handling and in-memory session state
- `mcp/lib/togodx-client.mjs`
  - TogoDX HTTP client
- `mcp/lib/attribute-matcher.mjs`
  - Natural-language attribute ranking
- `mcp/lib/attribute-catalog.mjs`
  - Attribute catalog normalization
- `scripts/sync-attribute-catalog.mjs`
  - Sync script for upstream attribute metadata

### Implemented tools

- `start_session`
- `show_session`
- `search_attributes`
- `search_attribute_values`
- `browse_attribute`
- `locate_ids`
- `apply_filters`
- `get_dataframe`

### Later updates in this workspace

- The API base URL was corrected to `https://togodx.dbcls.jp/human`.
- Optional local HTTP mode was added so the server can be called through `POST /mcp` on a local port instead of only through `stdio`.
- Attribute metadata is now generated from:
  - `config/attributes.dx-server.json`
  - `docs/data-sources.md`
  in `togodx-config-human`
- A generated catalog with 65 attributes is now available at `config/togodx-human.attributes.json`.

### Current status

- The MCP server starts successfully.
- Unit tests pass.
- Local HTTP `health`, `initialize`, and `tools/list` were verified.
- Attribute ranking now uses the upstream attribute catalog instead of the earlier 4-attribute sample.

### Remaining work

- Validate live request and response payloads against the production TogoDX endpoints.
- Tune response extraction for `suggest`, `locate`, `aggregate`, and `dataframe`.
- Add end-to-end tests for representative exploration scenarios.
- Improve operational documentation and example prompts.

The Japanese handoff history remains available in [HISTORY.ja.md](/Users/ktym/git/togodx-mcp/HISTORY.ja.md:1).
