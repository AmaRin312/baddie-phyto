begin;

alter table public.decks
  add column if not exists era_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.decks'::regclass
      and conname = 'decks_era_key_check'
  ) then
    alter table public.decks
      add constraint decks_era_key_check
      check (era_key is null or era_key in ('first', 'hundred', 'ddd', 'x', 'god'));
  end if;
end;
$$;

create index if not exists decks_era_key_index
on public.decks (era_key);

comment on column public.decks.era_key is
  'Baddie Phyto deck era filter key: first, hundred, ddd, x, god. Nullable for draft/undecided decks.';

commit;