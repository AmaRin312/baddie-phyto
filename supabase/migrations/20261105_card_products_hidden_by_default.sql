begin;

alter table public.card_sets
  alter column is_visible set default false;

commit;
