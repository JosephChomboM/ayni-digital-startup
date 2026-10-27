import { useState } from "react"
import { AlertTriangle, ArrowRight, HeartHandshake, CheckCircle2, ShieldCheck, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"
import { Button } from "./ui/button"

export function EthicalAlert() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <Alert className="border-[#e76f51]/30 bg-[#e76f51]/10 text-[#264653] p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-[#e76f51]/20 text-[#e76f51] shrink-0 mt-0.5 sm:mt-0">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <AlertTitle className="text-sm font-bold text-[#264653]">
              Acompañar también es saber pausar
            </AlertTitle>
            <AlertDescription className="mt-1 text-xs text-[#264653]/80 leading-relaxed">
              Si las últimas sesiones no han ido bien o percibes agitación, te recomendamos pausar las actividades y consultar con un profesional de la salud.
            </AlertDescription>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowModal(true)}
          className="border-[#e76f51]/40 bg-white text-[#e76f51] hover:bg-[#e76f51] hover:text-white transition-all font-bold text-xs shrink-0 w-full sm:w-auto"
        >
          Ver recomendaciones <ArrowRight className="size-3.5 ml-1" />
        </Button>
      </Alert>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-gray-200 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="p-2.5 rounded-2xl bg-[#2c5f7c]/10 text-[#2c5f7c]">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#2c5f7c]">Guía Ética de Pausado</h3>
                <p className="text-xs text-gray-500">Pautas de cuidado e intervención respetuosa</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#264653]">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <CheckCircle2 className="size-4 text-[#2c5f7c] shrink-0 mt-0.5" />
                <p>
                  <strong>No forzar la memoria:</strong> Si la persona no recuerda un dato o familiar, evita insistir. Cambia suavemente el tema de conversación.
                </p>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <CheckCircle2 className="size-4 text-[#2c5f7c] shrink-0 mt-0.5" />
                <p>
                  <strong>Detectar cansancio:</strong> Limita las sesiones a un máximo de 15 minutos diarios o detén la actividad si notas mirada evasiva o inquietud.
                </p>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <CheckCircle2 className="size-4 text-[#2c5f7c] shrink-0 mt-0.5" />
                <p>
                  <strong>Evitar temas sensibles:</strong> Omite fotografías o canciones asociadas a pérdidas dolorosas o conflictos del pasado.
                </p>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#e76f51]/10 border border-[#e76f51]/20">
                <AlertTriangle className="size-4 text-[#e76f51] shrink-0 mt-0.5" />
                <p className="text-[#264653]">
                  <strong>Consulta profesional:</strong> Ante cambios bruscos en el comportamiento o agitación persistente, acude al geriatra o neurólogo tratante.
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowModal(false)}
              className="w-full bg-[#2c5f7c] text-white font-bold text-xs py-2.5 rounded-xl hover:bg-[#224a61] transition-all"
            >
              Comprendido, cerrar guía
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

export function SafetyNote() {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-[#2c5f7c]/20 bg-[#2c5f7c]/5 px-5 py-3.5 text-xs text-[#2c5f7c] shadow-sm">
      <div className="p-1.5 rounded-lg bg-[#2c5f7c]/10 text-[#2c5f7c] shrink-0">
        <HeartHandshake className="size-4" />
      </div>
      <p className="leading-relaxed">
        <strong>Recuerda:</strong> Ayni Digital no realiza diagnósticos clínicos ni reemplaza la evaluación médica, psicológica o geriátrica profesional.
      </p>
    </div>
  )
}
