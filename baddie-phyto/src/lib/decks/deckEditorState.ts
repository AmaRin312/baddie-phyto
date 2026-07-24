import type { DeckCardRecord } from "@/types/baddiePhyto";

export type DeckCardDraft = {
  cardId: string;
  quantity: number;
  selectedImageId: string | null;
  sortOrder: number;
};

export function createDeckCardDrafts(deckCards: DeckCardRecord[]): DeckCardDraft[] {
  return deckCards
    .map((item) => ({
      cardId: item.card_id,
      quantity: item.quantity,
      selectedImageId: item.selected_image_id,
      sortOrder: item.sort_order
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function createDeckCardDraftMap(drafts: DeckCardDraft[]) {
  return new Map(drafts.map((draft) => [draft.cardId, draft]));
}

export function setDeckCardDraftQuantity(
  drafts: DeckCardDraft[],
  input: {
    cardId: string;
    quantity: number;
    selectedImageId?: string | null;
  }
) {
  const nextQuantity = Math.max(0, input.quantity);
  const existing = drafts.find((draft) => draft.cardId === input.cardId);

  if (nextQuantity === 0) {
    return drafts.filter((draft) => draft.cardId !== input.cardId);
  }

  if (existing) {
    return drafts.map((draft) =>
      draft.cardId === input.cardId
        ? {
            ...draft,
            quantity: nextQuantity,
            selectedImageId:
              input.selectedImageId !== undefined
                ? input.selectedImageId
                : draft.selectedImageId
          }
        : draft
    );
  }

  return [
    ...drafts,
    {
      cardId: input.cardId,
      quantity: nextQuantity,
      selectedImageId: input.selectedImageId ?? null,
      sortOrder:
        drafts.length === 0
          ? 0
          : Math.max(...drafts.map((draft) => draft.sortOrder)) + 1
    }
  ];
}

export function setDeckCardDraftImage(
  drafts: DeckCardDraft[],
  input: {
    cardId: string;
    selectedImageId: string | null;
  }
) {
  return drafts.map((draft) =>
    draft.cardId === input.cardId
      ? { ...draft, selectedImageId: input.selectedImageId }
      : draft
  );
}

export function reorderDeckCardDrafts(
  drafts: DeckCardDraft[],
  input: {
    draggedCardId: string;
    targetCardId: string;
  }
) {
  if (input.draggedCardId === input.targetCardId) return drafts;

  const draggedIndex = drafts.findIndex((draft) => draft.cardId === input.draggedCardId);
  const targetIndex = drafts.findIndex((draft) => draft.cardId === input.targetCardId);
  if (draggedIndex < 0 || targetIndex < 0) return drafts;

  const next = [...drafts];
  const [draggedDraft] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, draggedDraft);

  return next.map((draft, index) => ({
    ...draft,
    sortOrder: index
  }));
}

export function areDeckCardDraftsEqual(
  left: DeckCardDraft[],
  right: DeckCardDraft[]
) {
  if (left.length !== right.length) return false;

  const leftSorted = [...left].sort((a, b) => a.cardId.localeCompare(b.cardId));
  const rightSorted = [...right].sort((a, b) => a.cardId.localeCompare(b.cardId));

  return leftSorted.every((leftItem, index) => {
    const rightItem = rightSorted[index];
    return (
      leftItem.cardId === rightItem.cardId &&
      leftItem.quantity === rightItem.quantity &&
      leftItem.selectedImageId === rightItem.selectedImageId &&
      leftItem.sortOrder === rightItem.sortOrder
    );
  });
}
