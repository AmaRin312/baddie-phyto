begin;

alter table public.card_sets
  add column if not exists era_key text not null default 'first';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.card_sets'::regclass
      and conname = 'card_sets_era_key_check'
  ) then
    alter table public.card_sets
      add constraint card_sets_era_key_check
      check (era_key in ('first', 'hundred', 'ddd', 'x', 'god'));
  end if;
end;
$$;

create or replace function public.infer_baddie_phyto_era_key(
  p_set_code text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(coalesce(p_set_code, '')) like '%100%' then 'hundred'
    when upper(coalesce(p_set_code, '')) like '%DDD%' then 'ddd'
    when upper(coalesce(p_set_code, '')) like '%GOD%' then 'god'
    when upper(coalesce(p_set_code, '')) like '%X%' then 'x'
    else 'first'
  end;
$$;

update public.card_sets
set era_key = public.infer_baddie_phyto_era_key(set_code)
where era_key is null
   or era_key = 'first'
   or era_key not in ('first', 'hundred', 'ddd', 'x', 'god');

create or replace function public.set_card_sets_era_key()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.era_key = public.infer_baddie_phyto_era_key(new.set_code);
  return new;
end;
$$;

drop trigger if exists card_sets_set_era_key on public.card_sets;
create trigger card_sets_set_era_key
before insert or update of set_code on public.card_sets
for each row
execute function public.set_card_sets_era_key();

create index if not exists card_sets_era_key_index
on public.card_sets (era_key);

commit;
