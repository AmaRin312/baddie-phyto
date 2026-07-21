begin;

-- Baddie Phyto battle ability registry seed.
--
-- Purpose:
-- - Register the ability behavior_key values that the app currently recognizes.
-- - Keep cards / card_abilities untouched here because card IDs differ by project data.
--
-- App-side recognized behavior_key values:
-- - face_down_soul
-- - biri_kinata_face_down_use
-- - levantine_item_limit_unlimited
-- - hyakugan_yamigedo
-- - ten_no_hanshin_composite
-- - chi_no_hanshin_composite

insert into public.abilities (
  name,
  behavior_key,
  description,
  params,
  is_active
)
values
  (
    '裏向きソウル',
    'face_down_soul',
    '対象カードをこのカードのソウルへ裏向きで入れるAbility。',
    '{}'::jsonb,
    true
  ),
  (
    'ビリ・キナータ 裏向き使用',
    'biri_kinata_face_down_use',
    '相手ドロップのカード1枚を選び、裏向きで相手Centerへ置く通知型Ability。',
    '{}'::jsonb,
    true
  ),
  (
    'レヴァンティン アイテム制限解除',
    'levantine_item_limit_unlimited',
    'この対戦中、アイテム枚数制限を解除するAbility。',
    '{}'::jsonb,
    true
  ),
  (
    'ヒャクガンヤミゲドウ',
    'hyakugan_yamigedo',
    'ヒャクガンヤミゲドウ関連Abilityの親識別子。',
    '{}'::jsonb,
    true
  ),
  (
    '天の半身 合体使用',
    'ten_no_hanshin_composite',
    '同じゾーン内の地の半身と組み合わせて、ヒャクガンヤミゲドウとして配置するAbility。',
    '{}'::jsonb,
    true
  ),
  (
    '地の半身 合体使用',
    'chi_no_hanshin_composite',
    '同じゾーン内の天の半身と組み合わせて、ヒャクガンヤミゲドウとして配置するAbility。',
    '{}'::jsonb,
    true
  )
on conflict (behavior_key) do update set
  name = excluded.name,
  description = excluded.description,
  params = excluded.params,
  is_active = excluded.is_active,
  updated_at = now();

commit;

