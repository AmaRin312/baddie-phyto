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
