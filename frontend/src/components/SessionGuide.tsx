import { AyniCompanion } from "./AyniCompanion";
import { PageIntro } from "./PageIntro";
import { useEffect, useMemo, useState } from "react";
import { Check, Play, RotateCcw, Camera, MessageCircle, ChevronRight, Clock3, Heart, ArrowRight } from "lucide-react";
import type { User } from "../api/auth";
import { listMemories, getMemory, updateMemory } from "../api/memories";
import type { Memory } from "../api/memories";
import { listPhotos } from "../api/photos";
import type { MemoryPhoto } from "../api/photos";
import { getLook, recommendMemory, generateSession, getRecordedReaction, getSession, listSessions, recordReaction } from "../api/sessions";
import type { LookSpec, Recommendation, Reaction, SavedSession, SessionSummary } from "../api/sessions";
import { GuidedConversation } from "./GuidedConversation";
import type { StageScene } from "./CompanionScene";
import { lookFor } from "./companionTheme";
import { getElderProfile } from "../api/families";
import { SessionVoice } from "./sessionVoice";
import type { SessionActivity } from "./sessionSignals";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { ApiError } from "../api/client";
import { getBillingStatus } from "../api/billing";
import { getFamilySessionFeedback, saveSessionFeedback } from "../api/sessionFeedback";
import type { SessionFeeling } from "../api/sessionFeedback";

interface SessionGuideProps {
  currentUser: User;
  onOpenMemories: () => void;
  onOpenPlan?: () => void;
  onOpenDashboard?: () => void;
}

const reactions: Array<[Reaction, string]> = [
  ["receptivo", "Receptivo"], ["emocionado", "Emocionado"],
  ["indiferente", "Indiferente"], ["agitado", "Agitado"],
];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function formatMemoryDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

export function SessionGuide(props: SessionGuideProps) {
  return <PersistedSessionGuide key={`${props.currentUser.id}:${props.currentUser.family_id}`} {...props} />;
}

function PersistedSessionGuide({ currentUser, onOpenMemories, onOpenPlan, onOpenDashboard }: SessionGuideProps) {
  const [memoryChoice, setMemoryChoice] = useState("");
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [guide, setGuide] = useState<SavedSession | null>(null);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [freePlan, setFreePlan] = useState(false);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    listSessions(10, offset).then((page) => {
      if (active) { setHistory(page.items); setTotal(page.total); setHistoryError(""); }
    }).catch((cause: unknown) => { if (active) setHistoryError(cause instanceof Error ? cause.message : "No pudimos cargar el historial."); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [offset, revision]);
  const refreshHistory = (next = offset) => { setHistoryLoading(true); setOffset(next); setRevision((value) => value + 1); };
  useEffect(() => {
    let active = true;
    getBillingStatus().then((status) => { if (active) setFreePlan(status.plan === "free"); }).catch(() => undefined);
    return () => { active = false; };
  }, [currentUser.family_id]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [photoBlob, setPhotoBlob] = useState<Blob>();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoSourceIds, setPhotoSourceIds] = useState<string[]>([]);
  const [look, setLook] = useState<LookSpec | null>(null);
  const [lookVariant, setLookVariant] = useState(0);
  const [lookBusy, setLookBusy] = useState(false);
  const [lookNotice, setLookNotice] = useState("");
  const [anecdoteId, setAnecdoteId] = useState("");
  const [songId, setSongId] = useState("");
  const [withDevices, setWithDevices] = useState(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activity, setActivity] = useState<SessionActivity>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewVoice, setReviewVoice] = useState(false);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [reactionSaved, setReactionSaved] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [saved, setSaved] = useState(false);
  const [feeling, setFeeling] = useState<SessionFeeling | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const songs = useMemo(() => memories.filter((memory) => memory.type === "song" && memory.is_positive && !memory.is_sensitive), [memories]);
  const anecdotes = useMemo(() => memories.filter((memory) =>
    memory.type === "anecdote" && memory.is_positive && !memory.is_sensitive), [memories]);
  const selectedSong = songs.find((memory) => memory.id === songId) ?? songs[0];
  const selectedAnecdote = anecdotes.find((memory) => memory.id === anecdoteId) ?? anecdotes[0];

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const items: Memory[] = [];
      let total = 0;
      do {
        const page = await listMemories({ include_sensitive: true, limit: 50, offset: items.length });
        if (!active) return { items };
        items.push(...page.items); total = page.total;
        if (!page.items.length) break;
      } while (items.length < total);
      return { items };
    })().then(async (response) => {
      if (!active) return;
      setMemories(response.items);
      const eligible = response.items.filter((memory) => memory.is_positive && !memory.is_sensitive);
      const photoPages = await Promise.allSettled(eligible.map((memory) => listPhotos(memory.id)));
      if (!active) return;
      setPhotos(photoPages.flatMap((result) => result.status === "fulfilled" ? result.value : []));
      const firstAnecdote = response.items.find((memory) => memory.type === "anecdote" && memory.is_positive && !memory.is_sensitive);
      if (firstAnecdote) setAnecdoteId(firstAnecdote.id);
      const firstSong = response.items.find((memory) => memory.type === "song" && memory.is_positive && !memory.is_sensitive);
      if (firstSong) setSongId(firstSong.id);
      setLoadError("");
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : "No pudimos cargar los recuerdos.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentUser.family_id]);

  useEffect(() => {
    const currentPhoto = photos[photoIndex % Math.max(photos.length, 1)];
    if (activity !== "photo" || !currentPhoto) { setPhotoBlob(undefined); return; }
    const controller = new AbortController();
    fetch(currentPhoto.url, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("No se pudo cargar la foto."); return response.blob(); })
      .then((blob) => { if (!controller.signal.aborted) setPhotoBlob(blob); })
      .catch(() => { if (!controller.signal.aborted) setPhotoBlob(undefined); });
    return () => controller.abort();
  }, [activity, photoIndex, photos]);

  useEffect(() => {
    if (!started || !photoSourceIds.length) return;
    const refresh = () => {
      // Las URLs firmadas caducan: se renuevan para los mismos recuerdos que aportaron fotos.
      Promise.allSettled(photoSourceIds.map((memoryId) => listPhotos(memoryId)))
        .then((pages) => setPhotos(pages.flatMap((page) => page.status === "fulfilled" ? page.value : [])));
    };
    const timer = window.setInterval(refresh, 4 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [started, photoSourceIds]);

  useEffect(() => {
    if (!started || paused) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [started, paused]);

  const voiceSessionId = guide?.id;
  useEffect(() => {
    if (!reviewOpen || !reviewVoice || !voiceSessionId) return;
    const voice = new SessionVoice();
    void voice.speak(voiceSessionId, "Gracias por compartir este momento conmigo. Si quieren, pueden contar cómo les fue.", () => {}, () => {});
    return () => voice.cancel();
  }, [reviewOpen, reviewVoice, voiceSessionId]);

  const availableActivities: SessionActivity[] = [];
  if (selectedAnecdote) availableActivities.push("anecdote");
  if (photos.length) availableActivities.push("photo");
  if (selectedSong) availableActivities.push("song");

  async function begin(devices: boolean, id?: string) {
    if (busy) return;
    setBusy(true);
    setLoadError("");
    setQuotaBlocked(false);
    try {
      const saved = id ? await getSession(id) : await generateSession(memoryChoice || undefined);
      setGuide(saved);
      refreshHistory(0);
      const ids = [...new Set(saved.steps.filter((item) => item.memory_available && item.memory_id).map((item) => item.memory_id!))];
      const results = await Promise.allSettled(ids.map(getMemory));
      const allowed = results.flatMap((result) => result.status === "fulfilled" && result.value.is_positive && !result.value.is_sensitive && result.value.elder_profile_id === saved.elder_profile_id ? [result.value] : []);
      // Las fotos vienen de todos los recuerdos positivos y no sensibles de la familia, no solo de la guía.
      const family = await listMemories({ include_sensitive: false, limit: 50, offset: 0 }).then((page) => page.items).catch(() => allowed);
      const photoSources = [...new Map([...allowed, ...family]
        .filter((memory) => memory.is_positive && !memory.is_sensitive && memory.elder_profile_id === saved.elder_profile_id)
        .map((memory) => [memory.id, memory])).values()];
      const photoResults = await Promise.allSettled(photoSources.map((memory) => listPhotos(memory.id)));
      const sessionPhotos = photoResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      const previousReaction = await getRecordedReaction(saved.id);
      const previousFeedback = getFamilySessionFeedback(currentUser.family_id).find((item) => item.id === saved.id);
      // Los gustos solo ambientan la sala: si la IA no responde, se usa un look por palabras clave
      // y, si tampoco hay gustos, Ayni sale con su look de siempre. Nunca bloquea la sesión.
      const interests = await getElderProfile().then((profile) => profile.interests).catch(() => []);
      setLookVariant(0);
      setLookNotice("");
      setLook(await getLook(saved.id, 0).catch(() => lookFor(interests, allowed.map((item) => item.title))));
      setMemories(allowed);
      setPhotos(sessionPhotos);
      setPhotoSourceIds(photoSources.map((memory) => memory.id));
      setAnecdoteId(allowed.find((item) => item.type === "anecdote")?.id ?? "");
      setSongId(allowed.find((item) => item.type === "song")?.id ?? "");
      const chosenPhoto = memoryChoice ? sessionPhotos.findIndex((photo) => photo.memory_id === memoryChoice) : -1;
      if (chosenPhoto >= 0) { setPhotoIndex(chosenPhoto); setActivity("photo"); }
      else setActivity(allowed.find((item) => item.id === memoryChoice)?.type ?? allowed[0]?.type ?? (sessionPhotos.length ? "photo" : undefined));
      setWithDevices(devices);
      setPhotoIndex(0);
      setStarted(true);
      setPaused(false);
      setElapsed(0);
      setReviewOpen(false);
      setSaved(false);
      setReaction(previousReaction?.reaction ?? null);
      setReactionSaved(Boolean(previousReaction));
      setFeeling(previousFeedback?.feeling ?? null);
      setReviewNote(previousFeedback?.note ?? "");
      setReviewError("");
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "session_limit_reached") setQuotaBlocked(true);
      else setLoadError(cause instanceof Error ? cause.message : "No pudimos abrir la guía.");
    }
    finally { setBusy(false); }
  }

  function finish(speak: boolean) {
    setStarted(false);
    setPaused(false);
    setReviewVoice(speak);
    setSaved(false);
    setReviewOpen(true);
  }

  function nextActivity(preferred?: SessionActivity): string {
    if (preferred && !availableActivities.includes(preferred)) {
      return "Ese recuerdo todavía no está disponible aquí. ¿Quieres que sigamos con lo que tenemos?";
    }
    const index = activity ? availableActivities.indexOf(activity) : -1;
    const next = preferred ?? (availableActivities.length
      ? availableActivities[(index + 1) % availableActivities.length]
      : undefined);
    setActivity(next);
    if (next === "photo") {
      if (activity === "photo") setPhotoIndex((value) => (value + 1) % photos.length);
      return "Miremos una foto juntos. ¿Qué detalle te llama la atención?";
    }
    if (next === "song") return "Pasemos a la canción. Puedes ponerla cuando quieras. ¿En qué momento solías escucharla?";
    if (next === "anecdote") return "Hablemos de la anécdota. ¿Qué parte te gustaría contar?";
    return "Podemos pensar en otro día bonito. ¿Qué te gustaría compartir?";
  }

  const saveReview = async () => {
    if (!guide || !reaction || !feeling || busy) return;
    setBusy(true);
    setReviewError("");
    try {
      if (!reactionSaved) {
        await recordReaction(guide.id, reaction);
        setReactionSaved(true);
      }
      saveSessionFeedback({
        id: guide.id,
        family_id: currentUser.family_id,
        user_id: currentUser.id,
        user_name: currentUser.name,
        feeling,
        note: reviewNote.trim(),
        duration_seconds: elapsed,
        created_at: new Date().toISOString(),
      });
      setSaved(true);
    } catch (cause) {
      setReviewError(cause instanceof Error ? cause.message : "No pudimos guardar la reacción.");
    } finally { setBusy(false); }
  };

  const scene: StageScene | undefined = activity === "anecdote" && selectedAnecdote ? { kind: "anecdote", title: selectedAnecdote.title, text: selectedAnecdote.text ?? "" } :
    activity === "photo" && photos.length ? { kind: "photo", photos, index: photoIndex, onChange: setPhotoIndex } :
      activity === "song" && selectedSong ? { kind: "song", memory: selectedSong } : undefined;

  return <Card className="session-page border-0 shadow-none">
    {!started && <PageIntro eyebrow="UN MOMENTO PARA CONECTAR" title="Guía de sesión">Conversen a su ritmo con la ayuda de Ayni.</PageIntro>}
    <CardContent className={`session-content space-y-6 px-0 ${!started && !reviewOpen ? "session-preparation" : ""}`}>
      {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}
      {quotaBlocked && <section role="alert" className="session-quota-notice">
        <div><strong>Por ahora no puedes preparar otra guía nueva.</strong><p>El Plan Gratis permite crear una guía cada siete días. Puedes continuar una conversación guardada desde el historial o revisar el Plan Familia. Elegir otro recuerdo cambia la conversación, pero no este límite.</p></div>
        <div className="session-quota-actions"><a href="#saved-guides" onClick={(event) => { event.preventDefault(); document.getElementById("saved-guides")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Ver mis conversaciones</a>{onOpenPlan && <Button type="button" variant="outline" onClick={onOpenPlan}>Ver Plan Familia</Button>}</div>
      </section>}
      {!started && !reviewOpen && <section aria-labelledby="prepare-session" className="session-setup">
        <div className="session-welcome">
          <AyniCompanion className="setup-companion" decorative/>
          <div className="session-welcome-copy">
            <span className="session-kicker">A TU RITMO</span>
            <h2 id="prepare-session" className="text-xl font-bold text-[#264653]">Un momento con Ayni</h2>
            <p className="mt-1 text-base text-slate-700">Elige un recuerdo y empezamos a conversar.</p>
          </div>
        </div>
        {loading ? <p role="status" className="mt-5 text-sm text-slate-600">Cargando recuerdos…</p> : <div className="session-setup-body">
          <div className="session-steps" aria-label="Antes de empezar">
            <div className="session-step"><span>01</span><div><strong>Elige el recuerdo</strong><small>Una historia, canción o selección de Ayni</small></div></div>
            <ChevronRight aria-hidden="true" size={19}/>
            <div className="session-step"><span>02</span><div><strong>Conversa a tu ritmo</strong><small>Puedes hablar, escribir o solo escuchar</small></div></div>
          </div>
          <label className="session-memory-label">¿Con qué recuerdo quieres empezar?
            <select aria-label="Recuerdo para la sesión" className="mt-2 w-full rounded border bg-white p-3 font-normal" value={memoryChoice} onChange={(event) => setMemoryChoice(event.target.value)}>
              <option value="">Dejar que Ayni prepare una selección</option>
              {memories.map((item) => <option key={item.id} value={item.id} disabled={item.is_sensitive || item.deletion_pending}>{item.title}{formatMemoryDate(item.created_at) ? ` · ${formatMemoryDate(item.created_at)}` : ""} · {item.is_sensitive ? "Tema delicado: no disponible" : item.deletion_pending ? "Eliminándose" : !item.is_positive ? "Confirma que es un recuerdo bonito" : item.type === "song" ? "Canción" : "Anécdota"}</option>)}
            </select>
          </label>
          {memories.some((item) => item.id === memoryChoice && !item.is_positive && !item.is_sensitive) && <div className="rounded-xl border bg-amber-50 p-4 space-y-3">
            <p>Este recuerdo todavía no está marcado como bonito. Para usarlo en una sesión, confirma que es un recuerdo positivo para tu familiar.</p>
            <Button disabled={busy} onClick={async () => {
              setBusy(true); setLoadError("");
              try { const updated = await updateMemory(memoryChoice, { is_positive: true }); setMemories((items) => items.map((item) => item.id === updated.id ? updated : item)); }
              catch (cause) { setLoadError(cause instanceof Error ? cause.message : "No pudimos confirmar el recuerdo."); }
              finally { setBusy(false); }
            }}>Confirmar que es un recuerdo bonito</Button>
          </div>}
          <div className="session-choice-actions"><span>Solo se incluyen recuerdos marcados como bonitos.</span><Button variant="outline" disabled={recommending || busy} onClick={async () => {
            setRecommending(true); setLoadError("");
            try { const result = await recommendMemory(); setRecommendation(result); setMemoryChoice(result.memory_id); }
            catch (cause) { setLoadError(cause instanceof Error ? cause.message : "No pudimos recomendar un recuerdo."); }
            finally { setRecommending(false); }
          }}>{recommending ? "Buscando una opción…" : "Recomendar un recuerdo"}</Button></div>
          <p className="session-memory-date-hint">Puedes elegir un recuerdo bonito de hoy o de una fecha anterior.</p>
          {freePlan && history.some((item) => Date.now() - new Date(item.created_at).getTime() < 7 * 24 * 60 * 60 * 1000) && <p className="session-quota-hint"><Clock3 size={15}/> Plan Gratis: una guía nueva cada siete días. Puedes seguir una conversación desde tu historial.</p>}
          {recommendation && <div className="session-recommendation"><strong>{recommendation.source === "ai" ? "Recomendación con IA" : "Sugerencia por historial"}: {recommendation.title}</strong><p>{recommendation.reason}</p><p>Puedes cambiar la selección antes de empezar. Esto no es un diagnóstico. Es un registro de actividades familiares.</p></div>}
          <button type="button" onClick={onOpenMemories} className="session-memory-link">Agregar o revisar mis recuerdos <ChevronRight size={16}/></button>
          <div className="session-start-block">
            <div className="session-start-heading"><span className="session-start-icon"><MessageCircle size={19}/></span><div><strong>¿Cómo quieren conversar?</strong><small>Elige la opción más cómoda para ustedes.</small></div></div>
            <div className="session-start-actions">
              <Button type="button" disabled={busy || memories.some((item) => item.id === memoryChoice && !item.is_positive)} onClick={() => void begin(true)} className="w-auto gap-2"><Play className="size-4" />Empezar con Ayni</Button>
              <Button type="button" variant="outline" disabled={busy || memories.some((item) => item.id === memoryChoice && !item.is_positive)} onClick={() => void begin(false)} className="w-auto"><MessageCircle className="size-4"/>Empezar sin cámara ni micrófono</Button>
            </div>
            <div className="session-device-note"><Camera size={16}/><span>Si eliges Ayni, el navegador pedirá permiso para cámara y micrófono. También puedes iniciar sin ellos.</span></div>
          </div>
          <details className="session-privacy"><summary>Privacidad y uso de cámara</summary><p>El dictado se procesa en este dispositivo, salvo que actives «Mejor precisión con Groq» para compartir el audio. Los mensajes y detalles compartidos se guardan en el historial familiar. La cámara solo comparte una captura cuando pides explícitamente mirar algo; no se guardan fotos ni video de la cámara. Ayni acompaña actividades familiares y no es un servicio de salud.</p></details>
        </div>}
      </section>}
      {!started && !reviewOpen && <section className="session-history space-y-3" aria-labelledby="saved-guides">
        <div className="session-history-heading"><span className="session-kicker">TU HISTORIAL</span><h2 id="saved-guides" className="text-lg font-semibold">Mis conversaciones</h2><p>Retoma un momento cuando quieras.</p></div>
        {historyLoading ? <p role="status">Cargando historial…</p> : historyError ? <div role="alert"><p>{historyError}</p><Button variant="outline" onClick={() => refreshHistory()}>Reintentar historial</Button></div> : <>
          {total === 0 && <p className="session-history-empty">Tu primera conversación aparecerá aquí después de iniciar una guía.</p>}
          <ul className="session-history-list">{history.map((item) => <li key={item.id}>
            <span className="session-history-date"><Clock3 size={17}/>{new Date(item.created_at).toLocaleString("es-PE")}<small>{item.duration_minutes} min</small></span>
            <Button variant="outline" disabled={busy} onClick={() => void begin(false, item.id)}>Continuar conversación</Button>
          </li>)}</ul>
          {total > 10 && <nav aria-label="Páginas del historial" className="flex flex-wrap gap-3"><Button variant="outline" disabled={offset === 0 || busy} onClick={() => refreshHistory(Math.max(0, offset - 10))}>Página anterior</Button><Button variant="outline" disabled={offset + 10 >= total || busy} onClick={() => refreshHistory(offset + 10)}>Página siguiente</Button></nav>}
        </>}
      </section>}
      {started && guide && <GuidedConversation
        key={guide.id}
        onBack={() => { setStarted(false); refreshHistory(); }}
        sessionId={guide.id}
        activeMemoryId={activity === "song" ? selectedSong?.id : activity === "anecdote" ? selectedAnecdote?.id :
          activity === "photo" ? photos[photoIndex % Math.max(photos.length, 1)]?.memory_id : undefined}
        memoryOptions={memories.map((item) => ({ id: item.id, title: item.title }))}
        onSelectMemory={(id) => {
          const item = memories.find((value) => value.id === id);
          if (!item) return;
          if (item.type === "song") setSongId(item.id); else setAnecdoteId(item.id);
          setActivity(item.type);
        }}
        photo={activity === "photo" ? photoBlob : undefined}
        withDevices={withDevices}
        elapsed={formatTime(elapsed)}
        paused={paused}
        scene={scene}
        activities={availableActivities}
        songMemory={selectedSong}
        look={look}
        lookBusy={lookBusy}
        lookNotice={lookNotice}
        onNewLook={async () => {
          if (lookBusy) return;
          const variant = lookVariant + 1;
          setLookBusy(true);
          setLookNotice("");
          try { setLook(await getLook(guide.id, variant)); setLookVariant(variant); }
          catch (cause) { setLookNotice(cause instanceof Error ? cause.message : "No pudimos preparar otro look."); }
          finally { setLookBusy(false); }
        }}
        onPause={() => setPaused(true)}
        onResume={() => setPaused(false)}
        onNextActivity={nextActivity}
        onFinish={finish}
      />}


      {reviewOpen && !saved && <section className="session-review-flow" aria-labelledby="session-review-title">
        <div className="session-review-welcome">
          <AyniCompanion className="session-review-owl" decorative mood="joyful" animation="celebrate" />
          <div><p className="session-review-kicker">Con cariño, Ayni</p><h2 id="session-review-title">¡Qué alegría que compartieran este rato!</h2><p>¿Cómo se sintieron al terminar? Elige lo que mejor refleje el momento.</p></div>
        </div>
        <fieldset className="session-review-group" disabled={busy || reactionSaved}>
          <legend>¿Cómo reaccionó la persona que acompañaron?</legend>
          <div className="session-review-choices">{reactions.map(([value, label]) => <Choice key={value} tone={value} selected={reaction === value} onClick={() => setReaction(value)}>{label}</Choice>)}</div>
          {reactionSaved && <p className="mt-2 text-sm text-slate-600">La reacción de esta guía ya está guardada; puedes completar tu reseña.</p>}
        </fieldset>
        <fieldset className="session-review-group" disabled={busy}>
          <legend>¿Cómo te sentiste tú al acompañarle?</legend>
          <div className="session-review-choices">{([
            ["content", "A gusto"], ["calm", "Tranquilo/a"], ["tired", "Cansado/a"], ["no_answer", "Prefiero no decir"],
          ] as const).map(([value, label]) => <Choice key={value} tone={value} selected={feeling === value} onClick={() => setFeeling(value)}>{label}</Choice>)}</div>
        </fieldset>
        <label className="session-review-note">¿Quieren dejar una nota sobre este momento? <span>Opcional</span>
          <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value.slice(0, 400))} maxLength={400} rows={3} placeholder="Por ejemplo: nos gustó recordar ese paseo juntos." disabled={busy} />
          <small>{reviewNote.length}/400</small>
        </label>
        {reviewError && <p role="alert" className="text-sm text-red-700">{reviewError}</p>}
        <div className="session-review-actions"><Button disabled={!reaction || !feeling || busy} onClick={() => void saveReview()} variant="secondary" className="w-auto"><Check className="mr-2 size-4" />{busy ? "Guardando…" : "Guardar y terminar"}</Button><Button variant="outline" disabled={busy} onClick={() => { setReviewOpen(false); setStarted(false); }} className="w-auto">Omitir por ahora</Button></div>
      </section>}

      {reviewOpen && saved && <section className="session-review-success" role="status">
        <div className="session-review-success-owl"><AyniCompanion className="session-review-owl" decorative mood="joyful" animation="celebrate" /></div>
        <p className="session-review-kicker">Hasta el próximo recuerdo</p>
        <h2>¡Gracias por compartir este momento!</h2>
        <p>El cierre quedó guardado. Gracias por compartir cómo vivieron la sesión.</p>
        <div className="session-review-summary"><span><Clock3 size={17}/>{formatTime(elapsed)} compartidos</span><span><Heart size={17}/>{feeling === "content" ? "A gusto" : feeling === "calm" ? "Tranquilo/a" : feeling === "tired" ? "Cansado/a" : "Prefirió no decir"}</span></div>
        {reviewNote.trim() && <blockquote>“{reviewNote.trim()}”</blockquote>}
        <div className="session-review-actions"><Button variant="outline" onClick={() => { setReviewOpen(false); setStarted(false); setElapsed(0); refreshHistory(); }} className="w-auto"><RotateCcw className="mr-2 size-4" />Volver al historial</Button>{onOpenDashboard && <Button onClick={onOpenDashboard} className="w-auto">Ver avances familiares <ArrowRight className="ml-2 size-4" /></Button>}</div>
      </section>}
    </CardContent>
  </Card>;
}

function Choice({ children, selected, onClick, tone = "receptivo" }: { children: string; selected: boolean; onClick: () => void; tone?: string }) {
  return <button type="button" data-tone={tone} aria-pressed={selected} onClick={onClick} className={`rounded-full border px-3 py-2 text-sm transition-colors ${selected ? "border-[#2c5f7c] bg-[#2c5f7c] text-white" : "border-slate-300 text-slate-700 hover:border-[#2c5f7c]"}`}>{children}</button>;
}
