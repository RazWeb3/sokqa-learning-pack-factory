---
title: SokQA Learning Pack Factory（Trae SOLO Implementation Spec v3 / 静的ファイル方式）
---

# SokQA Learning Pack Factory

マニュアルのテキストから、SokQAにそのままインポートできる学習パック（manifest + docs + quiz）のJSONファイル群を生成し、Vercelに静的配信する。manifest URLをQRコードで表示してインポートする。

## デモの最優先ゴール（Phase 1）

```
Text Paste → Generate JSON files → write to public/ → vercel --prod → 固定URL → QR → SokQA Import success
```

- 成功指標は “SokQA Import success”
- 配信用の動的API・in-memory・CORS自前実装は使わない（静的配信に寄せる）

## なぜ静的ファイル方式か（設計の前提）

- 生成したJSONを Next.js の `public/generated-pack/<packId>/` に書き出し、`vercel --prod` でデプロイする。
- Vercelの静的配信はデフォルトで誰でもfetch可能 → CORS実装が不要。
- 一度デプロイすれば確実に永続配信 → 何度スキャンしても確実に読める（インスタンス依存なし）。
- 既存Convlyサンプル（manifestがフルURLでdoc/quizを指す）と同じ構造を再現できる。

## 本番ドメインの扱い（重要）

- manifestの `items[].url` はデプロイ先ドメインを含むフルURLにする。
- プレビューごとに変わるランダムURLではなく、プロジェクトの固定本番ドメイン（`https://<project-name>.vercel.app`）を使う（`vercel --prod` で反映）。
- デモ前に一度デプロイしてドメインを確定させ、`BASE_URL` に入れておく。

例:

```ts
const BASE_URL = "https://pe-gules.vercel.app"
```

## 当日の進め方（二段構え）

- メイン（①ライブ生成）: デモ前に一度デプロイ→本番ドメイン確定 → 当日テキスト貼り付け→生成→書き出し→`vercel --prod`→QR→インポート。
- フォールバック（②事前生成）: デモ用パックを1セット事前生成・デプロイ済みにしておき、QR表示とインポートだけは確実に見せられる状態にしておく。

## 固定スタック

- Next.js（App Router）+ TypeScript
- Vercel（静的配信。`public/generated-pack/` にJSONを書き出す）
- QR: `qrcode.react`
- LLM: 各agent stepごとにAPI呼び出し

## 生成物（DEMO）

`public/generated-pack/<packId>/` に書き出し:

```
manifest.json
doc_01.json     （1–2本）
quiz_01.json    （1本、5問ちょうど）
```

配信URL（デプロイ後）:

```
https://<domain>/generated-pack/<packId>/manifest.json
https://<domain>/generated-pack/<packId>/doc_01.json
https://<domain>/generated-pack/<packId>/quiz_01.json
```

## スキーマ（これ以外を作らない）

### A. document（type: "document"）

- top: `id`, `type`, `schemaVersion`, `title`, `description`, `language`, `globalTags`, `documents`
- item: `id`（`doc-1`..）, `text`, `tts.text`

最小例:

```json
{
  "id": "pack_x_doc_01",
  "type": "document",
  "schemaVersion": 1,
  "title": "Title",
  "description": "Desc",
  "language": "en",
  "globalTags": ["tag"],
  "documents": [
    { "id": "doc-1", "text": "Hello", "tts": { "text": "[en-US]Hello," } }
  ]
}
```

### B. quiz（type: "quiz"）

- top: `id`, `type`, `schemaVersion`, `title`, `description`, `language`, `globalTags`, `questions`
- item: `id`（`q-1`..）, `question`, `choices`（4つ固定）, `answerIndex`（0–3）, `explanation`,
  `tts.questionText`, `tts.choicesText`, `tts.answerText`, `tts.explanationText`

### C. manifest（type: "pack_manifest"）

- top: `id`, `type`, `schemaVersion`, `title`, `globalTags`, `description`, `language`, `author`, `items`
- items: `{ kind: "document"|"quiz", url: "https://..." }`

注意:

- `url` は “余計な文字なしのプレーンな文字列” にする（バッククォートや空白を入れない）。
- `url` はフルの `https://...`（相対パス不可）。`BASE_URL + "/generated-pack/<packId>/<file>"` で組み立てる。

## TTS規約（厳守）

1. 区切りはカンマ `,`（ピリオド禁止）。末尾も必ず `,`
2. 日本語は `[ja-JP]`、英語に戻すときは `[en-US]`
3. 日本語部分は全角 `、` を使う（サンプル準拠）
4. `tts.choicesText`（quiz）:
   - `Number 1, <c1>, Number 2, <c2>, Number 3, <c3>, Number 4, <c4>,`
5. `tts.answerText`（quiz）:
   - `The correct answer is Number X, <correct choice>,`

## 学習コンテンツの作り方（Listening Packの型）

各 document は、この流れを必ず含める（ジェネリックは禁止）:

1. Introduction（何を学ぶか）
2. Explanation（やさしい英語で説明）
3. Phrase Practice（丁寧/カジュアル、使う場面）
4. Mini Conversation（短い現場会話）
5. Review（復習・励まし）

ルール:

- `language` は全ファイル `"en"` 固定
- TTS内で `[ja-JP]` の日本語フレーズを挟む（日本語だけの教材にしない）

## Agentワークフロー（見せ方は4-agent / 実装は最小）

公開上は:

- Agent 1: Analyzer
- Agent 2: Pack Builder
- Agent 3: Quiz（見せ方）
- Agent 4: Publisher

実装はLLM呼び出しを減らすため:

- Analyzer（LLM 1回）
- Pack Builder（docs + quizを生成、quizは1問ずつで5問固定）
- Publisher（ファイル書き出し + manifest生成、LLM不要）

### Analyzerの出力（JSONのみ）

```json
{
  "training_topic": "",
  "target_role": "",
  "key_points": [],
  "service_phrases": [],
  "important_rules": [],
  "common_mistakes": []
}
```

## 書き出し & デプロイ（API配信なし）

### 書き出し

- `publishPack` で各JSONを `public/generated-pack/<packId>/<filename>` にファイル書き込みする。
- `packId` は短いランダム文字列（例: `nanoid` か `Date.now().toString(36)`）。
- manifestの `items[].url` は `BASE_URL + "/generated-pack/" + packId + "/" + filename`。

### デプロイ

- 書き出し後に `vercel --prod` を実行する（CLI / スクリプトから）。
- デプロイ完了後、`BASE_URL/generated-pack/<packId>/manifest.json` が有効になる。

### QR表示

- 結果画面で manifest URL をテキスト表示 + `qrcode.react` でQR表示する。
- QRに入れるのは manifest URLのみ（pack URLや生JSONを入れない）。
- ラベル: 「Scan to import into SokQA」

## 生成の安全運用（失敗しやすい点の対策）

- 生成直後に毎回 `JSON.parse` + shape check
- 失敗したら同じ目的で再生成（最大3回）
- doc/quizを巨大JSONで一括生成しない:
  - docはitemを分割生成→連結
  - quizは “1問ずつ” 生成して5問で停止

## サーバレス注意（DEMO）

- 本番URLは `vercel --prod` 反映後に安定する。プレビューURLは使わない。

## フォールバック（Vercelが不安定な場合）

- `convly.jp/sokqa/data/...` に静的配置して `items[].url` をそちらに向ける
- フォールバック②: デモ用パックを事前生成・デプロイ済みにし、QR表示とインポートだけは確実に見せられる状態を確保する
