# LINE友だち紹介テスト - セットアップ

本番の優先審査BOT（line-notification-bot）は変更しない。独立した Cloudflare Worker + D1 を使う。

## 登録済み
- LINE LIFF ID: 2012656044-bbp3RD9N
- LIFFエンドポイント: https://kkpp0515-ai.github.io/20260302_001/referral-test/
- フロントエンド: ./index.html
- API実装（Cloudflareに貼る）: ./worker.js
- D1テーブル作成SQL: ./schema.sql

## Cloudflare設定（ユーザーが管理画面で行う）
1. Cloudflare → Storage & databases → D1 SQL database → Create database:
   Database name = referral-test-db
2. 作成したD1のConsoleで schema.sql を実行。
3. Workers & Pages → Create application → Start with Hello World。
   Worker name = referral-test-api (これでURLが次の通りになる):
   https://referral-test-api.kkpp0515.workers.dev
4. 新しいWorkerのEdit Codeで worker.js を全文貼り付け、Deploy。
5. Worker Settings → Bindings → Add → D1 Database:
   Binding name = DB、Database = referral-test-db。
6. Worker Settings → Variables and Secrets:
   - LINE_LOGIN_CHANNEL_ID: Text。LINE Loginチャネルの「チャネル基本設定」のチャネルID。
   - REFERRAL_HASH_SECRET: Secret。32バイト以上のランダムな値（他人に送らず、GitHubにも書かない）。
7. Worker URL /health を開いて {"ok":true,...} を確認。
8. LINE Developers → LINE Login → LIFF → shareTargetPicker の利用規約に同意し有効化。
9. LINE Loginのチャネルが「開発中」ならAdmin/Testerだけログイン可能。
   友だちにも試してもらう際は「公開済み」へ切り替える
   （公開後は開発中に戻せないので注意）。
10. LIFF URL https://liff.line.me/2012656044-bbp3RD9N をLINEで開く。
    まず自分でログインし、専用URLをコピーして知人へ共有して動作確認。

## セキュリティと制約
- IDトークンをLINE公式APIで検証。ブラウザから渡された表示名/IDは信用しない。
- D1には検証済みユーザーIDのHMACのみ保存。氏名・トークンは保存しない。
- 登録はLINEアカウントごとに初回のみ。自己紹介、再ログインは加算しない。
- 紹介コードを後から差し替えても、既存アカウントの紹介元は変わらない。
- 紹介人数は「紹介リンクを開いた人数」ではなく「初回LINEログイン完了人数」。
- この試作は本人が複数のLINEアカウントを持つケース等を防げない。
- 社外に公開する前にプライバシーポリシー、利用目的、適切なレート制限と不正対策を整える。
- サイト側でLINE公式アカウントの友だち追加を求めることも、事前登録データとの紐付けも未実装。
- LIFFチャネルのscopeはopenidとprofile。shareTargetPickerを別途有効化。
