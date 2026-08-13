with flag_cards(name, worlds, initial_life, initial_hand, initial_gauge) as (
  values
    ('ドラゴンワールド', array['ドラゴンワールド'], 10, 6, 2),
    ('デンジャーワールド', array['デンジャーワールド'], 10, 6, 2),
    ('マジックワールド', array['マジックワールド'], 10, 6, 2),
    ('カタナワールド', array['カタナワールド'], 10, 6, 2),
    ('エンシェントワールド', array['エンシェントワールド'], 10, 6, 2),
    ('ダンジョンワールド', array['ダンジョンワールド'], 10, 6, 2),
    ('レジェンドワールド', array['レジェンドワールド'], 10, 6, 2),
    ('ダークネスドラゴンワールド', array['ダークネスドラゴンワールド'], 10, 6, 2),
    ('ヒーローワールド', array['ヒーローワールド'], 10, 6, 2),
    ('スタードラゴンワールド', array['スタードラゴンワールド'], 10, 6, 2),
    ('ドラゴン・アイン', array['ドラゴンワールド', 'ドラゴン・アイン'], 12, 4, 2),
    ('ドラゴン・ツヴァイ', array['ドラゴンワールド', 'ドラゴン・ツヴァイ'], 20, 4, 2),
    ('楽園天国', array['楽園天国'], 12, 6, 1),
    ('灼熱地獄', array['灼熱地獄'], 8, 6, 4),
    ('the Chaos', array['the Chaos'], 10, 4, 2),
    ('竜牙雷帝', array['ドラゴンワールド', '竜牙雷帝'], 11, 7, 1)
),
inserted_cards as (
  insert into public.cards (
    name,
    worlds,
    races,
    orientation,
    card_type,
    card_text,
    is_active
  )
  select
    flag_cards.name,
    flag_cards.worlds,
    '{}'::text[],
    'vertical',
    'flag_card',
    flag_cards.name || 'のフラッグカード。',
    true
  from flag_cards
  where not exists (
    select 1
    from public.cards
    where cards.name = flag_cards.name
      and cards.card_type = 'flag_card'
  )
  returning id, name
)
insert into public.flags (
  card_id,
  usable_worlds,
  initial_life,
  initial_hand,
  initial_gauge,
  can_be_selected_as_flag
)
select
  cards.id,
  flag_cards.worlds,
  flag_cards.initial_life,
  flag_cards.initial_hand,
  flag_cards.initial_gauge,
  true
from flag_cards
join public.cards on cards.name = flag_cards.name and cards.card_type = 'flag_card'
where not exists (
  select 1
  from public.flags
  where flags.card_id = cards.id
);

insert into public.abilities (name, behavior_key, description, params)
values
  ('貫通', 'penetrate', 'センターのモンスターを破壊した時、相手にダメージを与える能力。', '{}'::jsonb),
  ('移動', 'move', '相手ターンの攻撃中にカードを別のエリアへ移動できる能力。', '{}'::jsonb),
  ('ソウルガード', 'soulguard', '破壊される時、ソウルを1枚捨てて場に残せる能力。', '{}'::jsonb),
  ('反撃', 'counterattack', '攻撃された後、攻撃してきたカードを破壊できる能力。', '{}'::jsonb)
on conflict (behavior_key) do update set
  name = excluded.name,
  description = excluded.description,
  params = excluded.params,
  is_active = true,
  updated_at = now();
