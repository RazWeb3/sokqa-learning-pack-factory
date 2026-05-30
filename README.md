# SokQA Learning Pack Factory

外国人スタッフ向けの研修教材づくりを、4〜8時間から数分へ。
マニュアルを貼り付けるだけで、SokQAにそのままインポートできる学習パック
（document / quiz / manifest）を自動生成します。

## 課題
コンビニ・飲食・ホテル・小売などの現場では、外国人スタッフ向け研修教材を
手作業で作っており、1パックあたり4〜8時間かかっていました。

## 解決
マニュアルを入力すると、AIエージェントのワークフローが
分析 → 学習文書 → クイズ → 音声読み上げテキスト → manifest を自動生成し、
QRコードからSokQAへインポートできます。カスタムスキーマは使わず、
SokQAの既存フォーマットにそのまま適合させています。

## 仕組み（4つのエージェント / スキル）
- 決める（spec）: 何を作るか・何をしないかを定める仕様
- 作る（orchestrator）: マニュアルから学習パックを安定して生成
- 配る（nextjs-api）: 生成物を書き出し、URLで配信
- 確かめる（validator）: SokQAに取り込める形かを検証

## 技術スタック
- Next.js (App Router) + TypeScript
- Vercel（静的配信）
- TRAE SOLO で開発

## 使い方（ローカル）
1. `npm install`
2. `.env.local` に `NEXT_PUBLIC_BASE_URL` を設定
3. `npm run dev` で起動し、http://localhost:3000 を開く
4. マニュアルを貼り付けて Generate
5. 生成された `public/generated-pack/<id>/` を `vercel --prod` でデプロイ
6. 表示されたQRコードからSokQAへインポート

## 現状と今後
コア機能（生成 → 配信 → QRインポート）を実装済み。
コンテンツ生成の精度は、LLM接続によりさらに高度化できる設計です。
本番ではドキュメント・クイズの本数を拡張可能です。

## ハッカソン
TRAE SOLO Hackathon @ Japan / Productivity Enhancement Track
