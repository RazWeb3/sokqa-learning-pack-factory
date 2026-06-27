---
name: "sokqa-json-shape-tts-validator"
description: "document/quiz/metadata JSON を v0.5仕様で検証する。複数document/quiz、複数reference、choiceTexts番号なしルールを含む。TTS は存在と型のみ確認する。"
---

# SokQA JSON / TTS Validator

## 目的

- 生成した `document` / `quiz` / `metadata` が再利用可能な learning pack として成立するかを検証する。
- 失敗時の再生成判断を明確にする。

## バージョン

- 仕様バージョン: **v0.5**

## 必須検証対象

- `document`（複数可）
- `quiz`（複数可）
- `metadata`

## 必須チェック

### 基本

- `JSON.parse`
- 型チェック
- 存在チェック
- `choices.length === 4`
- `answerIndex` が `0-3`
- ZIP 内ファイル一覧と `metadata` の整合性

### 複数 document / 複数 quiz

- `documentCount` と document 出力数が一致すること
- `quizCount` と quiz 出力数が一致すること
- `questionsPerQuiz` と各 quiz の questions 数が一致すること
- `metadata.documents` と document 出力ファイル一覧の整合性
- `metadata.quizzes` と quiz 出力ファイル一覧の整合性

### 複数 reference

- `metadata.references` の存在と整合性
- `metadata.references` が reference inputs と一致すること
- `reference.paths` が空配列ではないこと（reference 有効時）
- 対応 reference 形式が `txt` / `md` / `pdf` のみであること

### ZIP 一貫性

- ZIP 内ファイル一覧が `metadata` と一致すること
- ZIP 内に `metadata.json`, `doc_NN.json`, `quiz_NN.json` がすべて含まれること

### クイズ TTS: choiceTexts ルール

- `tts.choiceTexts` がある場合、4件の配列であること
- `tts.choiceTexts` の各要素は選択肢本文のみを含み、選択肢番号を読み上げないこと
- quiz TTS の選択肢フィールドは `tts.choiceTexts` のみであること

#### 番号読み上げ禁止チェック

以下のパターンを検出したらエラーにする:

```text
1番
2番
3番
4番
Option 1
Option 2
Choice 1
Choice 2
No.1
No.2
```

### exact_text_document

- `mode` が `exact_text_document` の場合、quiz が生成されていないこと
- `exact_text_document` では `quizCount` を 0 として扱うこと

## TTS の扱い

- `tts` フィールドは保持する
- 音声ファイルは生成しない
- 音声品質は検証しない
- `tts` の型と存在のみ確認する
- `tts.choiceTexts` は4件配列・番号なし（詳細は前節）
- 出力先は `output/<pack-id>/` を前提にする

## 再生成トリガー

- JSONとして壊れている
- `choices` が4件ではない
- `answerIndex` が範囲外
- `tts` が欠落している
- `documentCount` / `quizCount` / `questionsPerQuiz` のいずれかが不一致
- `metadata.references` が reference inputs と一致しない
- `reference.paths` が空配列である（reference 有効時）
- 対応外の reference 形式が混入している
- `tts.choiceTexts` に番号読み上げが含まれている
- quiz TTS の選択肢フィールドが `tts.choiceTexts` ではない
- ZIP 内ファイル一覧が `metadata` と一致しない
