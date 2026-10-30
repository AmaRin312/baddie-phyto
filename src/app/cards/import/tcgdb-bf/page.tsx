import { redirect } from "next/navigation";

export default function TcgdbBfImportRedirectPage() {
  redirect("/cards/import/excel-zip");
}
