"use client";

import Link from "next/link";

export type ImportPageLinkItem = {
  href: string;
  label: string;
};

type ImportPageLinksProps = {
  items: readonly ImportPageLinkItem[];
};

export function ImportPageLinks({ items }: ImportPageLinksProps) {
  return (
    <div className="dm-page-actions">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="dm-button secondary">
          {item.label}
        </Link>
      ))}
    </div>
  );
}
