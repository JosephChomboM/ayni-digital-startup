import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Users } from "lucide-react";
import { getElderProfile, getMyFamily } from "../api/families";
import type { ElderProfile, Family } from "../api/families";
import { listMemories } from "../api/memories";
import type { User } from "../api/auth";
import { getLocalFamilyPhotos } from "../api/localMedia";
import { ApiError } from "../api/client";
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
  const [family, setFamily] = useState<Family | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const familyId = currentUser?.family_id;

  useEffect(() => {
    let active = true;
    Promise.allSettled([getMyFamily(), getElderProfile(), listMemories({ limit: 1 }), familyId ? getLocalFamilyPhotos(familyId) : Promise.resolve([])]).then(([familyResult, profileResult, memoriesResult, photosResult]) => {
      if (!active) return;
      setFamily(familyResult.status === "fulfilled" ? familyResult.value : null);
      setProfile(profileResult.status === "fulfilled" ? profileResult.value : null);
      setCount(memoriesResult.status === "fulfilled" ? memoriesResult.value.total + (photosResult.status === "fulfilled" ? photosResult.value.length : 0) : null);
      const profileMissing = profileResult.status === "rejected" && profileResult.reason instanceof ApiError && profileResult.reason.code === "elder_profile_not_found";
      setError(photosResult.status === "rejected" || familyResult.status === "rejected" || (profileResult.status === "rejected" && !profileMissing) || (memoriesResult.status === "rejected" && !profileMissing));
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
    <div className="mx-auto max-w-5xl space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-[#2c5f7c] sm:text-4xl">{family?.name || "Tu espacio familiar"}</h1>
        <p className="max-w-2xl text-base leading-relaxed text-[#264653]">Un lugar para reunir historias y preparar un momento con {profile?.name || "tu familiar"}. Una conversación, a su ritmo.</p>
      </header>

      {error && <div role="alert" className="rounded-xl border border-[#2c5f7c]/20 bg-white p-5 space-y-3">
        <p>No pudimos consultar toda la información de tu familia. Algunos datos no están disponibles.</p>
        <Button variant="outline" onClick={() => { setLoading(true); setError(false); setAttempt(value => value + 1); }}>Volver a intentar</Button>
      </div>}

      <section aria-labelledby="next-step-title" className="grid overflow-hidden rounded-2xl bg-white md:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col items-start justify-center gap-5 p-6 sm:p-8">
          <h2 id="next-step-title" className="text-2xl font-bold text-[#2c5f7c]">{error ? "Tus recuerdos siguen siendo el punto de partida" : needsProfile ? "Empecemos por conocer a tu familiar" : needsMemory ? "Toda historia empieza con un recuerdo" : "Un momento para estar cerca"}</h2>
          <p className="max-w-lg text-base leading-relaxed">{error ? "Puedes abrir el perfil o los recuerdos para consultar su estado y volver a intentarlo desde allí." : needsProfile ? (canManageFamily ? "Añade su nombre y lo que le gusta. Así podrás organizar los recuerdos de la familia." : "La persona cuidadora principal puede completar el perfil. Mientras tanto, puedes consultar el espacio familiar.") : needsMemory ? "Una anécdota o una canción puede abrir una conversación. Comparte algo que les guste recordar." : "La guía usa sus recuerdos y propone preguntas sencillas. Puedes detenerte o cambiar de tema en cualquier momento."}</p>
          <Button onClick={error ? onViewProfile : nextAction} size="lg">{error ? "Revisar perfil familiar" : nextLabel}<ArrowRight aria-hidden="true" className="ml-2 size-4" /></Button>
          {!needsProfile && !needsMemory && !error && <p className="text-sm text-gray-600">Las fotos y reseñas se guardan solo en este navegador; no se sincronizan con otros dispositivos.</p>}
        </div>
        <img src="/images/recuerdos.jpg" alt="Un abuelo y dos nietos comparten un álbum familiar" className="h-64 w-full object-cover md:h-full md:min-h-80" />
      </section>

      <section aria-labelledby="family-content-title" className="space-y-2">
        <h2 id="family-content-title" className="text-xl font-bold text-[#2c5f7c]">El álbum de tu familia</h2>
        <div className="divide-y divide-[#2c5f7c]/15">
          <button onClick={onViewMemories} className="flex min-h-24 w-full items-center gap-4 py-5 text-left">
            <BookOpen aria-hidden="true" className="size-6 shrink-0 text-[#2c5f7c]" />
            <span className="min-w-0 flex-1"><span className="block font-semibold">Recuerdos compartidos</span><span className="mt-1 block text-sm text-gray-600">{count === null ? "Abre el álbum para consultar tus anécdotas y canciones." : `${count} ${count === 1 ? "recuerdo disponible" : "recuerdos disponibles"} para conversar.`}</span></span>
            <ArrowRight aria-hidden="true" className="size-5 shrink-0" />
          </button>
          <button onClick={onViewProfile} className="flex min-h-24 w-full items-center gap-4 py-5 text-left">
            <Users aria-hidden="true" className="size-6 shrink-0 text-[#2c5f7c]" />
            <span className="min-w-0 flex-1"><span className="block font-semibold">Perfil y familia</span><span className="mt-1 block text-sm text-gray-600">Consulta el perfil. La persona cuidadora puede editarlo e invitar a familiares.</span></span>
            <ArrowRight aria-hidden="true" className="size-5 shrink-0" />
          </button>
        </div>
      </section>
      <p className="max-w-2xl border-t border-[#2c5f7c]/15 pt-5 text-sm leading-relaxed text-[#264653]">Ayni acompaña conversaciones familiares. No es un servicio de salud ni realiza diagnósticos. El bienestar de la persona es lo primero: pueden pausar o terminar cuando quieran.</p>
    </div>
  );
}
