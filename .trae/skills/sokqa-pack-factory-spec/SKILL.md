---
name: "sokqa-pack-factory-spec"
description: "SokQA Learning Pack Factoryの仕様と優先順位を要約する。仕様確認・実装方針を迷ったときに呼び出す。"
---

# SokQA Pack Factory Spec

## 目的

- `Generate -> Validate -> ZIP Export -> output/` を成立させる
- Trae Skills 主導のローカル OSS に再定義する

## 固定スタック

- TypeScript
- JSZip
- Vitest

## 生成物

- `metadata.json`
- `doc_01.json`
- `quiz_01.json`
- `learning-pack.zip`

## 重要制約

- `document`, `quiz`, `metadata` を必須にする
- ZIP は `output/<pack-id>/learning-pack.zip` として保存する
- `manifest`, QR, Vercel, `BASE_URL` を必須経路から外す
- `language: "en"` 固定
- `tts` フィールドは保持する
- Web UI は持たない

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
- `examples`
- `templates`
- `output`
