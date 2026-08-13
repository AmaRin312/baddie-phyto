begin;

-- ============================================================
-- Baddie Phyto existing DB patch
-- - cards / flags / decks / deck_cards / abilities / card_abilities are assumed to exist.
-- - Image-related SQL may not have been applied yet.
-- - This SQL avoids duplicate policies / triggers / indexes where possible.
-- ============================================================

-- ------------------------------------------------------------
-- 1. card_type: replace old "flag" with "flag_card"
-- ------------------------------------------------------------

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.cards'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%card_type%'
  loop
    execute format('alter table public.cards drop constraint %I', constraint_record.conname);
  end loop;
end;
$$;

update public.cards
set card_type = 'flag_card'
where card_type = 'flag';

alter table public.cards
add constraint cards_card_type_check
check (card_type in ('monster', 'spell', 'item', 'impact', 'flag_card', 'other'));

create index if not exists cards_type_index on public.cards (card_type);

-- ------------------------------------------------------------
-- 2. flags: game-start flags are managed by flags.card_id
-- ------------------------------------------------------------

alter table public.flags
add column if not exists card_id uuid;

alter table public.flags
add column if not exists can_be_selected_as_flag boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.flags'::regclass
      and contype = 'f'
      and conname = 'flags_card_id_fkey'
  ) then
    alter table public.flags
    add constraint flags_card_id_fkey
    foreign key (card_id) references public.cards(id) on delete restrict;
  end if;
end;
$$;

create unique index if not exists flags_card_id_unique
on public.flags (card_id)
where card_id is not null;

create index if not exists flags_card_id_index on public.flags (card_id);
create index if not exists flags_selectable_index on public.flags (can_be_selected_as_flag);

create or replace function public.validate_flag_card()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.card_id is null then
    raise exception 'Flag must reference a card.';
  end if;

  if not exists (
    select 1
    from public.cards
    where id = new.card_id
      and card_type = 'flag_card'
      and is_active = true
  ) then
    raise exception 'Flag must reference an active card whose card_type is flag_card.';
  end if;

  return new;
end;
$$;

drop trigger if exists flags_validate_card on public.flags;
create trigger flags_validate_card
before insert or update of card_id on public.flags
for each row execute function public.validate_flag_card();

-- ------------------------------------------------------------
-- 3. card_images: multiple images per card, optional default image
-- ------------------------------------------------------------

create table if not exists public.card_images (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  thumbnail_path text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.card_images
add column if not exists card_id uuid;

alter table public.card_images
add column if not exists owner_id uuid;

alter table public.card_images
add column if not exists image_path text;

alter table public.card_images
add column if not exists thumbnail_path text;

alter table public.card_images
add column if not exists is_default boolean not null default false;

alter table public.card_images
add column if not exists created_at timestamptz not null default now();

update public.card_images
set is_default = false
where is_default is null;

alter table public.card_images
alter column is_default set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.card_images'::regclass
      and contype = 'f'
      and conname = 'card_images_card_id_fkey'
  ) then
    alter table public.card_images
    add constraint card_images_card_id_fkey
    foreign key (card_id) references public.cards(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.card_images'::regclass
      and contype = 'f'
      and conname = 'card_images_owner_id_fkey'
  ) then
    alter table public.card_images
    add constraint card_images_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.card_images'::regclass
      and contype = 'c'
      and conname = 'card_images_image_path_not_blank'
  ) then
    alter table public.card_images
    add constraint card_images_image_path_not_blank
    check (char_length(trim(image_path)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.card_images'::regclass
      and contype = 'c'
      and conname = 'card_images_thumbnail_path_not_blank'
  ) then
    alter table public.card_images
    add constraint card_images_thumbnail_path_not_blank
    check (thumbnail_path is null or char_length(trim(thumbnail_path)) > 0);
  end if;
end;
$$;

create unique index if not exists card_images_image_path_unique
on public.card_images (image_path);

create index if not exists card_images_card_id_index
on public.card_images (card_id);

create index if not exists card_images_owner_id_index
on public.card_images (owner_id);

create index if not exists card_images_thumbnail_path_index
on public.card_images (thumbnail_path);

create unique index if not exists card_images_one_default_per_card_unique
on public.card_images (card_id)
where is_default = true;

alter table public.card_images enable row level security;

drop policy if exists "authenticated users can read card images" on public.card_images;
create policy "authenticated users can read card images"
on public.card_images
for select
to authenticated
using (true);

drop policy if exists "users can insert own card images" on public.card_images;
create policy "users can insert own card images"
on public.card_images
for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and split_part(image_path, '/', 1) = (select auth.uid())::text
  and (thumbnail_path is null or split_part(thumbnail_path, '/', 1) = (select auth.uid())::text)
);

drop policy if exists "users can update own card images" on public.card_images;
create policy "users can update own card images"
on public.card_images
for update
to authenticated
using (owner_id = (select auth.uid()))
with check (
  owner_id = (select auth.uid())
  and split_part(image_path, '/', 1) = (select auth.uid())::text
  and (thumbnail_path is null or split_part(thumbnail_path, '/', 1) = (select auth.uid())::text)
);

drop policy if exists "users can delete own card images" on public.card_images;
create policy "users can delete own card images"
on public.card_images
for delete
to authenticated
using (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.card_images to authenticated;

-- ------------------------------------------------------------
-- 4. deck_cards.selected_image_id
--    null = use card default image; if no default image, render HTML card.
-- ------------------------------------------------------------

alter table public.deck_cards
add column if not exists selected_image_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.deck_cards'::regclass
      and contype = 'f'
      and conname = 'deck_cards_selected_image_id_fkey'
  ) then
    alter table public.deck_cards
    add constraint deck_cards_selected_image_id_fkey
    foreign key (selected_image_id) references public.card_images(id) on delete set null;
  end if;
end;
$$;

create or replace function public.validate_deck_card_selected_image()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  image_card_id uuid;
begin
  if new.selected_image_id is null then
    return new;
  end if;

  select card_id
  into image_card_id
  from public.card_images
  where id = new.selected_image_id;

  if image_card_id is null then
    raise exception 'Selected card image does not exist.';
  end if;

  if image_card_id <> new.card_id then
    raise exception 'Selected image does not belong to the selected card.';
  end if;

  return new;
end;
$$;

drop trigger if exists deck_cards_validate_selected_image on public.deck_cards;
create trigger deck_cards_validate_selected_image
before insert or update of card_id, selected_image_id on public.deck_cards
for each row execute function public.validate_deck_card_selected_image();

-- ------------------------------------------------------------
-- 5. RPCs aligned with flags / flag_card / selected_image_id
-- ------------------------------------------------------------

create or replace function public.create_deck(
  p_name text,
  p_flag_id uuid,
  p_buddy_card_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id uuid;
  new_deck_id uuid;
begin
  user_id := auth.uid();

  if user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Deck name is required.';
  end if;

  if not exists (
    select 1
    from public.flags
    join public.cards on cards.id = flags.card_id
    where flags.id = p_flag_id
      and flags.can_be_selected_as_flag = true
      and cards.card_type = 'flag_card'
      and cards.is_active = true
  ) then
    raise exception 'Selected flag does not exist or is not selectable.';
  end if;

  if not exists (
    select 1
    from public.cards
    where id = p_buddy_card_id
      and is_active = true
      and card_type <> 'flag_card'
  ) then
    raise exception 'Selected buddy card does not exist or is inactive.';
  end if;

  insert into public.decks (owner_id, name, flag_id, buddy_card_id)
  values (user_id, trim(p_name), p_flag_id, p_buddy_card_id)
  returning id into new_deck_id;

  return new_deck_id;
end;
$$;

revoke all on function public.create_deck(text, uuid, uuid) from public;
grant execute on function public.create_deck(text, uuid, uuid) to authenticated;

create or replace function public.set_deck_card(
  p_deck_id uuid,
  p_card_id uuid,
  p_quantity integer,
  p_sort_order integer default 0,
  p_selected_image_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.decks
    where id = p_deck_id
      and owner_id = auth.uid()
  ) then
    raise exception 'Deck not found or access denied.';
  end if;

  if not exists (
    select 1
    from public.cards
    where id = p_card_id
      and is_active = true
  ) then
    raise exception 'Card not found or inactive.';
  end if;

  if p_selected_image_id is not null and not exists (
    select 1
    from public.card_images
    where id = p_selected_image_id
      and card_id = p_card_id
  ) then
    raise exception 'Selected image does not belong to the card.';
  end if;

  if p_quantity <= 0 then
    delete from public.deck_cards
    where deck_id = p_deck_id
      and card_id = p_card_id;
    return;
  end if;

  insert into public.deck_cards (
    deck_id,
    card_id,
    selected_image_id,
    quantity,
    sort_order
  )
  values (
    p_deck_id,
    p_card_id,
    p_selected_image_id,
    p_quantity,
    greatest(p_sort_order, 0)
  )
  on conflict (deck_id, card_id) do update set
    selected_image_id = excluded.selected_image_id,
    quantity = excluded.quantity,
    sort_order = excluded.sort_order,
    updated_at = now();
end;
$$;

revoke all on function public.set_deck_card(uuid, uuid, integer, integer, uuid) from public;
grant execute on function public.set_deck_card(uuid, uuid, integer, integer, uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. Storage bucket / policies for card images
-- ------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'card-images',
  'card-images',
  true,
  null,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can view card image objects" on storage.objects;
create policy "public can view card image objects"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'card-images');

drop policy if exists "users can upload card image objects" on storage.objects;
create policy "users can upload card image objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'card-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "users can update own card image objects" on storage.objects;
create policy "users can update own card image objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'card-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'card-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "users can delete own card image objects" on storage.objects;
create policy "users can delete own card image objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'card-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
