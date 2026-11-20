update public.cards
set orientation = 'horizontal'
where regexp_replace(name, '[[:space:]・･]', '', 'g') like '%ヒャクガンヤミゲドウ%'
  and orientation is distinct from 'horizontal';
