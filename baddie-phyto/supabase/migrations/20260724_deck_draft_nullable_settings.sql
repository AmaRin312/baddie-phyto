begin;

-- Allow users to start deck editing before deciding deck name, flag, or buddy.
-- The application stores a temporary name ("無題のデッキ") and keeps flag/buddy
-- null until the user selects them in the deck editor.

alter table public.decks
  alter column flag_id drop not null,
  alter column buddy_card_id drop not null;

drop function if exists public.create_draft_deck(text, text);

create or replace function public.create_draft_deck(
  p_name text default '無題のデッキ',
  p_deck_visibility text default 'private'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  user_id uuid;
  inserted_id uuid;
  normalized_visibility text;
begin
  user_id := auth.uid();
  if user_id is null then
    raise exception 'Authentication is required.';
  end if;

  normalized_visibility := coalesce(nullif(trim(p_deck_visibility), ''), 'private');
  if normalized_visibility not in ('private', 'public', 'default') then
    raise exception 'deck_visibility is invalid.';
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
    coalesce(nullif(trim(p_name), ''), '無題のデッキ'),
    null,
    null,
    normalized_visibility
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public.create_draft_deck(text, text) from public;
grant execute on function public.create_draft_deck(text, text) to authenticated;

commit;
