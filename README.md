# SokQA Learning Pack Factory

マニュアルやドキュメントを貼り付けるだけで、SokQAにそのまま取り込める学習パック
（document / quiz / manifest）を数分で自動生成します。

## 課題
コンビニ・飲食・ホテル・小売などの現場では、研修教材を手作業で作っており、
特に外国人スタッフ向けの教材は1パックあたり4〜8時間かかっていました。

## 解決
マニュアルを入力すると、4ステップのワークフロー
（分析 → 学習文書 → クイズ → manifest）が学習パックを自動生成し、
QRコードからSokQAへインポートできます。カスタムスキーマは使わず、
SokQAの既存フォーマットにそのまま適合させています。

## 仕組み（概念上の4ステップ / スキル定義）
アプリ内で4つのエージェントが別プロセスとして動くわけではなく、
設計ガイド（.trae/skills）として以下の役割を定義しています。
- 決める（spec）: 何を作るか・何をしないかを定める仕様
- 作る（orchestrator）: マニュアルから学習パックを安定して生成
- 配る（nextjs-api）: 生成物を書き出し、URLで配信
- 確かめる（validator）: SokQAに取り込める形かを検証

## 技術スタック
- Next.js (App Router) + TypeScript
- Vercel（静的配信）
- LLM API（OpenAI互換）
- TRAE SOLO で開発

## 使い方（ローカル）
1. `npm install`
2. `.env.local` に以下を設定
   - `OPENAI_API_KEY`（生成にLLMを使うため必須）
   - `NEXT_PUBLIC_BASE_URL`（manifestに埋め込むURL。インポート時に到達できる
     本番ドメインを `https://...` で指定。例: `https://pe-gules.vercel.app`）
3. `npm run dev` で起動し、http://localhost:3000 を開く
4. マニュアルを貼り付けて Generate
5. 生成された `public/generated-pack/<id>/` を `vercel --prod` でデプロイ
6. 表示されたQRコードからSokQAへインポート

## 生成物
- `manifest.json`
- `doc_01.json`（document）
- `quiz_01.json`（5問のquiz）

## 現状と今後
コア機能（生成 → 配信 → QRインポート）を実装済み。
現状の生成物はドキュメント1本・クイズ5問に固定しています。
将来的にドキュメント・クイズの本数拡張や、生成精度の向上を予定しています。

## ハッカソン
TRAE SOLO Hackathon @ Japan / Productivity Enhancement Track
