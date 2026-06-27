---
name: "sokqa-pack-factory-spec"
description: "SokQA Learning Pack Factoryの仕様と優先順位を要約する。仕様確認・実装方針を迷ったときに呼び出す。"
---

# SokQA Pack Factory Spec

## 目的

- `Generate -> Validate -> ZIP Export -> output/` を成立させる
- AI IDE（Trae / Codex / ZCode 等）が生成を担当し、Factory は生成仕様・品質管理・JSON仕様・ZIP Export を提供する
- Factory 内に LLM API、content-engine、固定教材データ、テンプレートフォールバックを追加しない

## バージョン

- 仕様バージョン: **v0.8.6**
- Local-first CLI ワークフロー
- config-driven generation を主経路とする

## 固定スタック

- TypeScript
- JSZip
- Vitest

## 生成物

- `metadata.json`
- `doc_NN.json`（documentCount に応じて `doc_01.json`, `doc_02.json`, ... を生成）
- `quiz_NN.json`（quizCount に応じて `quiz_01.json`, `quiz_02.json`, ... を生成）
- `learning-pack.zip`
- `quality-report.json`（ZIP外。`learning-pack.zip` の隣に出力）

固定で1ファイルずつではなく、`documentCount` / `quizCount` で出力ファイル数を決める。

## 設定（config）

config-driven generation が主経路。`configs/<name>.json` を編集して生成を制御する。

- `id`
- `title`
- `description`
- `theme`
- `language`（`config.language` を使用、`"en"` 固定ではない）
- `documentCount`
- `quizCount`
- `questionsPerQuiz`
- `outputDir`
- `reference.enabled`
- `reference.path`（単一参照）
- `reference.paths`（複数参照）
- `reference.mode`

## metadata.profile

`metadata.json` には解決済み profile を `metadata.profile` として記録する。
AI IDE は以下を生成内容へ反映する。

- `targetUser`: 語彙、前提知識、例、説明の深さ
- `difficulty`: 理解の深さ、推論量、誤答の近さ
- `learningStyle`: audio / reading / quiz / balanced に応じた構成
- `outputMode`: study / training / exam の目的
- `tone`: friendly / professional / academic の文体
- `detailLevel`: short / normal / detailed の本文密度
- `exampleLevel`: none / few / many の例示量
- `audioOptimization`: 音声向け最適化
- `quizStyle`: concept-check / application / case-study の問題形式
- `distractorSource`: fixed / theme / reference の誤答生成方針
- `explanationDepth`: short / standard / detailed の解説量
- `practicalExamples`: 実例を入れるか
- `sentenceLength`: short / medium / long の文長

## 複数 document / 複数 quiz

- `documentCount` に従って `doc_NN.json` を生成する
- `quizCount` に従って `quiz_NN.json` を生成する
- 各 quiz の問題数は `questionsPerQuiz` に従う

## 複数 reference

- `reference.path`（単一）と `reference.paths`（複数）の両方に対応する
- 複数参照は設定順に統合して1つの参照コンテキストとして扱う
- 対応形式: `txt` / `md` / `pdf`
- 入力ソース一覧は `metadata.references` に記録する

## reference.mode

- `none`: 参照なしで `theme` / `title` / `description` から生成
- `source_only`: 参照素材のみをベースに生成し、外部知識を追加しない
- `source_plus`: 参照素材中心＋学習者向け補足。参照内容から離れすぎない
- `exact_text_document`: 参照テキストをそのまま document JSON に変換。要約・言い換え・追加・quiz生成をしない（`quizCount` は 0 扱い）

## Document 生成仕様

- 各 document は学習順序を持つ: 導入 -> 基礎 -> 構造 -> 応用 -> 実例 -> よくある誤解 -> まとめ
- 複数 document では役割を分ける（例: `doc_01` 基礎、`doc_02` 応用、`doc_03` 実践例）
- 同じ見出し構造・同じ本文展開を繰り返さない
- 実例はテーマ・targetUser・outputMode に即した具体例にする
- 専門用語は初出時に説明する
- `difficulty` と `targetUser` を内容の深さへ反映する

## Quiz 生成仕様

- 各 question は異なる観点を扱う
- 4択固定、正答は1つ
- `answerIndex` は `0-3` で、同じ位置に偏らせない
- 誤答肢はテーマに沿った、もっともらしい誤答にする
- 汎用的な誤答（例: "skip the basics"）を使わない
- 解説は正答理由と誤答が誤りである理由を説明する
- `quizStyle` と `difficulty` を問題形式・推論量へ反映する

## クイズ TTS の重要ルール

アプリ側で選択肢番号の読み上げを制御するため、生成側では番号を読み上げない。

- `tts.choiceTexts` には選択肢番号を入れない
- quiz TTS の選択肢フィールドは `tts.choiceTexts` のみを使う
- `1番`, `2番`, `Option 1`, `Choice 1` のような番号読み上げを入れない
- `tts.choiceTexts` は `choices` と同じ順序の4件配列にする
- 各要素には選択肢本文の読み上げ補正のみを入れる
- 選択肢番号や接続語はアプリ側で処理する

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

禁止例:

```json
"choiceTexts": [
  "1番 Reliable",
  "2番 Responsible",
  "3番 Reasonable",
  "4番 Respectable"
]
```

## 重要制約

- `document`, `quiz`, `metadata` を必須にする
- ZIP は `output/<pack-id>/learning-pack.zip` として保存する
- `quality-report.json` は `learning-pack.zip` の隣に保存し、ZIPには含めない
- `manifest`, QR, Vercel, `BASE_URL` を必須経路から外す
- `language` は config の `language` を使用する（固定ではない）
- `tts` フィールドは保持する
- Web UI は持たない
- 音声ファイルは生成しない

## Quality Validation

生成後は `quality-report.json` で品質を確認する。

- `score`: 0-100 の Quality Score
- `duplicateQuestionRate`: 重複した quiz question の割合
- `duplicateDocumentRate`: 重複した document の割合
- `genericDistractors`: 汎用的な誤答肢の件数
- `genericExplanations`: 汎用的な解説の件数
- `warnings`: 重複や汎用表現の詳細

品質が低い場合は、対象を絞って再生成する。

- document 重複: document のみ
- quiz 重複: quiz のみ
- 汎用誤答肢: quiz のみ
- 汎用解説: quiz のみ
- document/quiz 両方が低品質: 全体

再生成は無限に行わない。既定1回、最大2回を上限とする。

## 実行フロー

```text
User
-> Trae IDE
-> Skills
-> Factory Generation Specification / Quality Rules
-> Document JSON / Quiz JSON / Metadata JSON
-> Validator
-> quality-report.json
-> ZIP Export
-> output/
```

## 主要ディレクトリ

- `.trae/skills`
- `scripts`
- `configs`
- `examples`
- `references`
- `templates`
- `lib`
- `output`
