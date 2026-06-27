---
name: "llm-agents-orchestrator-sokqa"
description: "AI IDE上の生成作業を Analyzer→Pack Builder→Validator→Exporter に分け、Factory仕様に沿って安定化する。Factory内LLM実装やLLM API呼び出しは前提にしない。"
---

# AI IDE Agents Orchestrator（SokQA）

## 目的

- AI IDE 上の生成作業を Analyzer -> Pack Builder -> Validator -> Exporter の4段構成で安定稼働させる。
- JSON破損、過生成、検証漏れを防ぐ。
- Factory は LLM API を呼ばない。AI IDE が生成し、Factory は仕様・検証・品質管理・ZIP Export を担う。
- content-engine、固定教材データ、テンプレートフォールバックを前提にしない。

## バージョン

- 仕様バージョン: **v0.8.6**
- config-driven generation を前提とする

## 推奨のAI IDE作業分割

- Analyzer: config / reference / profile / reference.mode を読み、生成計画を作る
- Pack Builder: Generation Specification に従って `documents`, `quizzes`, `metadata` を作る
- Validator: JSON構造、TTS、metadata、quality-report前提を確認する
- Exporter: Factoryのローカル出力規則に従い `output/<pack-id>/` と `learning-pack.zip` を確認する

これはAI IDE側の作業分割であり、Factory内にLLM orchestration実装を追加する指示ではない。

## 生成の安定化ルール

- すべて JSON のみ出力する
- 生成後は必ず `JSON.parse` と shape check を通す
- 失敗時は同じ目的で既定1回、最大2回まで再試行する
- 無限ループは禁止する
- 再試行後も低品質の場合は最後の生成結果を残し、quality-report に失敗理由が分かるようにする
- `choices` は4件固定にする

## v0.8.6 設定駆動ルール

以下は固定ではなく、config に従う:

- quiz 数は `config.quizCount` に従う
- 各 quiz の問題数は `config.questionsPerQuiz` に従う（5問固定ではない）
- language は `config.language` に従う（`"en"` 固定ではない）
- document 数は `config.documentCount` に従う

## metadata.profile

`metadata.profile` は必須。AI IDEは以下を生成に反映する:

- `targetUser`: 語彙、前提知識、例、説明の深さ
- `difficulty`: 問題の推論量、誤答の近さ、documentの深さ
- `learningStyle`: audio / reading / quiz / balanced の学習体験
- `outputMode`: study / training / exam の目的
- `tone`: friendly / professional / academic の文体
- `detailLevel`: short / normal / detailed の本文密度
- `exampleLevel`: none / few / many の例示量
- `audioOptimization`: 音声向け最適化
- `quizStyle`: concept-check / application / case-study
- `distractorSource`: fixed / theme / reference
- `explanationDepth`: short / standard / detailed
- `practicalExamples`: 実例の要否
- `sentenceLength`: short / medium / long

## 複数 reference の扱い

- `reference.path`（単一）と `reference.paths`（複数）の両方を読み込む
- 複数参照は設定順に統合して1つの参照コンテキストにする
- 対応形式: `txt` / `md` / `pdf`
- 統合した参照ソース一覧は `metadata.references` に記録する

## reference.mode

- `none`: 参照なしで `theme` / `title` / `description` から教育的に生成する。テンプレートだけで埋めない
- `source_only`: 参照素材のみで生成し、外部知識を追加しない
- `source_plus`: 参照素材を中心に、学習者向け補足・例・文脈を加える
- `exact_text_document`: 原文を保持し、要約・言い換え・追加・quiz生成をしない

## Generation Specification

Document:

- 学習順序を持たせる
- 複数documentでは役割を分ける
- 重複した見出し構造や本文展開を避ける
- 実例はテーマ固有にする
- 専門用語を説明する
- `targetUser` と `difficulty` を内容へ反映する

Quiz:

- 各questionは異なる観点を扱う
- 誤答肢はテーマに沿った、もっともらしい誤答にする
- 正答位置を偏らせない
- 解説は正答・誤答の両方を説明する
- `quizStyle`, `distractorSource`, `explanationDepth` を反映する

TTS:

- `tts.choiceTexts` のみを使う
- 選択肢番号を含めない
- 略語、数字、記号、多言語、インライン言語切替、句読点を自然に扱う
- label-only の読み上げを避ける

## クイズ TTS の重要ルール

- `tts.choiceTexts` には選択肢番号を入れない
- quiz TTS の選択肢フィールドは `tts.choiceTexts` のみを使う
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
- `metadata.profile` が欠落している
- `tts.choiceTexts` に番号が含まれている
- `quality-report.json` の score が低い
- `duplicateQuestionRate` / `duplicateDocumentRate` が高い
- `genericDistractors` / `genericExplanations` が多い

再試行上限:

- default: 1回
- max: 2回
- それ以上は禁止
- document問題はdocument再生成、quiz問題はquiz再生成、複合問題は全体再生成を検討する

## Quality Validation

生成後は `quality-report.json` を確認する。

- `score`（Quality Score）
- `duplicateQuestionRate`
- `duplicateDocumentRate`
- `genericDistractors`
- `genericExplanations`
- `warnings`

`quality-report.json` は `learning-pack.zip` の隣に保存され、ZIPには含めない。

## OSS制約ガード

- `document`, `quiz`, `metadata` を必須生成対象にする
- `manifest`, CDN URL, QR, Vercel deploy を必須経路に入れない
- ZIP はローカルで組み立てて `output/` に保存する
- Web API とブラウザ UI を前提にしない
- Factory内LLM、content-engine、固定教材データ、テンプレートフォールバックを前提にしない

## エラー時の差し戻し

- `Valid JSON only`
- `choices must be exactly 4`
- `answerIndex must be 0-3`
- `documentCount mismatch`
- `quizCount mismatch`
- `questionsPerQuiz mismatch`
- `metadata.references must match reference inputs`
- `metadata.profile is required`
- `choiceTexts must not contain choice numbers`
- `metadata must match generated files`
- `quality-report indicates low quality`
- `write metadata.json, doc_NN.json, quiz_NN.json, learning-pack.zip`
