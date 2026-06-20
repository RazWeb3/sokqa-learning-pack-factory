---
name: "llm-agents-orchestrator-sokqa"
description: "Analyzer→Pack Builder→Validator→ExporterのLLMワークフローを分割生成・再試行で安定化する。LLM出力が壊れる/長いときに呼び出す。"
---

# LLM Agents Orchestrator（SokQA）

## 目的

- Analyzer -> Pack Builder -> Validator -> Exporter の4段構成で安定稼働させる。
- JSON破損、過生成、検証漏れを防ぐ。

## バージョン

- 仕様バージョン: **v0.5**
- config-driven generation を前提とする

## 推奨の内部関数分割

- `analyzeReference(referenceText) -> Analyzer JSON`
- `buildPack(config, analyzerJson) -> { documents, quizzes, metadata }`
- `validatePack(pack) -> validation`
- `exportPack(pack) -> output/<pack-id>/ + learning-pack.zip`

## 生成の安定化ルール

- すべて JSON のみ出力する
- 生成後は必ず `JSON.parse` と shape check を通す
- 失敗時は同じ目的で最大3回まで再試行する
- `choices` は4件固定にする

## v0.5 設定駆動ルール

以下は固定ではなく、config に従う:

- quiz 数は `config.quizCount` に従う
- 各 quiz の問題数は `config.questionsPerQuiz` に従う（5問固定ではない）
- language は `config.language` に従う（`"en"` 固定ではない）
- document 数は `config.documentCount` に従う

## 複数 reference の扱い

- `reference.path`（単一）と `reference.paths`（複数）の両方を読み込む
- 複数参照は設定順に統合して1つの参照コンテキストにする
- 対応形式: `txt` / `md` / `pdf`
- 統合した参照ソース一覧は `metadata.references` に記録する

## クイズ TTS の重要ルール

- `tts.choiceTexts` には選択肢番号を入れない
- `tts.choicesText`（番号付き連結）は使わない
- `1番`, `2番`, `Option 1`, `Choice 1` のような番号読み上げを入れない
- `tts.choiceTexts` は `choices` と同じ順序の4件配列にする
- 各要素には選択肢本文の読み上げ補正のみを入れる

例:

```json
"choices": [
  "Reliable",
  "Responsible",
  "Reasonable",
  "Respectable"
],
"tts": {
  "choiceTexts": [
    "Reliable",
    "Responsible",
    "Reasonable",
    "Respectable"
  ]
}
```

## 再試行条件

以下のいずれかに該当した場合、同じ目的で再試行する:

- `documentCount` と生成 document 数が一致しない
- `quizCount` と生成 quiz 数が一致しない
- `questionsPerQuiz` と各 quiz の questions 数が一致しない
- `metadata.references` が reference inputs と一致しない
- `tts.choiceTexts` に番号が含まれている

## OSS制約ガード

- `document`, `quiz`, `metadata` を必須生成対象にする
- `manifest`, CDN URL, QR, Vercel deploy を必須経路に入れない
- ZIP はローカルで組み立てて `output/` に保存する
- Web API とブラウザ UI を前提にしない

## エラー時の差し戻し

- `Valid JSON only`
- `choices must be exactly 4`
- `answerIndex must be 0-3`
- `documentCount mismatch`
- `quizCount mismatch`
- `questionsPerQuiz mismatch`
- `metadata.references must match reference inputs`
- `choiceTexts must not contain choice numbers`
- `metadata must match generated files`
- `keep tts fields but do not validate audio quality`
- `write metadata.json, doc_NN.json, quiz_NN.json, learning-pack.zip`
