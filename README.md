# 家族の予定アプリ

夫婦で共有できるカレンダーアプリです。ブラウザで予定の追加・編集・削除ができます。

## 技術スタック

- **ホスティング**: Cloudflare Workers
- **データベース**: Cloudflare D1
- **認証**: Cloudflare Access
- **フロントエンド**: HTML + Vanilla JavaScript

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Cloudflare D1 データベース作成

```bash
wrangler d1 create family-calendar
```

出力されるデータベースIDを `wrangler.jsonc` の `database_id` フィールドに貼り付けます。

### 3. マイグレーション実行

```bash
wrangler d1 migrations apply family-calendar --remote
```

### 4. ローカル開発開始

```bash
npm run dev
```

http://localhost:8787 でアプリが起動します。

## 本番デプロイ

### 1. Cloudflare Access 設定

Cloudflare ダッシュボード → Access → Applications で以下を設定：

- **認証ルール**: メールアドレス
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
- 📱 レスポンシブデザイン
- 🔐 Cloudflare Access による認証

## 注意事項

- `wrangler.jsonc` の `preview_urls: false` で Access 認証をバイパスします
- GitHub リポジトリは Private に設定してください
