begin;

alter table public.decks
  add column if not exists sleeve_supply_id uuid references public.battle_supplies(id) on delete set null,
  add column if not exists playmat_supply_id uuid references public.battle_supplies(id) on delete set null;

create index if not exists decks_sleeve_supply_id_index
on public.decks (sleeve_supply_id);

create index if not exists decks_playmat_supply_id_index
on public.decks (playmat_supply_id);

create or replace function public.validate_deck_supply_settings_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sleeve_supply_id is not null and not exists (
    select 1
    from public.battle_supplies
    where id = new.sleeve_supply_id
      and owner_id = new.owner_id
      and supply_type = 'sleeve'
      and is_active = true
  ) then
    raise exception 'sleeve_supply_id is invalid.';
  end if;

  if new.playmat_supply_id is not null and not exists (
    select 1
    from public.battle_supplies
    where id = new.playmat_supply_id
      and owner_id = new.owner_id
      and supply_type = 'playmat'
      and is_active = true
  ) then
    raise exception 'playmat_supply_id is invalid.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_deck_supply_settings_owner
on public.decks;
create trigger validate_deck_supply_settings_owner
before insert or update on public.decks
for each row
execute function public.validate_deck_supply_settings_owner();

commit;
