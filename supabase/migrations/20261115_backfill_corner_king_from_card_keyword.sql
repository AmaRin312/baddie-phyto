update public.cards
set is_corner_king = true
where not is_corner_king
  and card_text ~ '^[[:space:]]*『角王』';
