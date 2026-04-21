# 家族の予定アプリ

夫婦で共有できるカレンダーアプリです。外出先からでもブラウザで予定の追加・編集・削除ができ、リアルタイムで二人の画面に同期されます。

## 技術スタック

- **フロントエンド**: Next.js + React
- **ホスティング**: Cloudflare Workers
- **データベース**: Cloudflare D1
- **認証**: Cloudflare Access
- **言語**: TypeScript

## セットアップ

### 1. 環境準備

```bash
npm install
```

### 2. Cloudflare D1 データベース作成

```bash
wrangler d1 create family-calendar
```

データベースIDをコピーして、`wrangler.jsonc` の `database_id` を更新してください。

### 3. マイグレーション実行

```bash
wrangler d1 migrations create family-calendar initial
# migrations ファイルを編集して migrations/0001_initial.sql の内容をコピー

wrangler d1 migrations apply family-calendar --remote
```

### 4. ローカル開発

```bash
npm run dev
```

http://localhost:8787 でアクセスできます。

## 本番デプロイ

### 1. Cloudflare Access 設定

Cloudflare ダッシュボード → Access → Applications で以下の設定を追加：

- **ルール**: メールアドレスで認証
  - taikigu0308@yahoo.co.jp (本人)
  - erknm.21@docomo.ne.jp (妻)

### 2. デプロイ

```bash
npm run build
npm run deploy
```

## 機能

- 📅 月間カレンダー表示
- ➕ 予定の追加・編集・削除
- 🔄 リアルタイム同期（WebSocket）
- 📱 レスポンシブデザイン
- 🔐 Cloudflare Access による認証

## 注意事項

- `wrangler.jsonc` に `"preview_urls": false` が設定されています
- APIキーや秘密情報は環境変数（Secrets）で管理します
- GitHub リポジトリは Private に設定してください
