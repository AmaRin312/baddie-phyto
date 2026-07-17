import {
  CARD_CSV_HEADERS,
  CARD_CSV_LEGACY_HEADERS
} from "@/lib/cards/import/cardCsvConstants";
import type { CardCsvError, CardCsvRawRow } from "@/lib/cards/import/cardCsvTypes";

export function parseCardSetFromFileName(fileName: string) {
  const baseName = fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/_cards$/i, "")
    .trim();
  const [rawCode, ...nameParts] = baseName.split("_");
  const setCode = (rawCode || baseName).trim();
  const setName = nameParts.join("_").trim() || setCode;

  return {
    setCode,
    setName
  };
}

function parseCsvRecords(csvText: string) {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = "";
  let inQuotes = false;
  const text = csvText.replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        currentField += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRecord.push(currentField);
      currentField = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRecord.push(currentField);
      records.push(currentRecord);
      currentRecord = [];
      currentField = "";
      continue;
    }

    currentField += char;
  }

  if (inQuotes) {
    throw new Error("CSVの引用符が閉じられていません。");
  }

  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField);
    records.push(currentRecord);
  }

  return records.filter((record) => record.some((field) => field.trim() !== ""));
}

export function parseCardCsv(csvText: string): {
  rows: CardCsvRawRow[];
  errors: CardCsvError[];
} {
  try {
    const records = parseCsvRecords(csvText);
    const [headers, ...body] = records;
    const errors: CardCsvError[] = [];

    if (!headers) {
      return {
        rows: [],
        errors: [
          {
            rowNumber: 1,
            column: "file",
            message: "CSVが空です。"
          }
        ]
      };
    }

    const usesVersionedHeaders = (headers[0] ?? "").trim() === "csv_version";
    const expectedHeaders = usesVersionedHeaders
      ? CARD_CSV_HEADERS
      : CARD_CSV_LEGACY_HEADERS;

    expectedHeaders.forEach((expectedHeader, index) => {
      if ((headers[index] ?? "").trim() !== expectedHeader) {
        errors.push({
          rowNumber: 1,
          column: "header",
          message: `${index + 1}列目は "${expectedHeader}" である必要があります。`
        });
      }
    });

    if (headers.length !== expectedHeaders.length) {
      errors.push({
        rowNumber: 1,
        column: "header",
        message: `列数が一致しません。期待: ${expectedHeaders.length} / 実際: ${headers.length}`
      });
    }

    const rows = body.map((record, rowIndex) => {
      const values = Object.fromEntries(
        expectedHeaders.map((header, columnIndex) => [
          header,
          record[columnIndex] ?? ""
        ])
      );

      if (!usesVersionedHeaders) {
        values.csv_version = "";
      }

      return {
        rowNumber: rowIndex + 2,
        values
      };
    });

    return { rows, errors };
  } catch (error) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          column: "file",
          message: error instanceof Error ? error.message : "CSV解析に失敗しました。"
        }
      ]
    };
  }
}
