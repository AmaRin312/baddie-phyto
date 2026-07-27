begin;

drop policy if exists "users can read own battle supplies"
on public.battle_supplies;
create policy "authenticated users can read active battle supplies"
on public.battle_supplies
for select
to authenticated
using (is_active = true);

drop policy if exists "users can read own battle supply settings"
on public.battle_supply_settings;
create policy "authenticated users can read battle supply settings"
on public.battle_supply_settings
for select
to authenticated
using (true);

commit;
