begin;

alter table public.decks
  add column if not exists selected_flag_image_id uuid references public.card_images(id) on delete set null;

create index if not exists decks_selected_flag_image_id_index
on public.decks (selected_flag_image_id);

create or replace function public.validate_deck_selected_flag_image()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  flag_card_id uuid;
  image_card_id uuid;
begin
  if new.selected_flag_image_id is null then
    return new;
  end if;

  if new.flag_id is null then
    raise exception 'selected_flag_image_id requires flag_id.';
  end if;

  select card_id
  into flag_card_id
  from public.flags
  where id = new.flag_id;

  if flag_card_id is null then
    raise exception 'flag_id does not reference a flag card.';
  end if;

  select card_id
  into image_card_id
  from public.card_images
  where id = new.selected_flag_image_id;

  if image_card_id is null then
    raise exception 'selected_flag_image_id does not exist.';
  end if;

  if image_card_id <> flag_card_id then
    raise exception 'selected_flag_image_id must belong to the selected flag card.';
  end if;

  return new;
end;
$$;

drop trigger if exists decks_validate_selected_flag_image on public.decks;
create trigger decks_validate_selected_flag_image
before insert or update of flag_id, selected_flag_image_id on public.decks
for each row
execute function public.validate_deck_selected_flag_image();

commit;
