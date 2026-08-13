# Baddie Phyto

Future Card Buddyfight専用のオンライン対戦シミュレーターです。

Due Manoとは別Repository・別Supabase・別Vercelとして運用します。

## セットアップ

1. `.env.example`を`.env.local`へコピーする
2. 新しいBaddie Phyto用SupabaseのURLとAnon/Publishable Keyを設定する
3. `supabase/schema.sql`をSupabase SQL Editorで実行する
4. Supabase Authでメール認証とRedirect URLを設定する
5. 依存関係をインストールして起動する

```text
npm install
npm run dev
```

## 現在の実装範囲

- メール認証
- カード登録
- カード画像の分離管理
- フラッグ登録
- フラッグ・バディ選択によるデッキ作成
- デッキカード検索・除外検索・画像選択

Abilityと対戦画面は次の段階で実装します。
