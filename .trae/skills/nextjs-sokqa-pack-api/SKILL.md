---
name: "nextjs-sokqa-pack-api"
description: "Legacy skill name. Current role is local validation, quality-report, and ZIP export workflow guidance. It does not imply Next.js API, Factory LLM API integration, or browser UI."
---

# Local Learning Pack Export Flow

> Legacy skill name. Currently used for local generation and ZIP export workflow.

## バージョン

- 仕様バージョン: **v0.8.6**
- Local-first CLI ワークフロー
- config-driven generation を主経路とする

## ゴール

- AI IDE が生成した、または config-driven workflow で作られた `document`, `quiz`, `metadata` をローカルで検証する。
- `quality-report.json` を `learning-pack.zip` の隣に出力する。
- `learning-pack.zip` を `output/<pack-id>/` に保存する。
- Factory内LLM、content-engine、固定教材データ、テンプレートフォールバックは前提にしない。

## 実行構成

- `scripts/generate-learning-pack.ts`
  - 主経路: `--config <config.json>`
  - 入力: `--config` で config-driven generation
  - 補助: `--input <file>` または `--text <content>`（アドホック）
  - 出力: `output/<pack-id>/`
  - 役割: Factory仕様に沿ったローカル検証、quality-report、ZIP Export

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
- `quality-report.json`（ZIP外）
- `learning-pack.zip`

## 現行仕様の確認ポイント

- `metadata.profile` を保持する
- profile項目: `targetUser`, `difficulty`, `learningStyle`, `outputMode`, `tone`, `detailLevel`, `exampleLevel`, `audioOptimization`, `quizStyle`, `distractorSource`, `explanationDepth`, `practicalExamples`, `sentenceLength`
- `tts.choiceTexts` のみを使う
- `schemaVersion` は `1`
- `reference.mode` は `none` / `source_plus` / `source_only` / `exact_text_document`
- `exact_text_document` では quiz を生成しない
- `quality-report.json` で `score`, `duplicateQuestionRate`, `duplicateDocumentRate`, `genericDistractors`, `genericExplanations`, `warnings` を確認する
- 低品質時の再生成は既定1回、最大2回まで。無限ループは禁止

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
- Factory が LLM API を呼ぶ前提にしない
- content-engine や固定教材データを追加しない
