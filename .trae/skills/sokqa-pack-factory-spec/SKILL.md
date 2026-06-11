---
name: "sokqa-pack-factory-spec"
description: "SokQA Learning Pack Factoryの仕様と優先順位を要約する。仕様確認・実装方針を迷ったときに呼び出す。"
---

# SokQA Pack Factory Spec

## 目的

- `Generate -> Validate -> Download ZIP` を成立させる
- 誰でもローカルで learning pack を生成し、ZIP 共有できる OSS にする

## 固定スタック

- Next.js（App Router）+ TypeScript
- JSZip
- Vitest

## 生成物

- `metadata.json`
- `doc_01.json`
- `quiz_01.json`
- `learning-pack.zip`

## 重要制約

- `document`, `quiz`, `metadata` を必須にする
- ZIP はクライアント側で生成する
- `manifest`, QR, Vercel, `BASE_URL` を必須経路から外す
- `language: "en"` 固定
- `tts` フィールドは保持する

## API

- `POST /api/generate`
- 戻り値: `{ documents, quizzes, metadata, validation }`
- `/api/export-zip` は作らない
- `/api/download/*` は作らない
