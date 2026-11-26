begin;

drop policy if exists "users can read own deck cards" on public.deck_cards;
create policy "users can read accessible deck cards"
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

commit;
