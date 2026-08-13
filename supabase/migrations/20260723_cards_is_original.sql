begin;

-- Baddie Phyto original-card column only.
--
-- Usually do not paste this file manually.
-- For Supabase SQL Editor, prefer:
--   supabase/migrations/20260723_card_csv_is_original.sql
--
-- The preferred file includes this column/index plus CSV preview/import RPC
-- updates. This smaller file exists only as a minimal column/index migration.

alter table public.cards
  add column if not exists is_original boolean not null default false;

create index if not exists cards_is_original_index
on public.cards (is_original);

commit;
