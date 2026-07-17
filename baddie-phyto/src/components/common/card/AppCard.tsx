import type { ReactNode } from "react";

type AppCardProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

export function AppCard({ title, description, children }: AppCardProps) {
  return (
    <section className="dm-app-card">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>

      {children}
    </section>
  );
}