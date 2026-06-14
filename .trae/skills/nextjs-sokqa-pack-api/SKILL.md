---
name: "nextjs-sokqa-pack-api"
description: "Skill名は維持しつつ、現在は scripts ベースで learning pack を生成・検証し、ZIP を output/ へ保存する手順。"
---

# Local Learning Pack Export Flow

## ゴール

- `document`, `quiz`, `metadata`, `validation` をローカルで生成する。
- `learning-pack.zip` を `output/<pack-id>/` に保存する。

## 実行構成

- `scripts/generate-learning-pack.ts`
  - 入力: `--input <file>` または `--text <content>`
  - 出力: `output/<pack-id>/`
  - 内部フロー: Analyzer -> Pack Builder -> Validator -> Exporter

## 実装しないもの

- manifest URL の生成
- `BASE_URL`
- `vercel --prod`
- Next.js API
- Browser Download UI

## エクスポート内容

- `metadata.json`
- `doc_01.json`
- `quiz_01.json`
- `learning-pack.zip`
