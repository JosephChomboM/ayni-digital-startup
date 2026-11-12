import { Flower2 } from "lucide-react";

export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <header className="page-intro"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{children}</p></div>
    <Flower2 className="page-flower" aria-hidden="true" strokeWidth={1}/></header>;
}
