# Battle Ability Registry SQL 確認結果の見方

対象SQL:

- `supabase/manual_sql/20260721_battle_ability_registry_seed.sql`
- `supabase/checks/20260721_battle_ability_registry_postcheck.sql`

## 期待結果

postcheckを実行して、以下6件が返ればOKです。

| behavior_key | is_active |
| --- | --- |
| biri_kinata_face_down_use | true |
| chi_no_hanshin_composite | true |
| face_down_soul | true |
| hyakugan_yamigedo | true |
| levantine_item_limit_unlimited | true |
| ten_no_hanshin_composite | true |

## 注意

- このSQLは `abilities` の登録だけを行います。
- `cards` と `card_abilities` の紐付けは行いません。
- 実カードへのAbility付与は、既存のカード管理画面またはCSVインポートで `ability` に `behavior_key` を指定して行ってください。
- `behavior_key` はアプリ側の `AbilityId` と一致している必要があります。

