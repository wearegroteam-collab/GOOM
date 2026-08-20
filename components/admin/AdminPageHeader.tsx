import type { ReactNode } from "react";

export function AdminPageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="admin-page-header"><div><p className="admin-kicker">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>;
}
