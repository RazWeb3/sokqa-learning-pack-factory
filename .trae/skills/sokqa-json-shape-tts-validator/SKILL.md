---
name: "sokqa-json-shape-tts-validator"
description: "SokQAのdocument/quiz/manifest JSONを厳密に検証し、TTS規約もチェックする。生成後の検証や不具合調査で呼び出す。"
---

# SokQA JSON / TTS Validator

## 目的

- 生成した `document` / `quiz` / `pack_manifest` が “そのままSokQAにインポート可能” かを機械的に検証する。
- 失敗したら再生成（最大3回）するためのチェック項目を定義する。

## 必須スキーマ（フィールド名・ネスト・ID形式）

### Document（type: "document"）

- top:
  - `id` string
  - `type` === `"document"`
  - `schemaVersion` === 1
  - `title` string
  - `description` string
  - `language` === `"en"`
  - `globalTags` string[]
  - `documents` array
- documents[i]:
  - `id` 例: `"doc-1"`, `"doc-2"`…
  - `text` string
  - `tts.text` string

### Quiz（type: "quiz"）

- top:
  - `id` string
  - `type` === `"quiz"`
  - `schemaVersion` === 1
  - `title` string
  - `description` string
  - `language` === `"en"`
  - `globalTags` string[]
  - `questions` array（DEMOは “5問ちょうど”）
- questions[i]:
  - `id` 例: `"q-1"`, `"q-2"`…
  - `question` string
  - `choices` string[]（長さ4ちょうど）
  - `answerIndex` number（0–3）
  - `explanation` string
  - `tts.questionText` string
  - `tts.choicesText` string
  - `tts.answerText` string
  - `tts.explanationText` string

### Manifest（type: "pack_manifest"）

- top:
  - `id` string
  - `type` === `"pack_manifest"`
  - `schemaVersion` === 1
  - `title` string
  - `globalTags` string[]
  - `description` string
  - `language` string（デモ仕様では `en` を推奨。既存サンプルは `ja` の可能性あり）
  - `author` === `"Sokqa Team"`
  - `items` array
- items[i]:
  - `kind` === `"document"` | `"quiz"`
  - `url` string（フルの `https://...`）

## TTS規約（壊れると品質が落ちるので検出）

- 区切りはピリオド禁止、カンマ `,` を使う（文字列末尾も `,` で終える）。
- 日本語は `[ja-JP]` で開始し、文末は全角 `、` を推奨（サンプル準拠）。
- 英語に戻すときは `[en-US]`。
- quiz:
  - `tts.choicesText` は `Number 1, <c1>, Number 2, <c2>, Number 3, <c3>, Number 4, <c4>,`
  - `tts.answerText` は `The correct answer is Number X, <correct choice>,`

## 典型的な失敗パターン（再生成トリガー）

- JSONとして壊れている（末尾カンマ/引用符/エスケープ）。
- `choices` が4つではない、`answerIndex` が範囲外。
- `tts.*` が欠落、末尾が `,` で終わっていない。
- `items[].url` が https で始まらない、またはバッククォート等の余計な文字が含まれる。

