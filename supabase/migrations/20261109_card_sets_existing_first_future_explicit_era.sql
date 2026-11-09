begin;

-- Existing products all belong to the original series. The old trigger inferred
-- a series from the product code and overwrote an explicit era_key on insert.
drop trigger if exists card_sets_set_era_key on public.card_sets;

update public.card_sets
set era_key = 'first'
where era_key is distinct from 'first';

-- Future inserts keep their supplied era_key. If omitted, the column default
-- remains 'first'.

commit;
