begin;

-- Baddie Phyto deck save scopes.
--
-- private: personal deck, visible only to owner
-- public: locally published user-made deck, visible to authenticated users
-- default: base/default deck for all users, visible to authenticated users

alter table public.decks
  add column if not exists deck_visibility text not null default 'private';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.decks'::regclass
      and conname = 'decks_deck_visibility_check'
  ) then
    alter table public.decks
      add constraint decks_deck_visibility_check
      check (deck_visibility in ('private', 'public', 'default'));
  end if;
end;
$$;

create index if not exists decks_visibility_index
on public.decks (deck_visibility);

drop policy if exists "users can read own decks" on public.decks;
drop policy if exists "users can read visible decks" on public.decks;
create policy "users can read visible decks"
on public.decks
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or deck_visibility in ('public', 'default')
);

drop policy if exists "users can read own deck cards" on public.deck_cards;
drop policy if exists "users can read visible deck cards" on public.deck_cards;
create policy "users can read visible deck cards"
on public.deck_cards
for select
to authenticated
using (
  exists (
    select 1
    from public.decks
    where decks.id = deck_cards.deck_id
      and (
        decks.owner_id = (select auth.uid())
        or decks.deck_visibility in ('public', 'default')
      )
  )
);

drop function if exists public.create_deck(text, uuid, uuid);
create or replace function public.create_deck(
  p_name text,
  p_flag_id uuid,
  p_buddy_card_id uuid,
  p_deck_visibility text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id uuid;
  new_deck_id uuid;
  normalized_visibility text;
begin
  user_id := auth.uid();
  if user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Deck name is required.';
  end if;

  normalized_visibility := coalesce(nullif(trim(p_deck_visibility), ''), 'private');
  if normalized_visibility not in ('private', 'public', 'default') then
    raise exception 'deck_visibility is invalid.';
  end if;

  if not exists (
    select 1
    from public.flags
    join public.cards on cards.id = flags.card_id
    where flags.id = p_flag_id
      and flags.can_be_selected_as_flag = true
      and cards.card_type = 'flag_card'
      and cards.is_active = true
  ) then
    raise exception 'Selected flag does not exist or is not selectable.';
  end if;

  if not exists (
    select 1
    from public.cards
    where id = p_buddy_card_id
      and is_active = true
      and card_type <> 'flag_card'
  ) then
    raise exception 'Selected buddy card does not exist or is inactive.';
  end if;

  insert into public.decks (
    owner_id,
    name,
    flag_id,
    buddy_card_id,
    deck_visibility
  )
  values (
    user_id,
    trim(p_name),
    p_flag_id,
    p_buddy_card_id,
    normalized_visibility
  )
  returning id into new_deck_id;

  return new_deck_id;
end;
$$;

revoke all on function public.create_deck(text, uuid, uuid, text) from public;
grant execute on function public.create_deck(text, uuid, uuid, text) to authenticated;

create or replace function public.create_deck(
  p_name text,
  p_flag_id uuid,
  p_buddy_card_id uuid
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.create_deck(p_name, p_flag_id, p_buddy_card_id, 'private');
$$;

revoke all on function public.create_deck(text, uuid, uuid) from public;
grant execute on function public.create_deck(text, uuid, uuid) to authenticated;

commit;
