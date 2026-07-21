select to_regclass('public.battle_player_states') as battle_player_states_table;

do $$
declare
  existing_rows jsonb;
begin
  if to_regclass('public.battle_player_states') is null then
    raise notice 'public.battle_player_states does not exist yet.';
    return;
  end if;

  execute '
    select coalesce(jsonb_agg(row_to_json(row_value)), ''[]''::jsonb)
    from (
      select *
      from public.battle_player_states
      limit 20
    ) as row_value
  '
  into existing_rows;

  raise notice 'battle_player_states first rows: %', existing_rows;
end;
$$;

-- If the first query shows the table exists, you may also run this manually:
-- select *
-- from public.battle_player_states
-- limit 20;

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'battle_player_states'
order by ordinal_position;
