alter table public.card_images
add column if not exists thumbnail_path text
check (thumbnail_path is null or char_length(trim(thumbnail_path)) > 0);

alter table public.card_images
add column if not exists is_default boolean not null default false;

create index if not exists card_images_thumbnail_path_index
on public.card_images (thumbnail_path);

create unique index if not exists card_images_one_default_per_card_unique
on public.card_images (card_id)
where is_default = true;

alter table public.deck_cards
add column if not exists selected_image_id uuid references public.card_images(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deck_cards'
      and column_name = 'card_image_id'
  ) then
    update public.deck_cards
    set selected_image_id = card_image_id
    where selected_image_id is null
      and card_image_id is not null;
  end if;
end;
$$;

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

drop trigger if exists deck_cards_validate_image on public.deck_cards;
drop trigger if exists deck_cards_validate_selected_image on public.deck_cards;
create trigger deck_cards_validate_selected_image
before insert or update of card_id, selected_image_id on public.deck_cards
for each row execute function public.validate_deck_card_selected_image();

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
    raise exception 'Card not found, inactive, or cannot be placed in deck.';
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

drop policy if exists "users can insert own card images" on public.card_images;
create policy "users can insert own card images" on public.card_images for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and split_part(image_path, '/', 1) = (select auth.uid())::text
  and (thumbnail_path is null or split_part(thumbnail_path, '/', 1) = (select auth.uid())::text)
);

drop policy if exists "users can update own card images" on public.card_images;
create policy "users can update own card images" on public.card_images for update to authenticated
using (owner_id = (select auth.uid()))
with check (
  owner_id = (select auth.uid())
  and split_part(image_path, '/', 1) = (select auth.uid())::text
  and (thumbnail_path is null or split_part(thumbnail_path, '/', 1) = (select auth.uid())::text)
);
