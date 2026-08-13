alter table public.cards
add column if not exists races text[] not null default '{}'
check (array_position(races, null) is null);

create index if not exists cards_races_index
on public.cards using gin (races);
