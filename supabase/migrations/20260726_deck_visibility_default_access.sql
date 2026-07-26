begin;

alter table public.decks
  add column if not exists deck_visibility text not null default 'private';

update public.decks
set deck_visibility = 'private'
where deck_visibility is null
   or deck_visibility not in ('private', 'public', 'default');

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.decks'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%deck_visibility%'
  loop
    execute format('alter table public.decks drop constraint %I', constraint_record.conname);
  end loop;
end;
$$;

alter table public.decks
  add constraint decks_deck_visibility_check
  check (deck_visibility in ('private', 'public', 'default'));

drop policy if exists "authenticated users can read public and default decks"
on public.decks;
create policy "authenticated users can read public and default decks"
on public.decks
for select
to authenticated
using (deck_visibility in ('public', 'default'));

commit;
