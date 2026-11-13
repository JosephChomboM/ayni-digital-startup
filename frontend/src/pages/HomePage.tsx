import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Users } from "lucide-react";
import { getElderProfile } from "../api/families";
import type { ElderProfile } from "../api/families";
import { listMemories } from "../api/memories";
import type { User } from "../api/auth";
import { getLocalFamilyPhotos } from "../api/localMedia";
import { ApiError } from "../api/client";
import { AyniCompanion } from "../components/AyniCompanion";
import { Button } from "../components/ui/button";

interface HomePageProps {
  onStartSession: () => void;
  onViewMemories: () => void;
  onViewProfile: () => void;
  canManageFamily: boolean;
  currentUser?: User;
}

export function HomePage({ onStartSession, onViewMemories, onViewProfile, canManageFamily, currentUser }: HomePageProps) {
  const [profile, setProfile] = useState<ElderProfile | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [exampleTab, setExampleTab] = useState<"anecdote" | "song">("song");

  const familyId = currentUser?.family_id;

  useEffect(() => {
    let active = true;
    Promise.allSettled([getElderProfile(), listMemories({ limit: 1 }), familyId ? getLocalFamilyPhotos(familyId) : Promise.resolve([])]).then(([profileResult, memoriesResult, photosResult]) => {
      if (!active) return;
      setProfile(profileResult.status === "fulfilled" ? profileResult.value : null);
      setCount(memoriesResult.status === "fulfilled" ? memoriesResult.value.total + (photosResult.status === "fulfilled" ? photosResult.value.length : 0) : null);
      const profileMissing = profileResult.status === "rejected" && profileResult.reason instanceof ApiError && profileResult.reason.code === "elder_profile_not_found";
      setError(photosResult.status === "rejected" || (profileResult.status === "rejected" && !profileMissing) || (memoriesResult.status === "rejected" && !profileMissing));
      setLoading(false);
    });
    return () => { active = false; };
  }, [attempt, familyId]);

  if (loading) return <p role="status" className="py-12 text-base">Preparando tu espacio familiar…</p>;

  const needsProfile = !profile;
  const needsMemory = count === 0;
  const nextAction = needsProfile ? onViewProfile : needsMemory ? onViewMemories : onStartSession;
  const nextLabel = needsProfile ? (canManageFamily ? "Completar perfil familiar" : "Ver perfil familiar") : needsMemory ? "Compartir el primer recuerdo" : "Preparar una sesión";

  return (
    <div className="home-page space-y-8">
      <header className="page-intro"><div><p className="eyebrow">QUÉ BUENO ESTAR AQUÍ</p>
        <h1 className="text-3xl font-bold tracking-tight text-[#235c50] sm:text-4xl">Tu espacio familiar</h1>
        <p className="max-w-2xl text-base leading-relaxed text-[#223e38]">Un lugar para reunir historias y preparar un momento con {profile?.name || "tu familiar"}. Una conversación, a su ritmo.</p>
      </div><span className="home-flower" aria-hidden="true">✳</span></header>

      {error && <div role="alert" className="rounded-xl border border-[#235c50]/20 bg-white p-5 space-y-3">
        <p>No pudimos consultar toda la información de tu familia. Algunos datos no están disponibles.</p>
        <Button variant="outline" onClick={() => { setLoading(true); setError(false); setAttempt(value => value + 1); }}>Volver a intentar</Button>
      </div>}

      <section aria-labelledby="next-step-title" className="home-session-card">
        <div className="flex flex-col items-start justify-center gap-5 p-6 sm:p-8">
          <h2 id="next-step-title" className="text-2xl font-bold text-[#235c50]">{error ? "Tus recuerdos siguen siendo el punto de partida" : needsProfile ? "Empecemos por conocer a tu familiar" : needsMemory ? "Toda historia empieza con un recuerdo" : "Un momento para estar cerca"}</h2>
          <p className="max-w-lg text-base leading-relaxed">{error ? "Puedes abrir el perfil o los recuerdos para consultar su estado y volver a intentarlo desde allí." : needsProfile ? (canManageFamily ? "Añade su nombre y lo que le gusta. Así podrás organizar los recuerdos de la familia." : "La persona cuidadora principal puede completar el perfil. Mientras tanto, puedes consultar el espacio familiar.") : needsMemory ? "Una anécdota o una canción puede abrir una conversación. Comparte algo que les guste recordar." : "La guía usa sus recuerdos y propone preguntas sencillas. Puedes detenerte o cambiar de tema en cualquier momento."}</p>
          <Button onClick={error ? onViewProfile : nextAction} size="lg">{error ? "Revisar perfil familiar" : nextLabel}<ArrowRight aria-hidden="true" className="ml-2 size-4" /></Button>
          {!needsProfile && !needsMemory && !error && <p className="text-sm text-gray-600">Las fotos y reseñas se guardan solo en este navegador; no se sincronizan con otros dispositivos.</p>}
        </div>
        <div className="home-companion-stage"><span className="orbit-decoration" aria-hidden="true"/><AyniCompanion decorative/><span className="companion-tag">Un ratito para compartir</span></div>
      </section>

      <section aria-labelledby="family-content-title" className="space-y-2">
        <h2 id="family-content-title" className="text-xl font-bold text-[#235c50]">El álbum de tu familia</h2>
        <div className="home-shortcuts">
          <button onClick={onViewMemories} className="home-shortcut">
            <BookOpen aria-hidden="true" className="size-6 shrink-0 text-[#235c50]" />
            <span className="min-w-0 flex-1"><span className="block font-semibold">Recuerdos compartidos</span><span className="mt-1 block text-sm text-gray-600">{count === null ? "Abre el álbum para consultar tus anécdotas y canciones." : `${count} ${count === 1 ? "recuerdo disponible" : "recuerdos disponibles"} para conversar.`}</span></span>
            <ArrowRight aria-hidden="true" className="size-5 shrink-0" />
          </button>
          <button onClick={onViewProfile} className="home-shortcut">
            <Users aria-hidden="true" className="size-6 shrink-0 text-[#235c50]" />
            <span className="min-w-0 flex-1"><span className="block font-semibold">Perfil y familia</span><span className="mt-1 block text-sm text-gray-600">Consulta el perfil. La persona cuidadora puede editarlo e invitar a familiares.</span></span>
            <ArrowRight aria-hidden="true" className="size-5 shrink-0" />
          </button>
        </div>
      </section>

      <section aria-labelledby="home-memory-example" className="home-example space-y-6 pt-2">
        <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
          <h2 id="home-memory-example" className="max-w-xl text-2xl font-bold leading-tight text-[#235c50]">Un recuerdo puede abrir una conversación</h2>
          <p className="max-w-xl text-sm leading-relaxed text-slate-600 sm:justify-self-end">Mira un ejemplo de cómo una anécdota o una canción pueden dar inicio a un momento en familia.</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#235c50]/15 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#eef4f6] px-5 py-4 sm:px-6">
            <p className="font-semibold text-[#223e38]">Un ejemplo para conversar</p>
            <span className="text-xs text-slate-500">Contenido ilustrativo</span>
          </div>
          <div className="grid min-h-56 sm:grid-cols-[190px_1fr]">
            <div role="tablist" aria-label="Tipo de recuerdo" className="flex gap-2 border-b border-slate-200 p-3 sm:flex-col sm:border-b-0 sm:border-r sm:p-4">
              <button type="button" role="tab" aria-selected={exampleTab === "anecdote"} onClick={() => setExampleTab("anecdote")} className={`min-h-11 flex-1 rounded-xl px-3 text-left text-sm font-medium transition-colors sm:flex-none ${exampleTab === "anecdote" ? "bg-[#235c50] text-white" : "text-[#223e38] hover:bg-[#eef4f6]"}`}>Anécdota</button>
              <button type="button" role="tab" aria-selected={exampleTab === "song"} onClick={() => setExampleTab("song")} className={`min-h-11 flex-1 rounded-xl px-3 text-left text-sm font-medium transition-colors sm:flex-none ${exampleTab === "song" ? "bg-[#235c50] text-white" : "text-[#223e38] hover:bg-[#eef4f6]"}`}>Canción</button>
            </div>
            <div role="tabpanel" aria-live="polite" className="flex flex-col justify-center px-5 py-7 sm:px-8 sm:py-9">
              <h3 className="text-xl font-bold text-[#223e38]">{exampleTab === "song" ? "La canción de la sobremesa" : "Los domingos en casa"}</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Después del almuerzo, mi mamá ponía su canción favorita. Decía que le recordaba sus paseos de juventud y siempre la cantaba bajito.</p>
              <p className="mt-5 font-semibold text-[#9a4f3c]">{exampleTab === "song" ? "¿Qué canción les gustaría volver a escuchar juntos?" : "¿Qué recuerdo de los domingos les gustaría compartir?"}</p>
            </div>
          </div>
          <p className="border-t border-slate-200 px-5 py-4 text-xs leading-relaxed text-slate-500 sm:px-6">Este ejemplo no contiene datos de una familia real. Tus recuerdos se gestionan desde <button type="button" onClick={onViewMemories} className="font-semibold text-[#235c50] underline underline-offset-2">Recuerdos</button>.</p>
        </div>
        <div className="grid gap-6 pt-3 lg:grid-cols-2 lg:items-center lg:gap-12">
          <div className="space-y-3">
            <h3 className="text-2xl font-bold leading-tight text-[#235c50]">Acompañar, a su propio ritmo</h3>
            <p className="text-sm leading-7 text-slate-600">La guía ofrece una pregunta a la vez. Pueden conversar, cambiar de tema o hacer una pausa cuando lo necesiten.</p>
            <button type="button" onClick={onStartSession} className="inline-flex min-h-10 items-center font-semibold text-[#235c50] hover:text-[#b94c35]">Abrir guía de sesión <ArrowRight aria-hidden="true" className="ml-2 size-4" /></button>
          </div>
          <aside className="rounded-2xl bg-[#f1f8ef] p-6 sm:p-8">
            <p className="text-sm font-semibold text-[#223e38]">Una pregunta para empezar</p>
            <p className="mt-3 text-2xl font-medium leading-snug text-[#235c50]">¿Qué lugar recuerdas con cariño?</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">Escuchen lo que la persona quiera contar. No hace falta recordar fechas ni responder todo.</p>
          </aside>
        </div>
      </section>
      <p className="max-w-2xl border-t border-[#235c50]/15 pt-5 text-sm leading-relaxed text-[#223e38]">Ayni acompaña conversaciones familiares. No es un servicio de salud ni realiza diagnósticos. El bienestar de la persona es lo primero: pueden pausar o terminar cuando quieran.</p>
    </div>
  );
}
