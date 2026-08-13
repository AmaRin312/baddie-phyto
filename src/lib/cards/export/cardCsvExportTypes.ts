import type { CardRecord } from "@/types/baddiePhyto";

export type CardCsvExportScope = "all" | "set";

export type CardCsvExportSet = {
  id: string;
  set_code: string;
  name: string | null;
};

export type ExportableCard = CardRecord & {
  abilityKeys: string[];
};

export type CardCsvExportData = {
  cards: ExportableCard[];
  warnings: string[];
};

export type LoadCardCsvExportInput = {
  scope: CardCsvExportScope;
  setId: string | null;
  includeInactive: boolean;
};
