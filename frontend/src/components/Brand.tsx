import { Heart } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="ayni-brand"><span className="ayni-brand-mark"><Heart aria-hidden="true"/><i/></span>
    <span><strong>ayni<span>°</span></strong>{!compact && <small>Recuerdos que nos acercan</small>}</span></span>;
}
