select
  behavior_key,
  name,
  is_active
from public.abilities
where behavior_key in (
  'face_down_soul',
  'biri_kinata_face_down_use',
  'levantine_item_limit_unlimited',
  'hyakugan_yamigedo',
  'ten_no_hanshin_composite',
  'chi_no_hanshin_composite'
)
order by behavior_key;

