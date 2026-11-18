update public.cards
set orientation = 'horizontal'
where regexp_replace(name, '[[:space:]・･]', '', 'g') like '%災禍の大邪神ヒャクガンヤミゲドウ%'
  and orientation is distinct from 'horizontal';
