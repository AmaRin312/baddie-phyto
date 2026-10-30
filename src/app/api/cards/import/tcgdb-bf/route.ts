import { NextResponse } from "next/server";

function createDeprecatedImportResponse() {
  return NextResponse.json(
    {
      error:
        "tcgdb-bf API import route is no longer available. Use /cards/import/excel-zip instead."
    },
    { status: 410 }
  );
}

export async function GET() {
  return createDeprecatedImportResponse();
}

export async function POST() {
  return createDeprecatedImportResponse();
}
