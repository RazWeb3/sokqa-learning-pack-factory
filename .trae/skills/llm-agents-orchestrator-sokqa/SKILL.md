---
name: "llm-agents-orchestrator-sokqa"
description: "Analyzer→Pack Builder→PublisherのLLMワークフローを分割生成・再試行で安定化する。LLM出力が壊れる/長いときに呼び出す。"
---

# LLM Agents Orchestrator（SokQA）

## 目的

- 仕様どおり “4-agentの見せ方” を保ちつつ、実装は最小の関数群で安定稼働させる。
- JSON破損・途中切れ・過生成（20問など）を防ぐ。

## 推奨の内部関数分割（最小）

- `analyzeManualText(text) -> Analyzer JSON`
- `buildPack(analyzerJson) -> { docs: object[], quiz: object }`
  - quizはここで生成してLLM呼び出しを削減
- `publishPack({docs, quiz}, baseUrl) -> { packId, manifest, manifestUrl }`
  - `public/generated-pack/<packId>/` にJSONを書き出す（静的配信用）

## 生成の安定化ルール

- すべて “JSONのみ出力” を要求（前後の説明文禁止）。
- 生成後は必ず:
  - `JSON.parse`
  - shape check
  - 失敗時は同一プロンプトでリトライ（最大3回）
- 文書/クイズを一括で巨大生成しない:
  - docは item を小さめに（例: 4〜6 items単位で追記生成→連結）
  - quizは “1問ずつ生成→配列に追加” して合計5問で停止

## デモ制約ガード（強制）

- doc: 1〜2ファイル、各 8〜12 items 目安（Listening Packの5段構成を含める）
- quiz: 5問ちょうど（choicesは4つ固定）
- `language` は全ファイル `"en"` 固定

## エラー時の再生成指示（短文で差し戻し）

- “有効なJSONのみで返す”
- “choicesは必ず4つ”
- “answerIndexは0〜3”
- “tts.* 末尾はカンマで終える”
- “manifest url は https:// から始まるフルURL（BASE_URL + /generated-pack/...）”
