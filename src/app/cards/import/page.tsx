"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ImportMethodCards, type ImportMethodCardItem } from "@/components/cards/import/ImportMethodCards";
import { ImportPageLinks, type ImportPageLinkItem } from "@/components/cards/import/ImportPageLinks";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";

const PAGE_LINKS: readonly ImportPageLinkItem[] = [
  { href: "/cards", label: "カード一覧へ戻る" },
  { href: "/cards/import/history", label: "インポート履歴" },
  { href: "/cards/export", label: "CSVエクスポート" }
] as const;

const IMPORT_METHODS: readonly ImportMethodCardItem[] = [
  {
    title: "CSVインポート",
    description:
      "カード情報だけを CSV から取り込みます。既存データの調整や差分登録に向いています。"
  },
  {
    href: "/cards/import/excel-zip",
    title: "Excel + 画像ZIP",
    description:
      "サイト向けファイルをドロップして、カード情報と画像をまとめて登録する方法です。"
  },
  {
    href: "/cards/import/official-bf",
    title: "公式カードリストURL",
    description:
      "公式カードリストのパック URL から、カード情報と画像を取得して登録します。"
  },
  {
    href: "/cards/import/tcgdb-bf",
    title: "TCG DB BF",
    description:
      "TCG DB BF のカード URL または card_key を使ってカード情報を取り込みます。"
  }
] as const;

export default function CardImportPage() {
  const router = useRouter();

  useEffect(() => {
    async function loadPage() {
      if (!(await getOrCreateProfile())) {
        router.replace("/login");
      }
    }

    void loadPage();
  }, [router]);

  return (
    <AppShell>
      <div className="dm-stack">
        <ImportPageLinks items={PAGE_LINKS} />

        <AppCard
          title="カード登録方法"
          description="用途に合った登録方法を選んでください。判定付きインポートや ZIP 方式もここから開けます。"
        >
          <ImportMethodCards items={IMPORT_METHODS} />
        </AppCard>

        <AppCard
          title="使い分け"
          description="登録対象に応じて、次の方法を使い分けると管理しやすいです。"
        >
          <ul>
            <li>画像込みでまとめて登録するなら Excel + 画像ZIP</li>
            <li>公式カードリストから登録するなら 公式カードリストURL</li>
            <li>TCG DB BF から登録するなら TCG DB BF</li>
            <li>カード情報だけを調整しながら入れるなら CSVインポート</li>
          </ul>
        </AppCard>
      </div>
    </AppShell>
  );
}
