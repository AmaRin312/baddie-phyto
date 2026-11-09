-- Keep the product title inside Japanese quotes, and remove pronunciation
-- or other notes in half-width/full-width parentheses.
create or replace function public.normalize_card_set_name(raw_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      coalesce(substring(raw_name from '「([^」]*)」'), raw_name),
      '[（(][^）)]*[）)]',
      '',
      'g'
    ),
    ' 　'
  );
$$;

create or replace function public.normalize_card_set_name_on_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := public.normalize_card_set_name(new.name);
  return new;
end;
$$;

drop trigger if exists card_sets_normalize_name on public.card_sets;
create trigger card_sets_normalize_name
before insert or update of name on public.card_sets
for each row
execute function public.normalize_card_set_name_on_write();

update public.card_sets
set name = public.normalize_card_set_name(name)
where name is distinct from public.normalize_card_set_name(name);
