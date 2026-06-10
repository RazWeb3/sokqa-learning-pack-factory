---
name: "sokqa-pack-factory-spec"
description: "SokQA Learning Pack Factoryの仕様と優先順位を要約する。仕様確認・実装方針を迷ったときに呼び出す。"
---

# SokQA Pack Factory Spec

## 目的（デモのゴール）

- 画面に手順: Text paste → Generate JSON files → write to public/ → vercel --prod → 固定URL → QR → SokQA Import success
- “SokQA Import success” が成功指標。動的API/in-memory/CORS自前実装は使わない（静的配信）。

## 固定スタック

- Next.js（App Router）+ TypeScript
- Vercel（静的配信。生成JSONは `public/generated-pack/` に書き出す）
- QR: `qrcode.react`

## 生成物（DEMO）

- `/generated-pack/<packId>/manifest.json`
- `/generated-pack/<packId>/doc_01.json`（1–2本）
- `/generated-pack/<packId>/quiz_01.json`（5問ちょうど）

## 重要制約

- SokQA既存スキーマのみ（document / quiz / pack_manifest）。カスタムスキーマ禁止。
- 生成JSONは `JSON.parse` と shape check に通す。失敗時は最大3回まで再生成。
- 大きいJSONを一気に生成しない（小さく分割して結合）。
- `language: "en"` 固定（TTS内で `[ja-JP]` と `[en-US]` を切り替える）。

## デプロイの前提

- manifestの `items[].url` はフルの `https://<domain>/generated-pack/<packId>/<file>` にする。
- 本番ドメインは事前に確定させ、`BASE_URL` として固定する（プレビューURL不使用）。
