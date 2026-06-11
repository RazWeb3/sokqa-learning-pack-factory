---
name: "nextjs-sokqa-pack-api"
description: "Next.js App Routerで learning pack の JSON生成と validation 結果返却を行い、ZIPはクライアント側で組み立てる手順。"
---

# Next.js Learning Pack API

## ゴール

- `POST /api/generate` で `document`, `quiz`, `metadata`, `validation` を返す。
- ZIP生成はブラウザ側の `JSZip` に任せる。

## ルート構成

- `POST /api/generate`
  - 入力: `{ text }`
  - 出力: `{ documents, quizzes, metadata, validation }`
  - 内部フロー: Analyzer -> Pack Builder -> Validator

## 実装しないもの

- `public/generated-pack/` への書き出し
- manifest URL の生成
- `BASE_URL`
- `vercel --prod`
- `/api/export-zip`
- `/api/download/*`
- 一時保存
- TTL管理

## クライアント側エクスポート

- `metadata.json`
- `doc_01.json`
- `quiz_01.json`
- `learning-pack.zip`
