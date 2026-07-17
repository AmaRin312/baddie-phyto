begin;

alter table public.flags
add column if not exists name text;

alter table public.flags
add column if not exists is_active boolean not null default true;

update public.flags
set is_active = true
where is_active is null;

create index if not exists flags_active_index
on public.flags (is_active);

commit;
