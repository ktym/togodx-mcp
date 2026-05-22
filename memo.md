# 引き継ぎメモ

## 目的

TogoDX の API を背後に持つ、自然言語主導の MCP サーバを作ること。最終的には、ユーザーが自然言語で属性選択を進め、中間ノードを絞り込み、`dataframe` を返せるようにする。

## 現在の状態

- 骨格実装はできている
- MCP サーバは `stdio` で起動する
- 属性候補を自然言語から探す簡易マッチャがある
- セッションを保持しながら `suggest`、`breakdown`、`locate`、`aggregate`、`dataframe` を呼ぶ流れがある
- テストは最低限通っている

## 重要ファイル

- [README.md](/Users/ktym/git/togodx-mcp/README.md:1)
- [mcp/togodx-mcp-server.mjs](/Users/ktym/git/togodx-mcp/mcp/togodx-mcp-server.mjs:1)
- [mcp/lib/togodx-client.mjs](/Users/ktym/git/togodx-mcp/mcp/lib/togodx-client.mjs:1)
- [mcp/lib/attribute-matcher.mjs](/Users/ktym/git/togodx-mcp/mcp/lib/attribute-matcher.mjs:1)
- [config/togodx-mcp.example.json](/Users/ktym/git/togodx-mcp/config/togodx-mcp.example.json:1)
- [config/togodx-human.attributes.example.json](/Users/ktym/git/togodx-mcp/config/togodx-human.attributes.example.json:1)

## まず最初にやること

1. 実際の TogoDX API に接続できる環境で、各エンドポイントのリクエストとレスポンスを確認する
2. `baseUrl` が本当に `https://togodx.dbcls.jp/api/human` でよいか確認する
3. `suggest` が GET なのか、`breakdown` / `locate` / `aggregate` / `dataframe` の JSON 形式が今の仮定と一致するか確認する
4. 本物の属性一覧を集めて、属性カタログ JSON を 64 属性ぶん整備する

## 実装上の前提

- 属性一覧 API はない前提で作っている
- そのため、属性カタログはローカルファイル読み込み
- セッションはメモリ上 `Map` 保持
- 永続化はしていない
- レスポンス整形も最小限

## たぶん修正が必要になる点

- `suggest` のクエリパラメータ名
- `breakdown` のボディ形式
- `locate` のレスポンス JSON の読み方
- `aggregate` 結果からリーフノード配列を取り出すロジック
- `dataframe` が期待する `queries` と `annotations` の形

## ローカル確認コマンド

```bash
cd /Users/ktym/git/togodx-mcp
npm test
node mcp/togodx-mcp-server.mjs
```

## このセッションで確認済みのこと

- `npm test` は通過
- `initialize` と `tools/list` のスモークテストは通過
- 外部ネットワーク制限のため、実 API 接続は未確認

## 進め方のおすすめ

1. 実 API に対する簡単な疎通スクリプトを書く
2. レスポンス形に合わせて `togodx-client.mjs` を調整する
3. 属性カタログを本番仕様で整備する
4. 代表的な探索シナリオで E2E テストを追加する
5. 必要なら `Projection` 非対応であることを README にさらに明記する

## 補足

- 前半の作業は誤って別リポジトリに書いてしまったが、現在は `togodx-mcp` に整理済み
- 元のリポジトリ側は差し戻してある
