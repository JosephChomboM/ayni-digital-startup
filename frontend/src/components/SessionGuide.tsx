import { useState } from "react"
import { Clock3, Loader2, Pause, Play, Sparkles, Square } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Progress } from "./ui/progress"

export function SessionGuide() {
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(false)

  const generate = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setStarted(true)
    }, 700)
  }

  const steps = [
    "Muéstrale estas 3 fotos de su época en el Jirón de la Unión.",
    "Pregúntale: ¿Te acuerdas de esta calle? ¿Qué tiendas o cines solías visitar?",
    "Ponle la canción de Los Panchos que su familia marcó como favorita.",
    "Observa su reacción y escucha con atención, sin presionarla a responder de inmediato.",
  ]

  return (
    <Card className="overflow-hidden border border-gray-200 bg-white shadow-sm rounded-2xl">
      <div className="h-1.5 bg-gradient-to-r from-[#2c5f7c] via-[#e9c46a] to-[#e76f51]" />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-[#2c5f7c]">Guía de sesión</CardTitle>
            <CardDescription className="text-xs text-gray-500 mt-0.5">
              Una actividad breve, pensada para compartir recuerdos felices.
            </CardDescription>
          </div>
          <div className="rounded-2xl bg-[#e76f51]/10 p-3 text-[#e76f51]">
            <Sparkles className="size-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!started ? (
          <div className="rounded-2xl bg-[#f1faee] border border-[#2c5f7c]/20 px-5 py-8 text-center space-y-3">
            <p className="text-xs text-gray-600 leading-relaxed max-w-sm mx-auto">
              Basada en el contenido, anécdotas e gustos musicales que tu familia ha compartido en la plataforma.
            </p>
            <Button
              onClick={generate}
              disabled={loading}
              className="bg-[#e76f51] hover:bg-[#d65d3f] text-white font-bold text-xs py-2.5 px-6 rounded-xl shadow-sm transition-all"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Organizando los recuerdos...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4" /> Generar sesión de hoy
                </span>
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl bg-[#2c5f7c]/10 p-4 border border-[#2c5f7c]/20">
              <div>
                <p className="text-xs font-bold text-[#2c5f7c] uppercase">Sesión de hoy</p>
                <p className="text-2xl font-extrabold text-[#264653]">15 min</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#2c5f7c]">
                <Clock3 className="size-4" /> {paused ? "En pausa" : "04:32"}
              </div>
            </div>

            <Progress value={30} className="h-2" />

            <ol className="flex flex-col gap-4">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e9c46a] text-xs font-bold text-[#264653]">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 text-xs leading-relaxed text-[#264653] font-medium">
                    {step}
                  </p>
                </li>
              ))}
            </ol>

            <div className="flex gap-3 border-t border-gray-100 pt-4">
              <Button
                variant="outline"
                onClick={() => setPaused(!paused)}
                className="flex-1 border-gray-300 text-[#264653] hover:bg-gray-50 text-xs font-bold rounded-xl"
              >
                {paused ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Play className="size-4 text-[#2c5f7c]" /> Continuar
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <Pause className="size-4 text-[#e76f51]" /> Pausar
                  </span>
                )}
              </Button>
              <Button
                onClick={() => setStarted(false)}
                className="flex-1 bg-[#e76f51] hover:bg-[#d65d3f] text-white text-xs font-bold rounded-xl"
              >
                <Square className="size-4 mr-1.5" /> Terminar sesión
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
