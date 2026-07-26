begin;

alter table public.decks
  add column if not exists selected_buddy_image_id uuid references public.card_images(id) on delete set null;

create index if not exists decks_selected_buddy_image_id_index
on public.decks (selected_buddy_image_id);

create or replace function public.validate_deck_selected_buddy_image()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  image_card_id uuid;
begin
  if new.selected_buddy_image_id is null then
    return new;
  end if;

  if new.buddy_card_id is null then
    raise exception 'selected_buddy_image_id requires buddy_card_id.';
  end if;

  select card_id
  into image_card_id
  from public.card_images
  where id = new.selected_buddy_image_id;

  if image_card_id is null then
    raise exception 'selected_buddy_image_id does not exist.';
  end if;

  if image_card_id <> new.buddy_card_id then
    raise exception 'selected_buddy_image_id must belong to buddy_card_id.';
  end if;

  return new;
end;
$$;

drop trigger if exists decks_validate_selected_buddy_image on public.decks;
create trigger decks_validate_selected_buddy_image
before insert or update of buddy_card_id, selected_buddy_image_id on public.decks
for each row
execute function public.validate_deck_selected_buddy_image();

comment on column public.decks.selected_buddy_image_id is
  'Deck-level buddy image selection. Separate from deck_cards.selected_image_id.';

commit;
