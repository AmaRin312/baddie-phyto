create or replace function public.list_decks_with_unavailable_cards()
returns table (deck_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  with unavailable_cards as (
    select card.id
    from public.cards as card
    where card.card_type <> 'flag_card'
      and (
        not card.is_active
        or (
          exists (
            select 1 from public.card_printings as printing
            where printing.card_id = card.id
          )
          and not exists (
            select 1
            from public.card_printings as printing
            join public.card_sets as card_set on card_set.id = printing.set_id
            where printing.card_id = card.id and card_set.is_visible
          )
        )
      )
  )
  select deck.id
  from public.decks as deck
  where exists (
    select 1
    from public.deck_cards as deck_card
    join unavailable_cards as unavailable on unavailable.id = deck_card.card_id
    where deck_card.deck_id = deck.id
  );
$$;

grant execute on function public.list_decks_with_unavailable_cards() to authenticated;
