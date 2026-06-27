---
name: "sokqa-json-shape-tts-validator"
description: "document/quiz/metadata JSON と quality-report 前提を v0.8.6仕様で検証する。複数document/quiz、複数reference、metadata.profile、choiceTexts番号なしルールを含む。"
---

# SokQA JSON / TTS Validator

## 目的

- 生成した `document` / `quiz` / `metadata` が再利用可能な learning pack として成立するかを検証する。
- 失敗時の再生成判断を明確にする。

## バージョン

- 仕様バージョン: **v0.8.6**

## 必須検証対象

- `document`（複数可）
- `quiz`（複数可）
- `metadata`
- `quality-report.json`（出力ディレクトリに存在。ZIP外）

## 必須チェック

### 基本

- `JSON.parse`
- 型チェック
- 存在チェック
- `schemaVersion === 1`
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
- `metadata.profile` の存在と整合性
- `metadata.profile` が現在の profile 仕様を含むこと
- `reference.paths` が空配列ではないこと（reference 有効時）
- 対応 reference 形式が `txt` / `md` / `pdf` のみであること

### metadata.profile

`metadata.profile` には以下を含める:

- `targetUser`
- `difficulty`
- `learningStyle`
- `outputMode`
- `tone`
- `detailLevel`
- `exampleLevel`
- `audioOptimization`
- `quizStyle`
- `distractorSource`
- `explanationDepth`
- `practicalExamples`
- `sentenceLength`

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
- `tts` の型と存在のみ確認する
- `tts.choiceTexts` は4件配列・番号なし（詳細は前節）
- TTS品質は構造検証とは別に quality-report / 生成仕様で確認する
- 略語、数字、記号、多言語、インライン言語切替、句読点は v0.8.4 Generation Specification に従う
- 出力先は `output/<pack-id>/` を前提にする

## Quality Validation

`quality-report.json` は `learning-pack.zip` の隣に出力し、ZIPには含めない。

確認対象:

- `score`
- `duplicateQuestionRate`
- `duplicateDocumentRate`
- `genericDistractors`
- `genericExplanations`
- `warnings`

品質上の再生成判断:

- `duplicateQuestionRate` が高い: quiz 再生成候補
- `duplicateDocumentRate` が高い: document 再生成候補
- `genericDistractors` が多い: quiz 再生成候補
- `genericExplanations` が多い: quiz 再生成候補
- score が低く複合的な問題がある: 全体再生成候補

再生成は既定1回、最大2回まで。無限ループは禁止。

## 再生成トリガー

- JSONとして壊れている
- `choices` が4件ではない
- `answerIndex` が範囲外
- `tts` が欠落している
- `documentCount` / `quizCount` / `questionsPerQuiz` のいずれかが不一致
- `metadata.references` が reference inputs と一致しない
- `metadata.profile` が欠落している
- `reference.paths` が空配列である（reference 有効時）
- 対応外の reference 形式が混入している
- `tts.choiceTexts` に番号読み上げが含まれている
- quiz TTS の選択肢フィールドが `tts.choiceTexts` ではない
- ZIP 内ファイル一覧が `metadata` と一致しない
- `quality-report.json` の品質指標が低品質を示している
