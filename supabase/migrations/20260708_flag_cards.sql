alter table public.cards
drop constraint if exists cards_card_type_check;

alter table public.cards
add constraint cards_card_type_check
check (card_type in ('monster', 'spell', 'item', 'impact', 'flag_card', 'other'));

alter table public.flags
drop column if exists name;

alter table public.flags
add column if not exists card_id uuid unique references public.cards(id) on delete restrict;

alter table public.flags
add column if not exists can_be_selected_as_flag boolean not null default true;

create index if not exists flags_card_id_index on public.flags (card_id);
create index if not exists flags_selectable_index on public.flags (can_be_selected_as_flag);

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

drop trigger if exists flags_validate_card on public.flags;
create trigger flags_validate_card
before insert or update of card_id on public.flags
for each row execute function public.validate_flag_card();

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
