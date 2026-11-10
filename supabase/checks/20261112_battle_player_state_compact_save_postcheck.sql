select
  p.oid::regprocedure as signature,
  pg_get_function_result(p.oid) as result,
  has_function_privilege(
    'authenticated',
    p.oid,
    'execute'
  ) as authenticated_can_execute
from pg_proc as p
join pg_namespace as namespace
  on namespace.oid = p.pronamespace
where namespace.nspname = 'public'
  and p.proname = 'save_battle_player_state_compact';
