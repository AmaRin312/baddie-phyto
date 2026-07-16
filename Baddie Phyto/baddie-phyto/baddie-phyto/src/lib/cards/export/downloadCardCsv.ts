import type { CardCsvExportScope } from "@/lib/cards/export/cardCsvExportTypes";

function sanitizeFileNamePart(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
}

export function createCardCsvFileName(input: {
  scope: CardCsvExportScope;
  setCode?: string | null;
  includeInactive: boolean;
}) {
  if (input.scope === "set" && input.setCode) {
    return `${sanitizeFileNamePart(input.setCode)}_cards.csv`;
  }

  return input.includeInactive
    ? "baddie_phyto_all_cards.csv"
    : "baddie_phyto_active_cards.csv";
}

export function downloadCardCsv(input: {
  csvText: string;
  fileName: string;
  withBom?: boolean;
}) {
  const text = input.withBom === false ? input.csvText : `\uFEFF${input.csvText}`;
  const blob = new Blob([text], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = input.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
