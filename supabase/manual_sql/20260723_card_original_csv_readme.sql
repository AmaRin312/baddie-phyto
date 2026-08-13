-- Baddie Phyto: cards.is_original + CSV import/export DB support
-- Supabase SQL Editor guidance
--
-- Apply this file in Supabase SQL Editor:
--   supabase/migrations/20260723_card_csv_is_original.sql
--
-- That migration is the consolidated SQL for the current change.
-- It includes:
--   1. public.cards.is_original boolean not null default false
--   2. cards_is_original_index
--   3. preview_baddie_phyto_card_csv(...) replacement
--   4. import_baddie_phyto_card_csv(...) replacement
--
-- Notes:
--   - supabase/migrations/20260723_cards_is_original.sql only adds the column/index.
--   - If you already ran 20260723_cards_is_original.sql, running
--     20260723_card_csv_is_original.sql is still safe because the column/index use
--     IF NOT EXISTS.
--   - For manual Supabase work, paste the full contents of
--     20260723_card_csv_is_original.sql.
--   - Do not also paste 20260723_cards_is_original.sql unless you only want to
--     add the column/index and intentionally do not want CSV RPC updates.
--
-- Optional post-checks after applying:

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
  and column_name = 'is_original';

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'cards'
  and indexname = 'cards_is_original_index';

select
  routine_name
from information_schema.routines
where specific_schema = 'public'
  and routine_name in (
    'preview_baddie_phyto_card_csv',
    'import_baddie_phyto_card_csv'
  )
order by routine_name;
