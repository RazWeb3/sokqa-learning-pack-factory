---
name: "nextjs-sokqa-pack-api"
description: "Legacy skill name. Currently used for local generation and ZIP export workflow."
---

# Local Learning Pack Export Flow

> Legacy skill name. Currently used for local generation and ZIP export workflow.

## バージョン

- 仕様バージョン: **v0.5**
- Local-first CLI ワークフロー
- config-driven generation を主経路とする

## ゴール

- `document`, `quiz`, `metadata`, `validation` をローカルで生成する。
- `learning-pack.zip` を `output/<pack-id>/` に保存する。

## 実行構成

- `scripts/generate-learning-pack.ts`
  - 主経路: `--config <config.json>`
  - 入力: `--config` で config-driven generation
  - 補助: `--input <file>` または `--text <content>`（アドホック）
  - 出力: `output/<pack-id>/`
  - 内部フロー: Analyzer -> Pack Builder -> Validator -> Exporter

## 実行例

```bash
npm run generate -- --config configs/no-reference-topic.json
npm run generate -- --config configs/multiple-docs-quizzes.json
npm run generate -- --config configs/multiple-references.json
```

アドホック実行（config なし）:

```bash
npm run generate -- --input examples/customer-service.txt
npm run generate -- --text "Customer service basics..."
```

## 出力ファイル

`documentCount` / `quizCount` に応じて生成される:

- `metadata.json`
- `doc_NN.json`（`doc_01.json`, `doc_02.json`, ...）
- `quiz_NN.json`（`quiz_01.json`, `quiz_02.json`, ...）
- `learning-pack.zip`

## 実装しないもの

- manifest URL の生成
- `BASE_URL`
- `vercel --prod`
- Next.js API
- Browser Download UI

## 実装しないこと（旧前提からの削除）

- Next.js API / Browser UI は前提にしない
- 単一 `doc_01.json` / `quiz_01.json` 固定ではなく、`documentCount` / `quizCount` に従う
- `language: "en"` 固定ではなく、config の `language` に従う
