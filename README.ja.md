# TogoDX MCP Server

TogoDX の `breakdown` / `suggest` / `locate` / `aggregate` / `dataframe` API を、自然言語で属性候補を探しながら段階的に使うための MCP サーバです。

## 構成

- `mcp/togodx-mcp-server.mjs`
  - `stdio` で動く依存なしの MCP サーバ
- `mcp/lib/togodx-client.mjs`
  - TogoDX API クライアント
- `mcp/lib/attribute-matcher.mjs`
  - 自然言語クエリから属性候補をランキング
- `mcp/lib/attribute-catalog.mjs`
  - `attributes.dx-server.json` を MCP 用の属性・カテゴリ・dataset 情報へ正規化
- `config/togodx-mcp.example.json`
  - API のベース URL、データセット、属性カタログの設定
- `config/togodx-human.attributes.example.json`
  - 属性メタデータのサンプル
- `scripts/sync-attribute-catalog.mjs`
  - `togodx-config-human` の `config/attributes.dx-server.json` から属性カタログを生成
- `test/*.test.mjs`
  - 最低限のユニットテスト

## できること

- 自然言語から属性候補を探して探索セッションを開始する
- 属性ごとに `suggest` / `breakdown` / `locate` を呼ぶ
- 選んだ中間ノードを `aggregate` に渡してリーフノード集合を更新する
- 最後に `dataframe` を返す

## 使い方

1. 実際の属性カタログを生成する場合は、`npm run sync:attributes` を実行して `config/togodx-human.attributes.json` を作る
2. `config/togodx-mcp.example.json` をコピーして `baseUrl` と `dataset` と `attributesPath` を環境に合わせて変更する
3. 必要なら `TOGODX_MCP_CONFIG=/path/to/config.json` を指定して起動する

公開 API を使う場合、`baseUrl` は `https://togodx.dbcls.jp/human` を指定します。
この設定で `aggregate` は `https://togodx.dbcls.jp/human/aggregate`、
`breakdown` は `https://togodx.dbcls.jp/human/breakdown/{attributeId}` を呼びます。

属性・カテゴリ・dataset・ID 変換情報は `togodx-config-human` の
`config/attributes.dx-server.json` から同期します。

```bash
npm run sync:attributes
```

この生成物を使う場合、`attributesPath` は `config/togodx-human.attributes.json` にします。

```bash
node mcp/togodx-mcp-server.mjs
```

`package.json` のスクリプトからでも起動できます。

```bash
npm run mcp:togodx
```

ローカルポートで HTTP 経由にしたい場合は、`--port` 付きで起動できます。

```bash
node mcp/togodx-mcp-server.mjs --port 3000
```

または次のスクリプトでも起動できます。

```bash
npm run mcp:togodx:http
```

HTTP モードでは以下を提供します。

- `GET /health`
- `POST /mcp`

`/mcp` には JSON-RPC のリクエスト本体をそのまま JSON で送ります。たとえば:

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
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"start_session","arguments":{"request":"パーキンソン病に関係する遺伝子を見たい"}}}'
```

## ツール一覧

- `show_catalog_overview`
  - 対応カテゴリ、利用可能 dataset、変換先 dataset を返す
- `show_category_attributes`
  - `gene` や `disease` のようなカテゴリで利用可能な属性一覧を返す
- `show_dataset_info`
  - `ensembl_gene` や `ncbigene` のような dataset の詳細と ID 例、変換先を返す
- `start_session`
  - 自然言語の要求から属性候補をランキングしてセッションを作る
- `show_session`
  - 選択済みフィルタと現在のリーフノード数を確認する
- `search_attributes`
  - 自然言語クエリから属性候補だけを検索する
- `search_attribute_values`
  - 属性に対して `suggest` を実行する
- `browse_attribute`
  - 属性に対して `breakdown` を実行する
- `locate_ids`
  - ID リストに対して `locate` を実行する
- `apply_filters`
  - 中間ノード選択を `aggregate` に反映する
- `get_dataframe`
  - 現在のセッションから `dataframe` を返す

## セッションの典型フロー

1. `start_session` に「パーキンソン病に関係する遺伝子を見たい」のような自然言語を渡す。必要に応じて `dataset: "ensembl_gene"` のように最終的に取得したい対象データセットも指定する
2. 必要なら `show_category_attributes` や `show_dataset_info` で候補カテゴリや dataset を確認する
3. 返ってきた属性候補に対して `search_attribute_values` や `browse_attribute` を呼ぶ
4. Parkinson disease で絞る場合は `disease_diseases_mesh` に対して `search_attribute_values` を呼ぶ
5. 選んだ中間ノードを `apply_filters` へ渡す
6. `show_session` でリーフノード数を確認する
7. `get_dataframe` で選択属性の対応表を返す

## 注意点

- TogoDX サーバに属性一覧 API がない前提で、属性カタログはローカル JSON から読む設計です
- `suggest` や `locate` のレスポンス形は実サーバ実装に依存するため、必要に応じて `mcp/lib/togodx-client.mjs` の整形を調整してください
- `dataset` パラメータには `attributes.dx-server.json` の `datasets` ブロックにあるキー名だけを使います。`dataframe` API の 1 列目の ID 体系もこのキーで指定します
- 病名で絞る典型例では、MeSH 属性 `disease_diseases_mesh` を使って node ID を探し、`dataset: "ensembl_gene"` と組み合わせて `aggregate` / `dataframe` へ進みます
