---
name: "sokqa-pack-factory-spec"
description: "SokQA Learning Pack Factoryの仕様と優先順位を要約する。仕様確認・実装方針を迷ったときに呼び出す。"
---

# SokQA Pack Factory Spec

## 目的

- `Generate -> Validate -> ZIP Export -> output/` を成立させる
- Trae Skills 主導のローカル OSS に再定義する

## バージョン

- 仕様バージョン: **v0.5**
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
- `source_only`: 参照素材のみをベースに生成
- `source_plus`: 参照素材中心＋学習者向け補足
- `exact_text_document`: 参照テキストをそのまま document JSON に変換（quiz は生成しない、`quizCount` は 0 扱い）

## クイズ TTS の重要ルール

アプリ側で選択肢番号の読み上げを制御するため、生成側では番号を読み上げない。

- `tts.choiceTexts` には選択肢番号を入れない
- `tts.choicesText`（番号付き連結）は使わない
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
- `manifest`, QR, Vercel, `BASE_URL` を必須経路から外す
- `language` は config の `language` を使用する（固定ではない）
- `tts` フィールドは保持する
- Web UI は持たない
- 音声ファイルは生成しない

## 実行フロー

```text
User
-> Trae IDE
-> Skills
-> Document JSON / Quiz JSON / Metadata JSON
-> Validator
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
