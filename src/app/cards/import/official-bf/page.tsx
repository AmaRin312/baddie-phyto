import { redirect } from "next/navigation";

export default function OfficialBfImportRedirectPage() {
  redirect("/cards/import/excel-zip");
}
