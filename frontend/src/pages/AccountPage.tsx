import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, CreditCard, LibraryBig, Music2, ShieldCheck, UserRound, Users } from "lucide-react";
import type { User } from "../api/auth";
import { getElderProfile, getFamilyMembers, getMyFamily } from "../api/families";
import type { ElderProfile, Family, Member } from "../api/families";
import { BillingPanel } from "../components/BillingPanel";
import { listMemories, memoryErrorMessage } from "../api/memories";
import type { Memory } from "../api/memories";
import { AccountControls } from "../components/AccountControls";

export type AccountSection = "overview" | "family" | "personal" | "plan" | "memories";

interface AccountPageProps {
  currentUser: User;
  initialSection: AccountSection;
  onSectionChange: (section: AccountSection) => void;
  onOpenFamilyProfile: () => void;
  onUserUpdated?: (user: User) => void;
}

const sections = [
  { id: "family", label: "Perfil de la familia", detail: "Perfil familiar", icon: Users },
  { id: "personal", label: "Información del perfil", detail: "Mis datos", icon: UserRound },
  { id: "plan", label: "Plan suscrito", detail: "Estado y opciones de suscripción", icon: CreditCard },
  { id: "memories", label: "Recuerdos subidos", detail: "Anécdotas y canciones que compartiste", icon: LibraryBig },
] as const;

export function AccountPage({ currentUser, initialSection, onSectionChange, onOpenFamilyProfile, onUserUpdated }: AccountPageProps) {
  const [family, setFamily] = useState<Family | null>(null);
  const [elderProfile, setElderProfile] = useState<ElderProfile | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [familyError, setFamilyError] = useState(false);
  const [familyAttempt, setFamilyAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.allSettled([getMyFamily(), getElderProfile(), getFamilyMembers()]).then(([familyResult, profileResult, membersResult]) => {
      if (!active) return;
      if (familyResult.status === "fulfilled") setFamily(familyResult.value);
      if (profileResult.status === "fulfilled") setElderProfile(profileResult.value);
      if (membersResult.status === "fulfilled") setMembers(membersResult.value.items);
      setFamilyError([familyResult, profileResult, membersResult].some((result) => result.status === "rejected"));
    }).finally(() => { if (active) setFamilyLoading(false); });
    return () => { active = false; };
  }, [familyAttempt]);

  return (
    <div className="account-page grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="self-start lg:sticky lg:top-24">
        <p className="text-xl font-semibold text-[#2c5f7c]">Configuración y privacidad</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Administra los datos de tu familia, tu plan y los recuerdos que compartiste.</p>
        <nav aria-label="Configuración de la cuenta" className="account-section-nav mt-6 flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          {sections.map(({ id, label, detail, icon: Icon }) => (
            <button key={id} onClick={() => onSectionChange(id)} aria-current={initialSection === id ? "page" : undefined}
              className={`account-section-link account-section-link-${id} flex min-w-52 items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors lg:min-w-0`}>
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-slate-500">{detail}</span></span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="account-section-content min-w-0" data-account-section={initialSection} aria-live="polite">
        {initialSection === "overview" && <>
          <div className="mb-7">
            <p className="text-sm font-semibold text-[#e76f51]">Mi cuenta</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#2c5f7c]">Encuentra lo que necesitas</h1>
          </div>
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {sections.map(({ id, label, detail, icon: Icon }) => (
              <button key={id} onClick={() => onSectionChange(id)} className="flex items-start gap-4 py-4 text-left group">
                <Icon className="mt-1 size-5 shrink-0 text-[#2c5f7c]" aria-hidden="true" />
                <span><span className="block font-semibold text-[#264653] group-hover:text-[#e76f51]">{label}</span><span className="mt-1 block text-sm leading-relaxed text-slate-600">{detail}</span></span>
              </button>
            ))}
          </div>
          <div className="mt-8 flex items-start gap-3 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#2c5f7c]" aria-hidden="true" />
            <p>Tu cuenta reúne información familiar y recuerdos privados para acompañar momentos compartidos.</p>
          </div>
        </>}

        {initialSection === "family" && <FamilyAccountSummary family={family} profile={elderProfile} members={members} loading={familyLoading} error={familyError} onRetry={() => { setFamilyError(false); setFamilyLoading(true); setFamilyAttempt((attempt) => attempt + 1); }} onOpenProfile={onOpenFamilyProfile} />}

        {initialSection === "personal" && <div className="max-w-2xl space-y-6">
          <div><p className="text-sm font-semibold text-[#e76f51]">Información del perfil</p><h1 className="mt-1 text-2xl font-semibold text-[#2c5f7c]">Mis datos</h1><p className="mt-2 text-sm text-slate-600">Información asociada a tu cuenta de Ayni Digital.</p></div>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold text-slate-500">Nombre</dt><dd className="mt-1 text-base text-[#264653]">{currentUser.name}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Correo electrónico</dt><dd className="mt-1 break-all text-base text-[#264653]">{currentUser.email}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Tu rol</dt><dd className="mt-1 text-base capitalize text-[#264653]">{currentUser.role === "cuidador_principal" ? "Cuidador principal" : "Familiar colaborador"}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Grupo familiar</dt><dd className="mt-1 text-base text-[#264653]">{familyLoading ? "Cargando…" : family?.name || "No disponible"}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Cuenta creada</dt><dd className="mt-1 text-base text-[#264653]">{new Date(currentUser.created_at).toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" })}</dd></div>
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

function FamilyAccountSummary({ family, profile, members, loading, error, onRetry, onOpenProfile }: {
  family: Family | null;
  profile: ElderProfile | null;
  members: Member[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpenProfile: () => void;
}) {
  return <div className="account-family-summary space-y-6">
    <header>
      <p className="text-sm font-semibold text-[#e76f51]">EL ESPACIO QUE COMPARTEN</p>
      <h1 className="mt-1 text-2xl font-semibold text-[#2c5f7c]">Perfil de la familia</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">Un vistazo a la persona acompañada y a quienes forman parte de este espacio.</p>
    </header>
    {loading && <p role="status" className="py-5 text-sm text-slate-600">Cargando el perfil familiar…</p>}
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-4 py-4 text-sm text-red-700"><span>No pudimos cargar toda la información familiar.</span><button type="button" onClick={onRetry} className="font-semibold underline">Volver a intentar</button></div>}
    {!loading && <section className="account-family-feature">
      <div className="account-family-person">
        <span>LA PERSONA QUE ACOMPAÑAN</span>
        <h2>{profile?.name || "Perfil por completar"}</h2>
        <p>{profile ? `Nació en la década de ${profile.birth_decade}.` : "Completa su perfil para personalizar las conversaciones."}</p>
        {profile?.interests.length ? <div className="account-family-interests" aria-label="Gustos registrados">{profile.interests.slice(0, 5).map((interest) => <span key={interest}>{interest}</span>)}</div> : null}
      </div>
      <div className="account-family-facts">
        <div><Users size={19} aria-hidden="true"/><span><strong>{members.length}</strong><small>{members.length === 1 ? "persona en el espacio" : "personas en el espacio"}</small></span></div>
        <div><ShieldCheck size={19} aria-hidden="true"/><span><strong>{family?.name || "Espacio familiar"}</strong><small>Recuerdos privados para compartir</small></span></div>
      </div>
      <button type="button" onClick={onOpenProfile} className="account-family-action">Editar perfil familiar <ArrowRight size={17} aria-hidden="true"/></button>
    </section>}
  </div>;
}

function UploadedMemories({ user }: { user: User }) {
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<"all" | "anecdote" | "song">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selectedMonth, setSelectedMonth] = useState("");

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

  const dateFilteredItems = selectedMonth ? items.filter((item) => item.created_at.slice(0, 7) === selectedMonth) : items;
  const counts = { all: dateFilteredItems.length, anecdote: dateFilteredItems.filter((item) => item.type === "anecdote").length, song: dateFilteredItems.filter((item) => item.type === "song").length };
  const orderedItems = [...dateFilteredItems].sort((first, second) => {
    const difference = new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
    return sortOrder === "newest" ? -difference : difference;
  });
  const visibleItems = filter === "all" ? orderedItems : orderedItems.filter((item) => item.type === filter);

  return <div className="account-memories space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-[#e76f51]">LO QUE HAS COMPARTIDO</p><h1 className="mt-1 text-2xl font-semibold text-[#2c5f7c]">Recuerdos subidos</h1><p className="mt-2 text-sm leading-relaxed text-slate-600">Filtra por mes o tipo, y ordénalos como prefieras.</p></div>
      {!loading && !error && <span className="account-memory-total">{items.length} {items.length === 1 ? "recuerdo" : "recuerdos"}</span>}
    </header>
    {loading && <p role="status" className="py-5 text-sm text-slate-600">Cargando tus recuerdos…</p>}
    {error && <div role="alert" className="py-4 text-sm text-red-700"><p>{error}</p><button onClick={() => { setError(null); setAttempt((value) => value + 1); }} className="mt-2 font-semibold underline">Volver a intentar</button></div>}
    {!loading && !error && items.length === 0 && <p className="py-5 text-sm text-slate-600">Aún no has subido recuerdos. Cuando compartas una anécdota o canción, aparecerá aquí.</p>}
    {!loading && !error && items.length > 0 && <>
      <nav className="account-memory-filters" aria-label="Filtrar recuerdos">
        {([ ["all", "Todos"], ["anecdote", "Anécdotas"], ["song", "Canciones"] ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<span>{counts[value]}</span></button>)}
      </nav>
      <div className="account-memory-toolbar">
        <label><CalendarDays size={17} aria-hidden="true"/><span>Mes</span><input type="month" aria-label="Filtrar recuerdos por mes" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}/></label>
        <label><span>Ordenar</span><select aria-label="Ordenar recuerdos por fecha" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest")}><option value="newest">Más recientes primero</option><option value="oldest">Más antiguos primero</option></select></label>
        {selectedMonth && <button type="button" className="account-memory-clear" onClick={() => setSelectedMonth("")}>Quitar fecha</button>}
      </div>
      {visibleItems.length ? <ul className="account-memory-list">
        {visibleItems.map((memory) => <li key={memory.id} className={`account-memory-item account-memory-item-${memory.type}`}>
          <span className="account-memory-icon" aria-hidden="true">{memory.type === "song" ? <Music2 size={19}/> : <BookOpen size={19}/>}</span>
          <div className="account-memory-copy">
            <div className="account-memory-heading"><div><span>{memory.type === "song" ? "CANCIÓN" : "ANÉCDOTA"}</span><h2>{memory.title}</h2></div><time dateTime={memory.created_at}>{new Date(memory.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })}</time></div>
            {memory.type === "anecdote" && memory.text && <p>{memory.text}</p>}
            {memory.type === "song" && memory.url && <a href={memory.url} target="_blank" rel="noopener noreferrer">Escuchar recuerdo <ArrowRight size={15} aria-hidden="true"/></a>}
            {(memory.is_positive || memory.is_sensitive) && <div className="account-memory-tags">{memory.is_positive && <span>Recuerdo bonito</span>}{memory.is_sensitive && <span>Tema delicado</span>}</div>}
          </div>
        </li>)}
      </ul> : <p className="account-memory-empty">Todavía no has compartido recuerdos de este tipo.</p>}
    </>}
  </div>;
}
