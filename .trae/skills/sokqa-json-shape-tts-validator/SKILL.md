---
name: "sokqa-json-shape-tts-validator"
description: "document/quiz/metadata JSON を検証し、manifest は optional として扱う。TTS は存在と型のみ確認する。"
---

# SokQA JSON / TTS Validator

## 目的

- 生成した `document` / `quiz` / `metadata` が再利用可能な learning pack として成立するかを検証する。
- 失敗時の再生成判断を明確にする。

## 必須検証対象

- `document`
- `quiz`
- `metadata`

optional:

- `manifest`

## 必須チェック

- `JSON.parse`
- 型チェック
- 存在チェック
- `choices.length === 4`
- `answerIndex` が `0-3`
- `metadata.documents` と document 出力数の整合性
- `metadata.quizzes` と quiz 出力数の整合性

## TTS の扱い

- `tts` フィールドは保持する
- 音声ファイルは生成しない
- 音声品質は検証しない
- `tts` の型と存在のみ確認する

## 再生成トリガー

- JSONとして壊れている
- `choices` が4件ではない
- `answerIndex` が範囲外
- `tts` が欠落している
- metadata のファイル一覧が生成物と一致しない

