select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'battle_ability_notifications'
order by ordinal_position;

select
  conname,
  pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.battle_ability_notifications'::regclass;

select
  pubname,
  schemaname,
  tablename
from pg_publication_tables
where schemaname = 'public'
  and tablename = 'battle_ability_notifications';

select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'battle_ability_notifications'
order by policyname;
