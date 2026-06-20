---
title: SokQA Learning Pack Factory OSS Edition Spec v0.5
---

# Learning Pack Generator Powered by Trae Skills

## 背景

このプロジェクトの価値は Web UI ではなく、Trae Skills による学習パック生成にある。

旧定義:

```text
SokQA Import Tool
```

新定義:

```text
Learning Pack Generator powered by Trae Skills
```

## 目的

ユーザーが Trae IDE 上でテーマや教材を入力し、Trae Skills が以下を実行する。

- 分析
- 教材生成
- クイズ生成
- 検証
- ZIP Export

## 実行フロー

```text
User
-> Trae IDE
-> Skills
-> Document JSON
-> Quiz JSON
-> Metadata JSON
-> Validator
-> ZIP Export
-> output/
```

## リポジトリ定義

- このリポジトリは Web サービスではない
- ローカル実行の Skills + scripts ツールである
- Next.js UI は削除する
- 生成物は `output/<pack-id>/` に保存する

## 推奨ディレクトリ構成

```text
.trae/
skills/
scripts/
examples/
templates/
output/
README.md
LICENSE
```

## 生成物

必須:

- `metadata.json`
- `doc_01.json`
- `doc_02.json` ... `doc_NN.json`
- `quiz_01.json`
- `quiz_02.json` ... `quiz_NN.json`
- `learning-pack.zip`

保存先例:

```text
output/customer-service-pack/
  doc_01.json
  doc_02.json
  doc_03.json
  quiz_01.json
  quiz_02.json
  metadata.json
  learning-pack.zip
```

`metadata.json` は manifest の代替であり必須。

例:

```json
{
  "id": "customer-service-pack",
  "title": "Customer Service Training",
  "version": "0.5.0",
  "references": ["manual.txt", "faq.md", "policy.pdf"],
  "documents": ["doc_01.json", "doc_02.json", "doc_03.json"],
  "quizzes": ["quiz_01.json", "quiz_02.json"]
}
```

## JSON仕様

### document

- `type = "document"`
- `schemaVersion = 1`
- `language = "en"`
- `documents[].id = doc-N`
- `documents[].text` を持つ
- `documents[].tts.text` を持つ

### quiz

- `type = "quiz"`
- `schemaVersion = 1`
- `language = "en"`
- `questions[].id = q-N`
- `choices` は 4 件固定
- `answerIndex` は `0-3`
- `tts.questionText`
- `tts.choicesText`
- `tts.answerText`
- `tts.explanationText`

### metadata

- `id`
- `title`
- `description`
- `createdAt`
- `generator`
- `version`
- `source.hasReference`
- `source.mode`
- `source.path`
- `references`
- `documents`
- `quizzes`

## Reference仕様

- `reference.path` は後方互換として維持する
- `reference.paths` で複数資料入力を受け付ける
- 対応形式は `txt` / `md` / `pdf`
- 複数資料は入力順で結合し 1 つの Reference Context として扱う
- `metadata.references` に入力ファイル名を記録する

### Reference Modes

- `none`: 参照資料なし
- `source_only`: 参照資料のみで生成
- `source_plus`: 参照資料を中心に補足付きで生成
- `exact_text_document`: 原文のみで document JSON 化し quiz は生成しない

## Validator方針

必須検証対象:

- `document`
- `quiz`
- `metadata`

Validator が行うこと:

- `JSON.parse`
- 型チェック
- 存在チェック
- `choices.length === 4`
- `answerIndex` 範囲チェック
- metadata と出力ファイル一覧の整合性チェック
- `documentCount` と document 数の整合性チェック
- `quizCount` と quiz 数の整合性チェック
- `questionsPerQuiz` と各 quiz 問題数の整合性チェック
- ZIP 内ファイル一覧と metadata の整合性チェック
- `exact_text_document` では quiz が 0 件であること

TTS 方針:

- `tts` フィールドは保持する
- 音声生成はしない
- 音声品質は検証しない
- 構造のみ検証する

## Skill Architecture

維持する Skill 名:

- `sokqa-pack-factory-spec`
- `llm-agents-orchestrator-sokqa`
- `sokqa-json-shape-tts-validator`
- `nextjs-sokqa-pack-api`

役割:

- `sokqa-pack-factory-spec`: 生成ルール定義
- `llm-agents-orchestrator-sokqa`: Analyzer -> Pack Builder -> Validator -> Exporter
- `sokqa-json-shape-tts-validator`: JSON / TTS 構造検証
- `nextjs-sokqa-pack-api`: 名前は維持し、内容は ZIP Export 前提へ更新

## README方針

削除:

- Vercel
- QRコード
- Manifest URL
- BASE_URL
- CDN

追加:

- Trae Skills
- Local First
- ZIP Export
- Examples
- Templates

## .gitignore

追加対象:

```text
output/
*.zip
.env
node_modules/
```

生成物は Git 管理しない。

## ロードマップ

### v0.2

- ZIP Export
- README刷新
- OSS化

### v0.3

- Config-driven generation
- Reference modes
- Exact text document mode

### v0.4

- Multiple Documents
- Multiple Quiz Packs
- questionsPerQuiz-driven quiz output
- metadata / ZIP consistency checks

### v0.5

- Multiple Reference Sources
- PDF Reference Support
- Markdown Reference Support
- Multiple Reference Files

### v0.6

- Output Format Improvements
- Markdown Export
- Validation Improvements
- Pack Consistency Check

### v0.7

- Generation Quality Controls
- Difficulty Settings
- Target Audience Settings
- Quiz Generation Controls

## 非目標

実施しない:

- QRコード
- Manifest URL
- CDN
- Vercel Deploy
- Static Hosting
- Base64 URL
- PDF Export
- SaaS化

## 完了条件

- Trae Skills のみで生成できる
- `document JSON` 生成成功
- `quiz JSON` 生成成功
- `metadata.json` 生成成功
- Validation 成功
- ZIP 出力成功
- `output/` 保存成功
- `README.md` 更新完了
- OSS として公開可能

## 最終目標

誰でも Trae IDE で利用できる Skill Driven Learning Pack Generator として成立させる。
