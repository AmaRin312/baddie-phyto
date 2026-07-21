select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'battle_player_states'
order by ordinal_position;

select
  conname,
  pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.battle_player_states'::regclass;

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'save_battle_player_state';

select
  pubname,
  schemaname,
  tablename
from pg_publication_tables
where schemaname = 'public'
  and tablename = 'battle_player_states';

select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'battle_player_states';
