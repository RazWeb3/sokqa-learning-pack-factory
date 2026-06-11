---
title: SokQA Learning Pack Factory OSS Edition Spec v0.2
---

# Learning Pack Generator OSS

マニュアルやドキュメントのテキストから、再利用可能な学習パックJSONを生成し、検証し、ZIPとしてダウンロード可能にする。

## 成功指標

旧:

```text
SokQA Import Success
```

新:

```text
Generate -> Validate -> Download ZIP
```

## プロダクト定義

旧:

```text
Paste a manual and automatically generate a SokQA-ready learning pack.
```

新:

```text
Paste a manual and automatically generate reusable learning packs that can be downloaded and shared as ZIP files.
```

## 固定スコープ

- `npm install` でセットアップできる
- `npm run dev` でローカル起動できる
- テキストから `document JSON` を生成する
- テキストから `quiz JSON` を生成する
- `metadata.json` を生成する
- 生成結果を検証する
- ブラウザ側で `JSZip` を使って `learning-pack.zip` を生成する
- ZIP をダウンロードできる

## 必須ではないもの

以下は必須経路から除外する。

- `vercel --prod`
- `public/generated-pack/`
- QR code generation
- manifest URL generation
- fixed production domain
- `BASE_URL`
- SokQA import

将来機能として残す場合は Feature Flag 化する。

例:

```text
ENABLE_MANIFEST_EXPORT=false
```

## 出力物

ZIPファイル名:

```text
learning-pack.zip
```

ZIP内容:

```text
metadata.json
doc_01.json
quiz_01.json
```

`metadata.json` を manifest の代替として使う。外部URLは含めない。

例:

```json
{
  "id": "pack_20260611_001",
  "title": "Customer Service Training",
  "description": "Generated learning pack",
  "createdAt": "2026-06-11T00:00:00Z",
  "generator": "sokqa-learning-pack-factory",
  "version": "0.2.0",
  "documents": ["doc_01.json"],
  "quizzes": ["quiz_01.json"]
}
```

## API

`POST /api/generate`

入力:

```json
{
  "text": "..."
}
```

戻り値:

```json
{
  "documents": [],
  "quizzes": [],
  "metadata": {},
  "validation": {}
}
```

ルール:

- ZIP生成はサーバー側で行わない
- `/api/export-zip` は実装しない
- `/api/download/*` は実装しない
- 一時保存機構は実装しない
- TTL管理は実装しない
- ブラウザ側で `JSZip` を使って ZIP を組み立てる

## UI

旧:

```text
Generate
-> Manifest URL
-> QR
```

新:

```text
Generate
-> Validation Result
-> Download ZIP
```

表示要件:

```text
Generation Complete
Documents: 1
Quizzes: 1
Validation: Passed
[ Download Learning Pack ]
```

## JSON仕様

### document

- `type` は `"document"`
- `schemaVersion` は `1`
- `language` は `"en"`
- `documents[].id` は `doc-N`
- `documents[].text` を持つ
- `documents[].tts.text` を持つ

### quiz

- `type` は `"quiz"`
- `schemaVersion` は `1`
- `language` は `"en"`
- `questions[].id` は `q-N`
- `choices` は4件固定
- `answerIndex` は `0` から `3`
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
- `documents`
- `quizzes`

## Validator方針

必須検証対象:

- document
- quiz
- metadata

optional:

- manifest

このOSSでは音声ファイルは生成しない。ただし SokQA 互換維持のため `tts` フィールドは保持する。

validator は以下のみ行う。

- 型チェック
- 存在チェック
- `JSON.parse`
- `choices.length === 4`
- `answerIndex` の範囲チェック
- metadata と出力ファイル一覧の整合性チェック

音声品質は検証対象外。

## ワークフロー

維持する skill 名:

- `llm-agents-orchestrator-sokqa`
- `nextjs-sokqa-pack-api`
- `sokqa-json-shape-tts-validator`
- `sokqa-pack-factory-spec`

改名はしない。変更するのは中身のみ。

新しい内部フロー:

```text
Analyzer
-> Pack Builder
-> Validator
-> Exporter
```

`Publisher` の CDN / URL 前提は削除する。

## README方針

README から主役を外すもの:

- QR Import
- Manifest URL
- Vercel Deploy
- Static Hosting
- Production Domain
- `BASE_URL`

README の主役:

- What it does
- Document JSON
- Quiz JSON
- Metadata JSON
- ZIP Package
- Skill Driven Architecture

## ロードマップ

### v0.2

- ZIP Export
- `metadata.json`
- Manifest Dependency Removal

### v0.3

- Multiple Documents
- Multiple Quiz Packs

### v0.4

- Base64 Compressed Import URL Export

### v0.5

- PDF Export with Import URL

### v0.6

- Optional SokQA Manifest Export
- Optional CDN Export

## テスト

最低限追加する。

- Smoke Test: Generate -> Validate -> ZIP Download
- Validator Test: `JSON.parse`
- Validator Test: `choices length = 4`
- Validator Test: `answerIndex range`
- Validator Test: `metadata consistency`

## 完了条件

- `npm install` で起動準備できる
- `npm run dev` で動作する
- テキストから `document JSON` を生成できる
- `quiz JSON` を生成できる
- `metadata.json` を生成できる
- Validation を実行できる
- `JSZip` で ZIP を生成できる
- ZIP をダウンロードできる
- `README.md` 更新完了
- `.trae/skills` 更新完了
- Manifest / QR / Vercel が必須経路から除外されている
- スモークテスト成功

## 非目標

今回実施しない。

- SokQA Studio改修
- CDN構築
- QR最適化
- Base64圧縮改善
- PDF生成
- SaaS化
- 認証
- ユーザー管理

## 最終目標

誰でもローカルで実行し、学習パックを生成してZIPで共有できるOSSを完成させる。
