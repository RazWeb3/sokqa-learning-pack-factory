---
name: "nextjs-sokqa-pack-api"
description: "Next.js App RouterでSokQA pack生成→publicへ書き出し→静的配信する手順。生成ルートやファイル出力/URL組立で迷ったときに呼び出す。"
---

# Next.js SokQA Pack（静的ファイル方式）

## ゴール

- 生成した `manifest.json / doc_01.json / quiz_01.json` を `public/generated-pack/<packId>/` に書き出す。
- デプロイ後は `https://<domain>/generated-pack/<packId>/manifest.json` をQR化してSokQAにインポートする。

## ルート構成（最小・生成のみ）

- `POST /api/generate`（ローカル実行想定）
  - 入力: Textareaの生テキスト（日本語可）
  - 出力: `{ packId, manifestUrl }`
  - 内部で Analyzer → Pack Builder（docs+quiz）→ Publisher（ファイル書き出し+manifest生成）

## 書き出し先（DEMO）

- `public/generated-pack/<packId>/`
  - `manifest.json`
  - `doc_01.json`（必要なら `doc_02.json`）
  - `quiz_01.json`（5問ちょうど）

## URL組み立て（固定本番ドメイン）

- `BASE_URL` は `https://pe-gules.vercel.app` を固定で使う（プレビューURL不使用）。
- manifest の `items[].url` は:
  - `${BASE_URL}/generated-pack/${packId}/doc_01.json`
  - `${BASE_URL}/generated-pack/${packId}/quiz_01.json`

## デプロイ（任意）

- 書き出し後に `vercel --prod` を実行して本番URLを更新する（CLI/スクリプト）。
