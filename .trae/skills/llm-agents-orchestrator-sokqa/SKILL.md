---
name: "llm-agents-orchestrator-sokqa"
description: "Analyzer→Pack Builder→Validator→ExporterのLLMワークフローを分割生成・再試行で安定化する。LLM出力が壊れる/長いときに呼び出す。"
---

# LLM Agents Orchestrator（SokQA）

## 目的

- Analyzer -> Pack Builder -> Validator -> Exporter の4段構成で安定稼働させる。
- JSON破損、過生成、検証漏れを防ぐ。

## 推奨の内部関数分割

- `analyzeManualText(text) -> Analyzer JSON`
- `buildPack(analyzerJson) -> { documents, quizzes, metadata }`
- `validatePack(pack) -> validation`
- `exportPack(pack) -> output/<pack-id>/ + learning-pack.zip`

## 生成の安定化ルール

- すべて JSON のみ出力する
- 生成後は必ず `JSON.parse` と shape check を通す
- 失敗時は同じ目的で最大3回まで再試行する
- quiz は 5問固定、choices は 4件固定にする

## OSS制約ガード

- `document`, `quiz`, `metadata` を必須生成対象にする
- `manifest`, CDN URL, QR, Vercel deploy を必須経路に入れない
- ZIP はローカルで組み立てて `output/` に保存する
- `language` は全ファイル `"en"` 固定にする
- Web API とブラウザ UI を前提にしない

## エラー時の差し戻し

- `Valid JSON only`
- `choices must be exactly 4`
- `answerIndex must be 0-3`
- `metadata must match generated files`
- `keep tts fields but do not validate audio quality`
- `write metadata.json, doc_01.json, quiz_01.json, learning-pack.zip`
