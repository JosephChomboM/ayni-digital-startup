import { useEffect, useState } from "react";
import { CreditCard, LibraryBig, ShieldCheck, UserRound, Users } from "lucide-react";
import type { User } from "../api/auth";
import { getMyFamily } from "../api/families";
import type { Family } from "../api/families";
import { BillingPanel } from "../components/BillingPanel";
import { ProfilePage } from "./ProfilePage";
import { listMemories, memoryErrorMessage } from "../api/memories";
import type { Memory } from "../api/memories";
import { AccountControls } from "../components/AccountControls";

export type AccountSection = "overview" | "family" | "personal" | "plan" | "memories";

interface AccountPageProps {
  currentUser: User;
  initialSection: AccountSection;
  onSectionChange: (section: AccountSection) => void;
  onUserUpdated?: (user: User) => void;
}

const sections = [
  { id: "family", label: "Perfil de la familia", detail: "Perfil familiar", icon: Users },
  { id: "personal", label: "Información del perfil", detail: "Mis datos", icon: UserRound },
  { id: "plan", label: "Plan suscrito", detail: "Estado y opciones de suscripción", icon: CreditCard },
  { id: "memories", label: "Recuerdos subidos", detail: "Anécdotas y canciones que compartiste", icon: LibraryBig },
] as const;

export function AccountPage({ currentUser, initialSection, onSectionChange, onUserUpdated }: AccountPageProps) {
  const [family, setFamily] = useState<Family | null>(null);
  const [familyLoading, setFamilyLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getMyFamily().then((value) => { if (active) setFamily(value); }).catch(() => {
      if (active) setFamily(null);
    }).finally(() => { if (active) setFamilyLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="account-page grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="self-start lg:sticky lg:top-24">
        <p className="text-xl font-semibold text-[#235c50]">Configuración y privacidad</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Administra los datos de tu familia, tu plan y los recuerdos que compartiste.</p>
        <nav aria-label="Configuración de la cuenta" className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          {sections.map(({ id, label, detail, icon: Icon }) => (
            <button key={id} onClick={() => onSectionChange(id)} aria-current={initialSection === id ? "page" : undefined}
              className={`flex min-w-52 items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors lg:min-w-0 ${initialSection === id ? "bg-slate-100 text-[#235c50]" : "text-slate-700 hover:bg-slate-50"}`}>
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-slate-500">{detail}</span></span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="min-w-0" aria-live="polite">
        {initialSection === "overview" && <>
          <div className="mb-7">
            <p className="text-sm font-semibold text-[#b94c35]">Tu cuenta Ayni</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#235c50]">Encuentra lo que necesitas</h1>
          </div>
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {sections.map(({ id, label, detail, icon: Icon }) => (
              <button key={id} onClick={() => onSectionChange(id)} className="flex items-start gap-4 py-4 text-left group">
                <Icon className="mt-1 size-5 shrink-0 text-[#235c50]" aria-hidden="true" />
                <span><span className="block font-semibold text-[#223e38] group-hover:text-[#b94c35]">{label}</span><span className="mt-1 block text-sm leading-relaxed text-slate-600">{detail}</span></span>
              </button>
            ))}
          </div>
          <div className="mt-8 flex items-start gap-3 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#235c50]" aria-hidden="true" />
            <p>Tu cuenta reúne información familiar y recuerdos privados para acompañar momentos compartidos.</p>
          </div>
        </>}

        {initialSection === "family" && <div className="max-w-2xl"><p className="mb-5 text-sm font-semibold text-[#b94c35]">Perfil de la familia</p><ProfilePage currentUser={currentUser} /></div>}

        {initialSection === "personal" && <div className="max-w-2xl space-y-6">
          <div><p className="text-sm font-semibold text-[#b94c35]">Información del perfil</p><h1 className="mt-1 text-2xl font-semibold text-[#235c50]">Mis datos</h1><p className="mt-2 text-sm text-slate-600">Información asociada a tu cuenta de Ayni Digital.</p></div>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold text-slate-500">Nombre</dt><dd className="mt-1 text-base text-[#223e38]">{currentUser.name}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Correo electrónico</dt><dd className="mt-1 break-all text-base text-[#223e38]">{currentUser.email}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Tu rol</dt><dd className="mt-1 text-base capitalize text-[#223e38]">{currentUser.role === "cuidador_principal" ? "Cuidador principal" : "Familiar colaborador"}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Grupo familiar</dt><dd className="mt-1 text-base text-[#223e38]">{familyLoading ? "Cargando…" : family?.name || "No disponible"}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Cuenta creada</dt><dd className="mt-1 text-base text-[#223e38]">{new Date(currentUser.created_at).toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" })}</dd></div>
          </dl>
          <p className="border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-500">Para proteger tu cuenta, los datos personales se muestran aquí tal como están registrados.</p>
          <AccountControls user={currentUser} onUpdated={onUserUpdated} />
        </div>}

        {initialSection === "plan" && <BillingPanel embedded />}
        {initialSection === "memories" && <UploadedMemories user={currentUser} />}
      </section>
    </div>
  );
}

function UploadedMemories({ user }: { user: User }) {
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listMemories({ include_sensitive: true, limit: 50, offset: 0 }).then((response) => {
      if (active) setItems(response.items.filter((item) => item.created_by === user.id));
    }).catch((reason: unknown) => {
      if (active) setError(memoryErrorMessage(reason));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.id, attempt]);

  return <div className="space-y-5">
    <div><p className="text-sm font-semibold text-[#b94c35]">Tu actividad en Ayni</p><h1 className="mt-1 text-2xl font-semibold text-[#235c50]">Recuerdos subidos</h1><p className="mt-2 text-sm leading-relaxed text-slate-600">Consulta tus anécdotas y canciones, con la fecha en que las compartiste.</p></div>
    {loading && <p role="status" className="py-5 text-sm text-slate-600">Cargando tus recuerdos…</p>}
    {error && <div role="alert" className="py-4 text-sm text-red-700"><p>{error}</p><button onClick={() => { setError(null); setAttempt((value) => value + 1); }} className="mt-2 font-semibold underline">Volver a intentar</button></div>}
    {!loading && !error && items.length === 0 && <p className="py-5 text-sm text-slate-600">Aún no has subido recuerdos. Cuando compartas una anécdota o canción, aparecerá aquí.</p>}
    {!loading && !error && items.length > 0 && <ul className="divide-y divide-slate-200">
      {items.map((memory) => <li key={memory.id} className="py-5 first:pt-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-semibold text-[#223e38]">{memory.title}</h2>
          <time dateTime={memory.created_at} className="text-xs text-slate-500">{new Date(memory.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })}</time>
        </div>
        <p className="mt-1 text-xs font-medium text-[#235c50]">{memory.type === "song" ? "Canción" : "Anécdota"}</p>
        {memory.type === "anecdote" && memory.text && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{memory.text}</p>}
        {memory.type === "song" && memory.url && <a href={memory.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-[#235c50] underline">Abrir canción</a>}
        {(memory.is_positive || memory.is_sensitive) && <p className="mt-2 text-xs text-slate-500">{[memory.is_positive && "Recuerdo positivo", memory.is_sensitive && "Tema delicado"].filter(Boolean).join(" · ")}</p>}
      </li>)}
    </ul>}
  </div>;
}
