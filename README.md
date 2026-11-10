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

## プロジェクト構造の注意

このRepositoryでVercelがビルドする本体は、Repository直下のファイルです。

- 編集対象: `src/`, `scripts/`, `supabase/`, `package.json`
- 編集しない: `Baddie Phyto/`（ローカルコピー）
- 原則編集しない: `baddie-phyto/`（過去構成の重複フォルダ）

デッキ作成画面など、サイトに反映したい変更は必ずRepository直下の`src/`へ入れてください。
重複フォルダを触ると、ローカルでは変わったように見えてもVercelへ反映されないことがあります。

## デッキ一覧のページ取得と画像サムネイル

デッキ一覧のページ取得を有効にするには、Supabase SQL Editorで次のファイルを順番に実行します。

1. `supabase/migrations/20261110_deck_list_pagination.sql`
2. `supabase/migrations/20261111_deck_sections_page_batch.sql`

アプリは新しい一括取得関数が見つからない場合、既存のページ取得関数、さらに従来の一覧取得へ順に切り替えます。SQL適用前でも一覧は使えますが、全件取得を避ける効果は両方のSQL適用後に有効になります。

カードの小さな表示には元画像の75%サイズのWebPを使います。新規登録画像のサムネイルは登録時に生成されます。既存画像を移行するときは、サービスロール鍵をローカルの`.env.local`に設定し、対象件数を確認してから実行します。元画像は削除されません。

```text
npm run generate:card-thumbnails -- --count-only
npm run generate:card-thumbnails -- --limit 10
npm run generate:card-thumbnails -- --apply --all
```

2026年11月10日に既存の1,168件を移行し、未移行件数が0件であることを確認しました。


