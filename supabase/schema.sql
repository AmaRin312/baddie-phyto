begin;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  worlds text[] not null default '{}' check (cardinality(worlds) <= 3) check (array_position(worlds, null) is null),
  races text[] not null default '{}' check (array_position(races, null) is null),
  orientation text not null default 'vertical' check (orientation in ('vertical', 'horizontal', 'mixed')),
  size integer check (size is null or size >= 0),
  power integer check (power is null or power >= 0),
  defense integer check (defense is null or defense >= 0),
  critical integer check (critical is null or critical >= 0),
  card_text text,
  card_type text not null check (card_type in ('monster', 'spell', 'item', 'impact', 'flag_card', 'other')),
  is_dragon boolean not null default false,
  is_corner_king boolean not null default false,
  is_hyakki boolean not null default false,
  is_chaos boolean not null default false,
  is_generic boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  name text,
  card_id uuid not null unique references public.cards(id) on delete restrict,
  usable_worlds text[] not null default '{}' check (array_position(usable_worlds, null) is null),
  initial_life integer not null check (initial_life >= 0),
  initial_hand integer not null check (initial_hand >= 0),
  initial_gauge integer not null check (initial_gauge >= 0),
  can_be_selected_as_flag boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.card_images (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null unique check (char_length(trim(image_path)) > 0),
  thumbnail_path text check (thumbnail_path is null or char_length(trim(thumbnail_path)) > 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  flag_id uuid not null references public.flags(id) on delete restrict,
  buddy_card_id uuid not null references public.cards(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deck_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete restrict,
  selected_image_id uuid references public.card_images(id) on delete set null,
  quantity integer not null check (quantity > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deck_id, card_id)
);

create table public.abilities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  behavior_key text not null unique check (char_length(trim(behavior_key)) between 1 and 120),
  description text,
  params jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.card_abilities (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  ability_id uuid not null references public.abilities(id) on delete cascade,
  params jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, ability_id)
);

create index cards_name_index on public.cards (lower(name));
create index cards_type_index on public.cards (card_type);
create index cards_worlds_index on public.cards using gin (worlds);
create index cards_races_index on public.cards using gin (races);
create index cards_active_index on public.cards (is_active);
create index cards_search_flags_index on public.cards (is_dragon, is_hyakki, is_chaos, is_generic);
create index flags_card_id_index on public.flags (card_id);
create index flags_usable_worlds_index on public.flags using gin (usable_worlds);
create index flags_selectable_index on public.flags (can_be_selected_as_flag);
create index flags_active_index on public.flags (is_active);
create index card_images_card_id_index on public.card_images (card_id);
create index card_images_owner_id_index on public.card_images (owner_id);
create index card_images_thumbnail_path_index on public.card_images (thumbnail_path);
create unique index card_images_one_default_per_card_unique on public.card_images (card_id) where is_default = true;
create index decks_owner_id_index on public.decks (owner_id);
create index decks_flag_id_index on public.decks (flag_id);
create index decks_buddy_card_id_index on public.decks (buddy_card_id);
create index deck_cards_deck_id_index on public.deck_cards (deck_id);
create index deck_cards_card_id_index on public.deck_cards (card_id);
create index deck_cards_sort_order_index on public.deck_cards (deck_id, sort_order);
create index abilities_active_index on public.abilities (is_active);
create index card_abilities_card_id_index on public.card_abilities (card_id);
create index card_abilities_ability_id_index on public.card_abilities (ability_id);
create index card_abilities_sort_order_index on public.card_abilities (card_id, sort_order);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger cards_set_updated_at before update on public.cards for each row execute function public.set_updated_at();
create trigger flags_set_updated_at before update on public.flags for each row execute function public.set_updated_at();
create trigger decks_set_updated_at before update on public.decks for each row execute function public.set_updated_at();
create trigger deck_cards_set_updated_at before update on public.deck_cards for each row execute function public.set_updated_at();
create trigger abilities_set_updated_at before update on public.abilities for each row execute function public.set_updated_at();
create trigger card_abilities_set_updated_at before update on public.card_abilities for each row execute function public.set_updated_at();

create or replace function public.validate_deck_card_selected_image()
returns trigger language plpgsql set search_path = '' as $$
declare image_card_id uuid;
begin
  if new.selected_image_id is null then return new; end if;
  select card_id into image_card_id from public.card_images where id = new.selected_image_id;
  if image_card_id is null then raise exception 'Selected card image does not exist.'; end if;
  if image_card_id <> new.card_id then raise exception 'Selected image does not belong to the selected card.'; end if;
  return new;
end;
$$;

create trigger deck_cards_validate_selected_image
before insert or update of card_id, selected_image_id on public.deck_cards
for each row execute function public.validate_deck_card_selected_image();

create or replace function public.validate_flag_card()
returns trigger language plpgsql set search_path = '' as $$
begin
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

create trigger flags_validate_card
before insert or update of card_id on public.flags
for each row execute function public.validate_flag_card();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, nickname)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), split_part(coalesce(new.email, ''), '@', 1), 'Player')
  ) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.flags enable row level security;
alter table public.card_images enable row level security;
alter table public.decks enable row level security;
alter table public.deck_cards enable row level security;
alter table public.abilities enable row level security;
alter table public.card_abilities enable row level security;

create policy "authenticated users can read profiles" on public.profiles for select to authenticated using (true);
create policy "users can insert own profile" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "users can update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "authenticated users can read cards" on public.cards for select to authenticated using (true);
create policy "authenticated users can insert cards" on public.cards for insert to authenticated with check (true);
create policy "authenticated users can update cards" on public.cards for update to authenticated using (true) with check (true);

create policy "authenticated users can read flags" on public.flags for select to authenticated using (true);
create policy "authenticated users can insert flags" on public.flags for insert to authenticated with check (true);
create policy "authenticated users can update flags" on public.flags for update to authenticated using (true) with check (true);

create policy "authenticated users can read card images" on public.card_images for select to authenticated using (true);
create policy "users can insert own card images" on public.card_images for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and split_part(image_path, '/', 1) = (select auth.uid())::text
  and (thumbnail_path is null or split_part(thumbnail_path, '/', 1) = (select auth.uid())::text)
);
create policy "users can update own card images" on public.card_images for update to authenticated
using (owner_id = (select auth.uid()))
with check (
  owner_id = (select auth.uid())
  and split_part(image_path, '/', 1) = (select auth.uid())::text
  and (thumbnail_path is null or split_part(thumbnail_path, '/', 1) = (select auth.uid())::text)
);
create policy "users can delete own card images" on public.card_images for delete to authenticated
using (owner_id = (select auth.uid()));

create policy "users can read own decks" on public.decks for select to authenticated using (owner_id = (select auth.uid()));
create policy "users can insert own decks" on public.decks for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "users can update own decks" on public.decks for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "users can delete own decks" on public.decks for delete to authenticated using (owner_id = (select auth.uid()));

create policy "users can read own deck cards" on public.deck_cards for select to authenticated
using (exists (select 1 from public.decks where decks.id = deck_cards.deck_id and decks.owner_id = (select auth.uid())));
create policy "users can insert own deck cards" on public.deck_cards for insert to authenticated
with check (exists (select 1 from public.decks where decks.id = deck_cards.deck_id and decks.owner_id = (select auth.uid())));
create policy "users can update own deck cards" on public.deck_cards for update to authenticated
using (exists (select 1 from public.decks where decks.id = deck_cards.deck_id and decks.owner_id = (select auth.uid())))
with check (exists (select 1 from public.decks where decks.id = deck_cards.deck_id and decks.owner_id = (select auth.uid())));
create policy "users can delete own deck cards" on public.deck_cards for delete to authenticated
using (exists (select 1 from public.decks where decks.id = deck_cards.deck_id and decks.owner_id = (select auth.uid())));

create policy "authenticated users can read abilities" on public.abilities for select to authenticated using (true);
create policy "authenticated users can read card abilities" on public.card_abilities for select to authenticated using (true);
create policy "authenticated users can insert card abilities" on public.card_abilities for insert to authenticated with check (true);
create policy "authenticated users can update card abilities" on public.card_abilities for update to authenticated using (true) with check (true);
create policy "authenticated users can delete card abilities" on public.card_abilities for delete to authenticated using (true);

grant select, insert, update on public.profiles, public.cards, public.flags to authenticated;
grant select, insert, update, delete on public.card_images, public.decks, public.deck_cards to authenticated;
grant select on public.abilities to authenticated;
grant select, insert, update, delete on public.card_abilities to authenticated;

create or replace view public.card_view
with (security_invoker = true) as
select
  cards.id,
  cards.name,
  cards.worlds,
  cards.races,
  cards.orientation,
  cards.size,
  cards.power,
  cards.defense,
  cards.critical,
  cards.card_text,
  cards.card_type,
  cards.is_dragon,
  cards.is_corner_king,
  cards.is_hyakki,
  cards.is_chaos,
  cards.is_generic,
  cards.is_active,
  cards.created_at,
  cards.updated_at,
  coalesce(
    array_agg(abilities.name order by card_abilities.sort_order)
      filter (where abilities.id is not null),
    '{}'::text[]
  ) as ability_names,
  concat_ws(
    ' ',
    cards.name,
    array_to_string(cards.worlds, ' '),
    array_to_string(cards.races, ' '),
    cards.card_text,
    cards.card_type,
    case when cards.is_dragon then 'dragon ドラゴン' end,
    case when cards.is_corner_king then 'corner king 角王' end,
    case when cards.is_hyakki then 'hyakki 百鬼' end,
    case when cards.is_chaos then 'chaos カオス' end,
    case when cards.is_generic then 'generic ジェネリック' end,
    array_to_string(
      coalesce(
        array_agg(abilities.name order by card_abilities.sort_order)
          filter (where abilities.id is not null),
        '{}'::text[]
      ),
      ' '
    )
  ) as search_text
from public.cards
left join public.card_abilities on card_abilities.card_id = cards.id
left join public.abilities on abilities.id = card_abilities.ability_id
group by cards.id;

grant select on public.card_view to authenticated;

create or replace function public.search_cards(
  p_keyword text default null,
  p_card_type text default null,
  p_world text default null,
  p_active_only boolean default true
)
returns setof public.card_view
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from public.card_view
  where
    (not p_active_only or is_active = true)
    and (nullif(trim(p_keyword), '') is null or search_text ilike '%' || trim(p_keyword) || '%')
    and (nullif(trim(p_card_type), '') is null or card_type = trim(p_card_type))
    and (nullif(trim(p_world), '') is null or trim(p_world) = any(worlds))
  order by name;
$$;

revoke all on function public.search_cards(text, text, text, boolean) from public;
grant execute on function public.search_cards(text, text, text, boolean) to authenticated;

create or replace function public.create_deck(p_name text, p_flag_id uuid, p_buddy_card_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare user_id uuid; new_deck_id uuid;
begin
  user_id := auth.uid();
  if user_id is null then raise exception 'Authentication is required.'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Deck name is required.'; end if;
  if not exists (
    select 1
    from public.flags
    join public.cards on cards.id = flags.card_id
    where flags.id = p_flag_id
      and flags.can_be_selected_as_flag = true
      and cards.card_type = 'flag_card'
      and cards.is_active = true
  ) then raise exception 'Selected flag does not exist or is not selectable.'; end if;
  if not exists (select 1 from public.cards where id = p_buddy_card_id and is_active = true and card_type <> 'flag_card') then
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
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if not exists (select 1 from public.decks where id = p_deck_id and owner_id = auth.uid()) then
    raise exception 'Deck not found or access denied.';
  end if;
  if not exists (select 1 from public.cards where id = p_card_id and is_active = true) then
    raise exception 'Card not found or inactive.';
  end if;
  if p_selected_image_id is not null and not exists (
    select 1 from public.card_images where id = p_selected_image_id and card_id = p_card_id
  ) then raise exception 'Selected image does not belong to the card.'; end if;
  if p_quantity <= 0 then
    delete from public.deck_cards where deck_id = p_deck_id and card_id = p_card_id;
    return;
  end if;
  insert into public.deck_cards (deck_id, card_id, selected_image_id, quantity, sort_order)
  values (p_deck_id, p_card_id, p_selected_image_id, p_quantity, greatest(p_sort_order, 0))
  on conflict (deck_id, card_id) do update set
    selected_image_id = excluded.selected_image_id,
    quantity = excluded.quantity,
    sort_order = excluded.sort_order,
    updated_at = now();
end;
$$;
revoke all on function public.set_deck_card(uuid, uuid, integer, integer, uuid) from public;
grant execute on function public.set_deck_card(uuid, uuid, integer, integer, uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', true, null, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public, allowed_mime_types = excluded.allowed_mime_types;

create policy "public can view card image objects" on storage.objects for select to anon, authenticated
using (bucket_id = 'card-images');
create policy "users can upload card image objects" on storage.objects for insert to authenticated
with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users can update own card image objects" on storage.objects for update to authenticated
using (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users can delete own card image objects" on storage.objects for delete to authenticated
using (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
