import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
  const [promptIndex, setPromptIndex] = useState(0);
  const prompts = [
    { question: "¿Qué lugar recuerdas con cariño?", hint: "Puede ser una casa, una plaza o un viaje que disfrutaron juntos.", tone: "peach" },
    { question: "¿Qué canción te trae un recuerdo bonito?", hint: "Si quieren, pueden buscarla y escucharla en familia.", tone: "blue" },
    { question: "¿Qué solían preparar en una ocasión especial?", hint: "Cuéntense los detalles que todavía recuerdan de ese momento.", tone: "sage" },
    { question: "¿Quién hacía reír a todos en las reuniones?", hint: "Una anécdota pequeña también puede abrir una gran conversación.", tone: "butter" },
  ];

  useEffect(() => {
    const timer = window.setInterval(() => setPromptIndex(index => (index + 1) % prompts.length), 6000);
    return () => window.clearInterval(timer);
  }, [prompts.length]);

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
  const elderInitial = profile?.name.trim().charAt(0).toLocaleUpperCase() || "F";
  const caregiverInitial = currentUser?.name.trim().charAt(0).toLocaleUpperCase() || "T";

  return (
    <div className="home-page space-y-8">
      <header className="page-intro home-page-intro"><div><p className="eyebrow">QUÉ BUENO ESTAR AQUÍ</p>
        <h1 className="text-3xl font-bold tracking-tight text-[#2c5f7c] sm:text-4xl">Tu espacio familiar</h1>
        <p className="max-w-2xl text-base leading-relaxed text-[#264653]">Un lugar para reunir historias y preparar un momento con {profile?.name || "tu familiar"}. Una conversación, a su ritmo.</p>
      </div></header>

      {error && <div role="alert" className="rounded-xl border border-[#2c5f7c]/20 bg-white p-5 space-y-3">
        <p>No pudimos consultar toda la información de tu familia. Algunos datos no están disponibles.</p>
        <Button variant="outline" onClick={() => { setLoading(true); setError(false); setAttempt(value => value + 1); }}>Volver a intentar</Button>
      </div>}

      <section aria-labelledby="next-step-title" className="home-session-card">
        <div className="flex flex-col items-start justify-center gap-5 p-6 sm:p-8">
          <p className="home-card-eyebrow">UN MOMENTO EN FAMILIA</p>
          <h2 id="next-step-title" className="text-2xl font-bold text-[#2c5f7c]">{error ? "Tus recuerdos siguen siendo el punto de partida" : needsProfile ? "Empecemos por conocer a tu familiar" : needsMemory ? "Toda historia empieza con un recuerdo" : "Un momento para estar cerca"}</h2>
          <p className="max-w-lg text-base leading-relaxed">{error ? "Puedes abrir el perfil o los recuerdos para consultar su estado y volver a intentarlo desde allí." : needsProfile ? (canManageFamily ? "Añade su nombre y lo que le gusta. Así podrás organizar los recuerdos de la familia." : "La persona cuidadora principal puede completar el perfil. Mientras tanto, puedes consultar el espacio familiar.") : needsMemory ? "Una anécdota o una canción puede abrir una conversación. Comparte algo que les guste recordar." : "La guía usa sus recuerdos y propone preguntas sencillas. Puedes detenerte o cambiar de tema en cualquier momento."}</p>
          <Button onClick={error ? onViewProfile : nextAction} size="lg">{error ? "Revisar perfil familiar" : nextLabel}<ArrowRight aria-hidden="true" className="ml-2 size-4" /></Button>
          {!needsProfile && !needsMemory && !error && <p className="home-gentle-note">Pueden conversar, cambiar de tema o hacer una pausa cuando lo necesiten.</p>}
        </div>
        <div className="home-companion-stage"><span className="orbit-decoration" aria-hidden="true"/><AyniCompanion decorative/><span className="companion-tag">Un ratito para compartir</span></div>
      </section>

      <section aria-labelledby="family-content-title" className="space-y-2">
        <div className="home-album-heading"><p>LO QUE HAN REUNIDO</p><h2 id="family-content-title">El álbum de tu familia</h2><span>{count ?? 0} {count === 1 ? "recuerdo" : "recuerdos"}</span></div>
        <div className="home-shortcuts">
          <button onClick={onViewMemories} className="home-shortcut home-shortcut-memories">
            <span className="home-memory-art" aria-hidden="true"><i/><i/><i/><b>{count ?? 0}</b></span>
            <span className="home-shortcut-copy"><span className="home-shortcut-title">Recuerdos compartidos</span><span className="home-shortcut-detail">{count === null ? "Abre el álbum para consultar anécdotas, canciones y fotos." : `${count} ${count === 1 ? "recuerdo disponible" : "recuerdos disponibles"} para conversar.`}</span></span>
            <ArrowRight aria-hidden="true" className="home-shortcut-arrow" />
          </button>
          <button onClick={onViewProfile} className="home-shortcut home-shortcut-family">
            <span className="home-family-art" aria-hidden="true"><i>{elderInitial}</i><i>{caregiverInitial}</i><b/></span>
            <span className="home-shortcut-copy"><span className="home-shortcut-title">Perfil y familia</span><span className="home-shortcut-detail">Consulta el perfil. La persona cuidadora puede editarlo e invitar a familiares.</span></span>
            <ArrowRight aria-hidden="true" className="home-shortcut-arrow" />
          </button>
        </div>
      </section>

      <section aria-labelledby="home-memory-example" className="home-example space-y-6 pt-2">
        <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
          <h2 id="home-memory-example" className="max-w-xl text-2xl font-bold leading-tight text-[#2c5f7c]">Un recuerdo puede abrir una conversación</h2>
          <p className="max-w-xl text-sm leading-relaxed text-slate-600 sm:justify-self-end">Mira un ejemplo de cómo una anécdota o una canción pueden dar inicio a un momento en familia.</p>
        </div>
        <div className="home-memory-demo">
          <div className="home-demo-heading">
            <p className="font-semibold text-[#264653]">Un ejemplo para conversar</p>
            <span>Contenido ilustrativo</span>
          </div>
          <div className="home-demo-body">
            <div role="tablist" aria-label="Tipo de recuerdo" className="home-demo-tabs">
              <button type="button" role="tab" data-example="anecdote" aria-selected={exampleTab === "anecdote"} onClick={() => setExampleTab("anecdote")}>Anécdota</button>
              <button type="button" role="tab" data-example="song" aria-selected={exampleTab === "song"} onClick={() => setExampleTab("song")}>Canción</button>
            </div>
            <div role="tabpanel" aria-live="polite" data-example={exampleTab} className="home-demo-copy">
              <h3 className="text-xl font-bold text-[#264653]">{exampleTab === "song" ? "La canción de la sobremesa" : "Los domingos en casa"}</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Después del almuerzo, mi mamá ponía su canción favorita. Decía que le recordaba sus paseos de juventud y siempre la cantaba bajito.</p>
              <p className="mt-5 font-semibold text-[#9a4f3c]">{exampleTab === "song" ? "¿Qué canción les gustaría volver a escuchar juntos?" : "¿Qué recuerdo de los domingos les gustaría compartir?"}</p>
            </div>
          </div>
          <p className="home-demo-footnote">Este ejemplo no contiene datos de una familia real. Tus recuerdos se gestionan desde <button type="button" onClick={onViewMemories}>Recuerdos</button>.</p>
        </div>
        <div className="grid gap-6 pt-3 lg:grid-cols-2 lg:items-center lg:gap-12">
          <div className="space-y-3">
            <h3 className="text-2xl font-bold leading-tight text-[#2c5f7c]">Acompañar, a su propio ritmo</h3>
            <p className="text-sm leading-7 text-slate-600">La guía ofrece una pregunta a la vez. Pueden conversar, cambiar de tema o hacer una pausa cuando lo necesiten.</p>
            <button type="button" onClick={onStartSession} className="inline-flex min-h-10 items-center font-semibold text-[#2c5f7c] hover:text-[#e76f51]">Abrir guía de sesión <ArrowRight aria-hidden="true" className="ml-2 size-4" /></button>
          </div>
          <aside className={`home-prompt-card home-prompt-${prompts[promptIndex].tone}`} aria-label="Preguntas para empezar" aria-roledescription="carrusel">
            <div className="home-prompt-topline"><span>Una pregunta para empezar</span><span>{String(promptIndex + 1).padStart(2, "0")} / {String(prompts.length).padStart(2, "0")}</span></div>
            <div className="home-prompt-content" key={promptIndex} aria-live="polite">
              <p className="home-prompt-question">{prompts[promptIndex].question}</p>
              <p className="home-prompt-hint">{prompts[promptIndex].hint}</p>
            </div>
            <div className="home-prompt-controls">
              <div className="home-prompt-dots" aria-label="Elegir pregunta">
                {prompts.map((prompt, index) => <button key={prompt.question} type="button" aria-label={`Mostrar pregunta ${index + 1}`} aria-current={promptIndex === index ? "true" : undefined} onClick={() => setPromptIndex(index)} />)}
              </div>
              <div className="home-prompt-arrows">
                <button type="button" aria-label="Pregunta anterior" onClick={() => setPromptIndex(index => (index - 1 + prompts.length) % prompts.length)}><ArrowLeft aria-hidden="true" size={17}/></button>
                <button type="button" aria-label="Pregunta siguiente" onClick={() => setPromptIndex(index => (index + 1) % prompts.length)}><ArrowRight aria-hidden="true" size={17}/></button>
              </div>
            </div>
          </aside>
        </div>
      </section>
      <p className="max-w-2xl border-t border-[#2c5f7c]/15 pt-5 text-sm leading-relaxed text-[#264653]">Ayni acompaña conversaciones familiares. No es un servicio de salud ni realiza diagnósticos. El bienestar de la persona es lo primero: pueden pausar o terminar cuando quieran.</p>
    </div>
  );
}
