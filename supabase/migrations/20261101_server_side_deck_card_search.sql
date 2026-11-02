begin;

alter table public.cards
  add column if not exists is_original boolean not null default false;

create or replace function public.list_deck_card_search_worlds()
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct world_name
  from public.cards as card
  cross join lateral unnest(card.worlds) as world_name
  where card.is_active
  order by world_name;
$$;

create or replace function public.search_deck_cards(
  p_name text default null,
  p_card_text text default null,
  p_worlds text[] default '{}',
  p_card_types text[] default '{}',
  p_race_keyword text default null,
  p_eras text[] default '{}',
  p_set_ids uuid[] default '{}',
  p_original_mode text default 'all',
  p_attributes text[] default '{}',
  p_preferred_worlds text[] default '{}',
  p_excluded_card_id uuid default null,
  p_page_size integer default 100,
  p_page_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as materialized (
    select card.*
    from public.cards as card
    where card.is_active
      and (p_excluded_card_id is null or card.id <> p_excluded_card_id)
      and (nullif(trim(p_name), '') is null or card.name ilike '%' || trim(p_name) || '%')
      and (nullif(trim(p_card_text), '') is null or coalesce(card.card_text, '') ilike '%' || trim(p_card_text) || '%')
      and (coalesce(cardinality(p_worlds), 0) = 0 or card.worlds && p_worlds)
      and (coalesce(cardinality(p_card_types), 0) = 0 or card.card_type = any(p_card_types))
      and (
        nullif(trim(p_race_keyword), '') is null
        or exists (
          select 1
          from unnest(card.races) as race_name
          where race_name ilike '%' || trim(p_race_keyword) || '%'
        )
      )
      and (
        p_original_mode not in ('official', 'original')
        or (p_original_mode = 'original' and card.is_original)
        or (p_original_mode = 'official' and not card.is_original)
      )
      and ('dragon' <> all(coalesce(p_attributes, '{}')) or card.is_dragon)
      and ('hyakki' <> all(coalesce(p_attributes, '{}')) or card.is_hyakki)
      and ('cornerKing' <> all(coalesce(p_attributes, '{}')) or card.is_corner_king)
      and ('chaos' <> all(coalesce(p_attributes, '{}')) or card.is_chaos)
      and ('generic' <> all(coalesce(p_attributes, '{}')) or card.is_generic)
      and ('heaven' <> all(coalesce(p_attributes, '{}')) or card.is_heaven)
      and ('hell' <> all(coalesce(p_attributes, '{}')) or card.is_hell)
      and (
        coalesce(cardinality(p_eras), 0) = 0
        or exists (
          select 1
          from public.card_printings as printing
          join public.card_sets as card_set on card_set.id = printing.set_id
          where printing.card_id = card.id
            and card_set.era_key = any(p_eras)
        )
      )
      and (
        coalesce(cardinality(p_set_ids), 0) = 0
        or exists (
          select 1
          from public.card_printings as printing
          where printing.card_id = card.id
            and printing.set_id = any(p_set_ids)
        )
      )
  ),
  page as (
    select
      filtered.*,
      case
        when coalesce(cardinality(p_preferred_worlds), 0) > 0
          and filtered.worlds && p_preferred_worlds then 0
        else 1
      end as preferred_rank,
      case filtered.card_type
        when 'monster' then 0
        when 'spell' then 1
        when 'item' then 2
        when 'impact' then 3
        when 'impact_monster' then 4
        when 'flag_card' then 5
        else 6
      end as type_rank
    from filtered
    order by
      preferred_rank,
      filtered.name,
      type_rank,
      case when filtered.card_type = 'monster' then filtered.size end desc nulls last,
      filtered.id
    limit greatest(1, least(coalesce(p_page_size, 100), 100))
    offset greatest(coalesce(p_page_offset, 0), 0)
  )
  select jsonb_build_object(
    'items', coalesce(
      (
        select jsonb_agg(
          to_jsonb(page) - 'preferred_rank' - 'type_rank'
          order by
            page.preferred_rank,
            page.name,
            page.type_rank,
            case when page.card_type = 'monster' then page.size end desc nulls last,
            page.id
        )
        from page
      ),
      '[]'::jsonb
    ),
    'totalCount', (select count(*) from filtered)
  );
$$;

revoke all on function public.list_deck_card_search_worlds() from public;
revoke all on function public.search_deck_cards(text, text, text[], text[], text, text[], uuid[], text, text[], text[], uuid, integer, integer) from public;
grant execute on function public.list_deck_card_search_worlds() to authenticated;
grant execute on function public.search_deck_cards(text, text, text[], text[], text, text[], uuid[], text, text[], text[], uuid, integer, integer) to authenticated;

commit;
