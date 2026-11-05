import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Pause, Play } from "lucide-react";
import { Button } from "./ui/button";

const steps = [
  { title: "Elijan un recuerdo", text: "Busquen una anécdota o una canción que les resulte agradable. Pregunta si le apetece compartir ese momento." },
  { title: "Abre la conversación", text: "Puedes preguntar: ¿qué te viene a la mente con este recuerdo? Deja espacio para escuchar, sin buscar una respuesta correcta." },
  { title: "Sigan su ritmo", text: "Si surge otra historia, escúchala. Si el recuerdo incomoda, cambien de tema o terminen. No hace falta completar todos los pasos." },
  { title: "Cierren con calma", text: "Pregunta cómo se sintió y agradece el tiempo compartido. Una conversación breve también puede ser un buen momento." },
];

export function SessionGuide({ onViewMemories }: { onViewMemories?: () => void }) {
  const [step, setStep] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const finish = () => { setFinished(true); setStep(null); setPaused(false); };
  return (
    <section className="space-y-6 rounded-2xl bg-white p-6 sm:p-8" aria-labelledby="guide-title">
      <div className="space-y-3">
        <BookOpen aria-hidden="true" className="size-7 text-[#2c5f7c]" />
        <h1 id="guide-title" className="text-2xl font-bold text-[#2c5f7c]">Guía de ejemplo</h1>
        <p className="text-base leading-relaxed">Una propuesta para conversar en familia durante unos 15 minutos, o el tiempo que prefieran.</p>
        <p className="rounded-xl bg-[#f1faee] p-4 text-sm leading-relaxed">Esta demostración no utiliza tus recuerdos, no mide el tiempo y no guarda sesiones ni reacciones.</p>
      </div>
      {finished ? <div className="space-y-4">
        <h2 tabIndex={-1} ref={node => node?.focus()} className="text-xl font-bold text-[#2c5f7c]">Gracias por compartir este momento</h2>
        <p>¿Cómo se sintieron? Pueden conversar sobre lo que les gustó y lo que prefieren dejar para otra ocasión.</p>
        <p className="text-sm text-gray-600">Terminaste la guía de ejemplo. No se ha guardado ningún registro.</p>
        <div className="flex flex-wrap gap-3"><Button onClick={() => { setFinished(false); setStep(0); }}>Volver a explorar</Button>{onViewMemories && <Button variant="outline" onClick={onViewMemories}>Ir a mis recuerdos</Button>}</div>
      </div> : step === null ? <Button size="lg" onClick={() => setStep(0)}>Explorar el ejemplo<ArrowRight aria-hidden="true" className="ml-2 size-4" /></Button> : <>
        <div role="status" className="text-sm font-semibold text-[#2c5f7c]">{paused ? "Guía en pausa" : `Paso ${step + 1} de ${steps.length}`}</div>
        <div className="space-y-3 py-2" aria-live="polite"><h2 className="text-xl font-bold text-[#264653]">{steps[step].title}</h2><p className="text-base leading-relaxed">{paused ? "Tómense el tiempo que necesiten. Pueden continuar o terminar aquí." : steps[step].text}</p></div>
        <div className="flex flex-wrap gap-3">
          {step > 0 && <Button variant="outline" disabled={paused} onClick={() => setStep(step - 1)}><ArrowLeft aria-hidden="true" className="mr-2 size-4" />Anterior</Button>}
          <Button variant="outline" onClick={() => setPaused(!paused)}>{paused ? <Play aria-hidden="true" className="mr-2 size-4" /> : <Pause aria-hidden="true" className="mr-2 size-4" />}{paused ? "Continuar" : "Pausar"}</Button>
          {step < steps.length - 1 && <Button disabled={paused} onClick={() => setStep(step + 1)}>Siguiente<ArrowRight aria-hidden="true" className="ml-2 size-4" /></Button>}
        </div>
        <Button variant="outline" onClick={finish} className="w-full">Terminar aquí</Button>
      </>}
    </section>
  );
}
