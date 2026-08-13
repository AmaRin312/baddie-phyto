# battle_ability_notifications 確認結果の見方

Supabase SQL Editorで以下を実行した後の確認用メモです。

- `supabase/manual_sql/20260721_battle_ability_notifications_paste.sql`
- `supabase/checks/20260721_battle_ability_notifications_postcheck.sql`

## 1. columns の正解

`battle_ability_notifications` に以下の列があればOKです。

| column_name | data_type | is_nullable |
| --- | --- | --- |
| id | uuid | NO |
| room_id | text | NO |
| ability_key | text | NO |
| source_seat_key | text | NO |
| target_seat_key | text | NO |
| source_instance_id | text | NO |
| target_instance_id | text | NO |
| status | text | NO |
| payload | jsonb | NO |
| created_by | uuid | YES |
| resolved_by | uuid | YES |
| created_at | timestamp with time zone | NO |
| updated_at | timestamp with time zone | NO |

## 2. constraints の正解

以下の制約が出ていればOKです。

- `battle_ability_notifications_pkey`
- `battle_ability_notifications_ability_key_check`
- `battle_ability_notifications_source_seat_key_check`
- `battle_ability_notifications_target_seat_key_check`
- `battle_ability_notifications_status_check`
- `battle_ability_notifications_different_seats_check`
- `battle_ability_notifications_created_by_fkey`
- `battle_ability_notifications_resolved_by_fkey`

## 3. Realtime publication の正解

以下の1行が出ればOKです。

| pubname | schemaname | tablename |
| --- | --- | --- |
| supabase_realtime | public | battle_ability_notifications |

何も出ない場合は、Realtime publicationへの追加ができていません。

## 4. RLS policies の正解

以下の3行が出ればOKです。

| policyname | cmd |
| --- | --- |
| authenticated users can create battle ability notifications | INSERT |
| authenticated users can read battle ability notifications | SELECT |
| authenticated users can update battle ability notifications | UPDATE |

## 補足

現時点のRLSは、開発段階として `authenticated` ユーザー全体に読み取り・更新を許可しています。

将来的にルーム参加者テーブルを作った後で、`room_id` ごとの参加者だけが読める・更新できる形へ絞る予定です。
