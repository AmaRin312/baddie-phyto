import type {
  CardImageRecord,
  DeckCardRecord,
  CardRecord,
  DeckRecord,
  FlagRecord
} from "@/types/baddiePhyto";

type DeckEntryCachePayload = {
  cachedAt: number;
  decks: DeckRecord[];
  flags: FlagRecord[];
  cards: CardRecord[];
  images: CardImageRecord[];
};

const DECK_ENTRY_CACHE_KEY = "baddie_phyto_deck_entry_cache_v1";
const DECK_CARD_CACHE_KEY_PREFIX = "baddie_phyto_deck_cards_v1:";
const DECK_ENTRY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readDeckEntryCache(): DeckEntryCachePayload | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(DECK_ENTRY_CACHE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<DeckEntryCachePayload>;
    if (
      typeof parsed.cachedAt !== "number" ||
      !Array.isArray(parsed.decks) ||
      !Array.isArray(parsed.flags) ||
      !Array.isArray(parsed.cards) ||
      !Array.isArray(parsed.images)
    ) {
      return null;
    }

    if (Date.now() - parsed.cachedAt > DECK_ENTRY_CACHE_MAX_AGE_MS) {
      window.localStorage.removeItem(DECK_ENTRY_CACHE_KEY);
      return null;
    }

    return {
      cachedAt: parsed.cachedAt,
      decks: parsed.decks,
      flags: parsed.flags,
      cards: parsed.cards,
      images: parsed.images
    };
  } catch {
    return null;
  }
}

export function writeDeckEntryCache(payload: Omit<DeckEntryCachePayload, "cachedAt">) {
  if (!canUseStorage()) {
    return;
  }

  try {
    const nextPayload: DeckEntryCachePayload = {
      ...payload,
      cachedAt: Date.now()
    };
    window.localStorage.setItem(DECK_ENTRY_CACHE_KEY, JSON.stringify(nextPayload));
  } catch {
    // ignore storage write failures
  }
}

export function mergeDeckEntryCacheDeck(deck: DeckRecord) {
  const current = readDeckEntryCache();
  if (!current) {
    return;
  }

  const nextDecks = [
    deck,
    ...current.decks.filter((currentDeck) => currentDeck.id !== deck.id)
  ];

  writeDeckEntryCache({
    decks: nextDecks,
    flags: current.flags,
    cards: current.cards,
    images: current.images
  });
}

export function removeDeckEntryCacheDeck(deckId: string) {
  const current = readDeckEntryCache();
  if (!current) {
    return;
  }

  writeDeckEntryCache({
    decks: current.decks.filter((deck) => deck.id !== deckId),
    flags: current.flags,
    cards: current.cards,
    images: current.images
  });
}

function getDeckCardCacheKey(deckId: string) {
  return `${DECK_CARD_CACHE_KEY_PREFIX}${deckId}`;
}

export function readCachedDeckCards(deckId: string): DeckCardRecord[] | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(getDeckCardCacheKey(deckId));
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as {
      cachedAt?: number;
      deckCards?: DeckCardRecord[];
    };

    if (typeof parsed.cachedAt !== "number" || !Array.isArray(parsed.deckCards)) {
      return null;
    }

    if (Date.now() - parsed.cachedAt > DECK_ENTRY_CACHE_MAX_AGE_MS) {
      window.localStorage.removeItem(getDeckCardCacheKey(deckId));
      return null;
    }

    return parsed.deckCards;
  } catch {
    return null;
  }
}

export function writeCachedDeckCards(deckId: string, deckCards: DeckCardRecord[]) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(
      getDeckCardCacheKey(deckId),
      JSON.stringify({
        cachedAt: Date.now(),
        deckCards
      })
    );
  } catch {
    // ignore storage write failures
  }
}

export function removeCachedDeckCards(deckId: string) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(getDeckCardCacheKey(deckId));
  } catch {
    // ignore storage failures
  }
}
