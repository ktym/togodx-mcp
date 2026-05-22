# TogoDX MCP Server

TogoDX の `breakdown` / `suggest` / `locate` / `aggregate` / `dataframe` API を、自然言語で属性候補を探しながら段階的に使うための MCP サーバです。

## 構成

- `mcp/togodx-mcp-server.mjs`
  - `stdio` で動く依存なしの MCP サーバ
- `mcp/lib/togodx-client.mjs`
  - TogoDX API クライアント
- `mcp/lib/attribute-matcher.mjs`
  - 自然言語クエリから属性候補をランキング
- `config/togodx-mcp.example.json`
  - API のベース URL、データセット、属性カタログの設定
- `config/togodx-human.attributes.example.json`
  - 属性メタデータのサンプル
- `test/*.test.mjs`
  - 最低限のユニットテスト

## できること

- 自然言語から属性候補を探して探索セッションを開始する
- 属性ごとに `suggest` / `breakdown` / `locate` を呼ぶ
- 選んだ中間ノードを `aggregate` に渡してリーフノード集合を更新する
- 最後に `dataframe` を返す

## 使い方

1. `config/togodx-human.attributes.example.json` をベースに、実際の属性 ID とラベルを持つカタログ JSON を用意する
2. `config/togodx-mcp.example.json` をコピーして `baseUrl` と `attributesPath` を環境に合わせて変更する
3. 必要なら `TOGODX_MCP_CONFIG=/path/to/config.json` を指定して起動する

```bash
node mcp/togodx-mcp-server.mjs
```

`package.json` のスクリプトからでも起動できます。

```bash
npm run mcp:togodx
```

## ツール一覧

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

1. `start_session` に「パーキンソン病に関係する遺伝子を見たい」のような自然言語を渡す
2. 返ってきた属性候補に対して `search_attribute_values` や `browse_attribute` を呼ぶ
3. 選んだ中間ノードを `apply_filters` へ渡す
4. `show_session` でリーフノード数を確認する
5. `get_dataframe` で選択属性の対応表を返す

## 注意点

- TogoDX サーバに属性一覧 API がない前提で、属性カタログはローカル JSON から読む設計です
- `suggest` や `locate` のレスポンス形は実サーバ実装に依存するため、必要に応じて `mcp/lib/togodx-client.mjs` の整形を調整してください
- 今回のサンプル属性カタログは最小構成なので、実運用では 64 属性ぶんのメタデータを入れる前提です
