# HISTORY

## 2026-05-22

```
TogoDXとは [https://togodx.dbcls.jp/human/](https://togodx.dbcls.jp/human/) で私たちが公開しているデータ統合と探索的データ解析のためのプラットフォームで、概要は下記になります。

生命科学分野では、遺伝子、タンパク質、疾患、化合物、バリアントなど多様なデータを対象とした膨大な数のデータベースが構築されており、それらを活用したデータ駆動型研究が広く行われている。一方で、これらのデータベースはそれぞれ独立に開発されてきた背景から、データ形式、識別子体系、語彙、アクセス方法が異なっており、複数データベースを横断して利用することは依然として研究者に大きな負担を強いている。近年、RDFや知識グラフ、FAIR原則に基づくデータ統合基盤の整備により、異種生命科学データの相互運用性は向上しつつあるが、それらを研究者が直感的に探索し、俯瞰し、新たな知識発見へとつなげるためのインターフェースは十分に整備されていない。
我々はこの課題を解決するため、統合生命科学データを属性ベースで探索・俯瞰・抽出するウェブアプリケーションフレームワーク TogoDX (Togo Data eXplorer) を開発した。本フレームワークは、統合知識グラフ上に存在する多様な生命科学データを、データセット間の識別子変換を透過的に行いながら、統一的なインターフェースで探索可能にする。ショーケース実装としてヒト関連データを対象とした TogoDX/Human を構築し、8カテゴリ、20データベース、64種類の属性情報を統合した。
TogoDX/Human では、属性による絞り込み検索、属性マッピング、ユーザー所有IDリストの統合的解析という3つの探索様式を提供し、従来は複数の専門データベースを横断しなければ実現困難であった複雑なデータ探索を単一のアプリケーション上で可能にした。本研究は、統合知識グラフを研究者の知識発見へと接続する新たな探索インターフェースの実装事例を示すものである。

TogoDX では裏でAPIが動いています。これらは [togodx/togodx-server](https://github.com/togodx/togodx-server) にあるAPIで実装されています。
各属性は木構造のデータで、中間ノードを要素とし、リーフノードがDBのエントリのIDです。

Filterling用
* /breakdown/属性 は属性ごとに内訳を取得（表示用）
* /aggregate は属性ごとに指定された中間ノードのリストから、リーフノードの積集合を取得
* /suggest/属性 は属性ごとにキーワード検索を提供（曖昧検索用）

Map your IDs用
* /locate/属性 は属性ごとに該当する中間ノードを取得

ここまでで、選択された属性のリスト、中間ノードのリスト、リーフノードのリストが得られる。

結果表示
* /dataframe は選択された属性ごとに、リーフノードの対応表を生成

さらに、Projectionでは、選択された属性リスト以外の属性に対しても、リーフノードが該当する分布を見る機能を提供する。

これらの機能のうち、表示に必要な機能を省いて、自然言語で属性選択を進め結果のdataframeを返却するMCPサーバを構築してください。
```

このプロジェクトは、TogoDX の既存 Web UI のうち表示専用機能を除き、自然言語で属性選択を進めて最終的に `dataframe` を返却する MCP サーバとして新規に切り出す目的で作成された。

### 背景

- ユーザーから、TogoDX/Human の裏側で動作している API を利用し、MCP サーバとして以下の探索フローを提供したいという依頼があった
- 対象 API は以下
  - Filtering 用
    - `/breakdown/{attribute}`
    - `/aggregate`
    - `/suggest/{attribute}`
  - Map your IDs 用
    - `/locate/{attribute}`
  - 結果表示
    - `/dataframe`
- 各属性は木構造データであり、中間ノードを選択し、その配下のリーフノード集合を使って探索を進める前提
- UI 表示に必要な周辺機能は省き、自然言語から属性候補を探し、必要に応じて中間ノードを選び、最終的に `dataframe` を返すサーバを求められた

### 最初に行ったこと

- 当初、誤って別リポジトリの中で作業を始めた
- 誤配置のまま MCP 実装を追加したが、その後ユーザーから「別プロジェクトとして `~/git/togodx-mcp` に新規作成してほしい」と修正依頼があった

### 調査内容

- TogoDX の公開ページと `togodx/togodx-server` の実装が前提にあることを把握した
- この環境では外部ネットワークに制限があり、`curl https://togodx.dbcls.jp/human/` は名前解決エラーとなった
- そのため、実サーバに対する実 API 検証は行わず、ユーザーが提示した API 仕様と探索フローを基に薄いクライアントを設計した
- また、属性一覧 API の存在が不明なため、属性メタデータはローカルの JSON カタログとして与える設計にした

### 設計方針

- 実装言語は Node.js を選択した
  - 理由
    - 追加依存なしで `fetch` を利用できる
    - `stdio` ベースの MCP サーバを単一ファイルで実装しやすい
    - セッション状態をメモリ上に持つだけの用途に十分
- 構成は以下のように分割した
  - `mcp/togodx-mcp-server.mjs`
    - MCP プロトコルの `initialize`、`tools/list`、`tools/call` を処理する本体
    - セッション状態の保持
  - `mcp/lib/togodx-client.mjs`
    - TogoDX API クライアント
    - `breakdown`、`suggest`、`locate`、`aggregate`、`dataframe` を HTTP で実行
  - `mcp/lib/attribute-matcher.mjs`
    - 自然言語クエリから属性候補をスコアリングする軽量マッチャ
  - `config/togodx-mcp.example.json`
    - API ベース URL、データセット ID、属性カタログのパスを指定する設定
  - `config/togodx-human.attributes.example.json`
    - 属性メタデータの最小サンプル
  - `test/*.test.mjs`
    - 最低限のユニットテスト

### MCP サーバの実装内容

- サーバは `stdio` MCP として実装した
- MCP の対応内容
  - `initialize`
  - `notifications/initialized`
  - `tools/list`
  - `tools/call`
- サーバ情報
  - name: `togodx-natural-language`
  - version: `0.1.0`
  - protocolVersion: `2025-03-26`

### 実装したツール

- `start_session`
  - 自然言語リクエストから属性候補をランキングし、セッションを作成する
- `show_session`
  - 現在のセッション状態を返す
  - 選択済みフィルタ、候補属性、リーフノード数、リーフノードの先頭を含む
- `search_attributes`
  - 属性候補だけを追加で検索する
- `search_attribute_values`
  - 指定属性に対して `/suggest/{attribute}` を呼び、中間ノード候補を探す
- `browse_attribute`
  - 指定属性に対して `/breakdown/{attribute}` を呼び、木構造の内訳を確認する
- `locate_ids`
  - 指定属性に対して `/locate/{attribute}` を呼び、ユーザーの ID リストを中間ノードへ対応付ける
- `apply_filters`
  - 選択した中間ノードをフィルタへ反映し、`/aggregate` を呼んでリーフノード集合を更新する
- `get_dataframe`
  - 選択済み属性または明示指定の属性を使い、`/dataframe` を呼んで対応表を返す

### 自然言語属性マッチャの実装内容

- 属性マッチャはローカル属性カタログを対象に簡易スコアリングを行う
- スコアリング要素
  - 属性 ID の完全一致
  - ラベルの完全一致
  - ラベルや説明文への部分一致
  - クエリ語と属性説明語のトークン重なり
  - `keywords` や `synonyms` への一致
- 日本語と英語の混在を想定し、Unicode の文字クラスでトークン分割した
- 日本語助詞や一般的な英語ストップワードを除外した

### TogoDX API クライアントの実装内容

- `TogoDxClient` クラスを用意した
- 各メソッド
  - `breakdown(attributeId, body)`
  - `suggest(attributeId, keyword, limit)`
  - `locate(attributeId, queries)`
  - `aggregate(filters)`
  - `dataframe({ queries, annotations })`
- `dataset` はコンストラクタで保持し、各リクエストに含める設計
- `suggest` は GET、それ以外は JSON POST という前提で実装した
- レスポンス整形は最小限で、生データに近い JSON をそのまま返す方針とした

### セッション管理の実装内容

- セッションはメモリ上の `Map` で保持する
- セッションに含まれる情報
  - `id`
  - `dataset`
  - `request`
  - `filters`
  - `leafNodes`
  - `attributeMatches`
  - `createdAt`
- `apply_filters` では、同一属性への複数回選択をマージできるようにした
- `replace: true` を指定した場合はフィルタ全体を置き換える

### サンプル設定の内容

  - `config/togodx-mcp.example.json`
    - `baseUrl`: `https://togodx.dbcls.jp/human`
  - `dataset`: `human`
  - `attributesPath`: `config/togodx-human.attributes.example.json`
- `config/togodx-human.attributes.example.json`
  - 最小サンプルとして 4 属性のみ記載
    - `disease_diseases_nando`
    - `protein_disease_related_proteins_uniprot`
    - `gene_genes_ncbigene`
    - `variant_clinvar_clinvar`

### テストと確認

- `node --test` により 3 件のテストを通した
  - `rankAttributes matches Japanese keywords`
  - `findAttributeById returns the requested attribute`
  - `aggregate sends dataset and filters`
- `node --check` 相当の文法確認を当初の作業中に実施した
- `node -e` で子プロセスとしてサーバを起動し、以下の MCP 握手をスモークテストした
  - `initialize`
  - `tools/list`
- これにより、少なくともサーバが起動し、ツール一覧を返せることは確認した

### 作業場所の修正

- 誤って変更を入れていた `/Users/ktym/git/var-catalog-codex` から、以下を元に戻した
  - `README.md` への TogoDX MCP 追記
  - `package.json`
  - `mcp/`
  - `config/togodx-mcp.example.json`
  - `config/togodx-human.attributes.example.json`
  - `test/`
- その後、新規ディレクトリ `/Users/ktym/git/togodx-mcp` を作成し、実装一式を移設した

### このリポジトリに現在あるファイル

- `/Users/ktym/git/togodx-mcp/package.json`
- `/Users/ktym/git/togodx-mcp/README.md`
- `/Users/ktym/git/togodx-mcp/mcp/togodx-mcp-server.mjs`
- `/Users/ktym/git/togodx-mcp/mcp/lib/attribute-matcher.mjs`
- `/Users/ktym/git/togodx-mcp/mcp/lib/togodx-client.mjs`
- `/Users/ktym/git/togodx-mcp/config/togodx-mcp.example.json`
- `/Users/ktym/git/togodx-mcp/config/togodx-human.attributes.example.json`
- `/Users/ktym/git/togodx-mcp/test/attribute-matcher.test.mjs`
- `/Users/ktym/git/togodx-mcp/test/togodx-client.test.mjs`

### 未完了事項

- 実 TogoDX サーバへの API 接続確認
  - このセッションではネットワーク制限により未実施
- 属性カタログの本番整備
  - 64 属性すべてについて ID、ラベル、説明、キーワード、同義語を定義する必要がある
- 実レスポンス形式への追従
  - `suggest`、`locate`、`aggregate`、`dataframe` の実際の JSON 形に合わせて、必要であれば整形ロジックを追加する必要がある
- 例外処理の改善
  - API タイムアウト
  - 入力値検証
  - セッションサイズ上限
  - 空結果時のユーザー向けヒント
- 実運用向けドキュメント
  - Codex や他クライアントへの MCP 接続設定例
  - サンプルプロンプト集

### 次の担当者向け補足

- いまの実装は「MCP と探索フローの骨格」が主目的であり、TogoDX API への本番接続をまだ通していない
- そのため、最優先は実サーバ仕様に合わせた入出力の微調整である
- 属性カタログの質が自然言語探索の体験を大きく左右するため、ここは手を抜かない方がよい
