"use client";

import Link from "next/link";

export type ImportMethodCardItem = {
  href?: string;
  title: string;
  description: string;
};

type ImportMethodCardsProps = {
  items: readonly ImportMethodCardItem[];
};

export function ImportMethodCards({ items }: ImportMethodCardsProps) {
  return (
    <div className="dm-grid dm-grid-3">
      {items.map((item) =>
        item.href ? (
          <Link
            key={item.title}
            href={item.href}
            className="dm-card-surface"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </Link>
        ) : (
          <div key={item.title} className="dm-card-surface">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
        )
      )}
    </div>
  );
}
