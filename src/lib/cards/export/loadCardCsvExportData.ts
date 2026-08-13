import { supabase } from "@/lib/supabase/client";
import type { CardRecord } from "@/types/baddiePhyto";
import type {
  CardCsvExportData,
  CardCsvExportSet,
  ExportableCard,
  LoadCardCsvExportInput
} from "@/lib/cards/export/cardCsvExportTypes";

type CardAbilityExportRow = {
  card_id: string;
  abilities: {
    behavior_key: string | null;
  } | null;
};

type PrintingExportRow = {
  card_id: string;
};

export async function loadCardCsvExportSets(): Promise<{
  sets: CardCsvExportSet[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("card_sets")
    .select("id,set_code,name")
    .order("set_code")
    .returns<CardCsvExportSet[]>();

  if (error) {
    return { sets: [], error: error.message };
  }

  return { sets: data ?? [], error: null };
}

async function loadCardIdsForSet(setId: string) {
  const { data, error } = await supabase
    .from("card_printings")
    .select("card_id")
    .eq("set_id", setId)
    .returns<PrintingExportRow[]>();

  if (error) {
    return { cardIds: [], duplicateCardIds: [], error: error.message };
  }

  const counts = new Map<string, number>();
  (data ?? []).forEach((row) => {
    counts.set(row.card_id, (counts.get(row.card_id) ?? 0) + 1);
  });

  return {
    cardIds: Array.from(counts.keys()),
    duplicateCardIds: Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([cardId]) => cardId),
    error: null
  };
}

async function loadAbilityKeys(cardIds: string[]) {
  if (cardIds.length === 0) {
    return { abilityMap: new Map<string, string[]>(), error: null };
  }

  const { data, error } = await supabase
    .from("card_abilities")
    .select("card_id,abilities(behavior_key)")
    .in("card_id", cardIds)
    .returns<CardAbilityExportRow[]>();

  if (error) {
    return { abilityMap: new Map<string, string[]>(), error: error.message };
  }

  const abilityMap = new Map<string, string[]>();
  (data ?? []).forEach((row) => {
    const behaviorKey = row.abilities?.behavior_key;
    if (!behaviorKey) return;
    abilityMap.set(row.card_id, [...(abilityMap.get(row.card_id) ?? []), behaviorKey]);
  });

  return { abilityMap, error: null };
}

export async function loadExportableCards(
  input: LoadCardCsvExportInput
): Promise<{ data: CardCsvExportData | null; error: string | null }> {
  let targetCardIds: string[] | null = null;
  const warnings: string[] = [];

  if (input.scope === "set") {
    if (!input.setId) {
      return { data: null, error: "パックを選択してください。" };
    }

    const setResult = await loadCardIdsForSet(input.setId);
    if (setResult.error) {
      return { data: null, error: setResult.error };
    }

    targetCardIds = setResult.cardIds;
    if (setResult.duplicateCardIds.length > 0) {
      warnings.push(
        `同一パック内で同じカードの収録情報が重複しています（${setResult.duplicateCardIds.length}件）。CSVには1カード1行で出力します。`
      );
    }
  }

  if (targetCardIds && targetCardIds.length === 0) {
    return { data: { cards: [], warnings }, error: null };
  }

  let query = supabase.from("cards").select("*").order("name");
  if (!input.includeInactive) {
    query = query.eq("is_active", true);
  }
  if (targetCardIds) {
    query = query.in("id", targetCardIds);
  }

  const { data: cards, error: cardsError } = await query.returns<CardRecord[]>();
  if (cardsError) {
    return { data: null, error: cardsError.message };
  }

  const cardIds = (cards ?? []).map((card) => card.id);
  const abilityResult = await loadAbilityKeys(cardIds);
  if (abilityResult.error) {
    return { data: null, error: abilityResult.error };
  }

  const exportableCards: ExportableCard[] = (cards ?? []).map((card) => ({
    ...card,
    abilityKeys: abilityResult.abilityMap.get(card.id) ?? []
  }));

  return {
    data: {
      cards: exportableCards,
      warnings
    },
    error: null
  };
}
