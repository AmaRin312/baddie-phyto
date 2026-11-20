alter table public.decks
  add column if not exists key_card_id uuid references public.cards(id) on delete set null;

create index if not exists decks_key_card_id_idx
  on public.decks (key_card_id)
  where key_card_id is not null;
