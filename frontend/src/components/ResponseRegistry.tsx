import { useState } from "react"
import { Check, Loader2, SmilePlus } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Textarea } from "./ui/textarea"

const responses = [
  { icon: "😊", label: "Receptivo" },
  { icon: "😢", label: "Emocionado" },
  { icon: "😐", label: "Indiferente" },
  { icon: "😟", label: "Agitado" },
]

export function ResponseRegistry() {
  const [selected, setSelected] = useState("Receptivo")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }, 700)
  }

  return (
    <Card className="border border-gray-200 bg-white shadow-sm rounded-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[#e9c46a]/20 p-3 text-[#2c5f7c]">
            <SmilePlus className="size-6" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-[#2c5f7c]">
              ¿Cómo reaccionó tu familiar?
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Registrar ayuda a recomendar mejores actividades interactivas.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          {responses.map((response) => {
            const isSelected = selected === response.label
            return (
              <button
                key={response.label}
                type="button"
                onClick={() => setSelected(response.label)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? "border-[#2c5f7c] bg-[#2c5f7c]/10 ring-2 ring-[#2c5f7c]/20"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
                aria-pressed={isSelected}
              >
                <span className="text-2xl">{response.icon}</span>
                <span className="mt-1 block text-xs font-bold text-[#264653]">
                  {response.label}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="notes" className="text-xs font-bold text-[#264653]">
            ¿Algo más que quieras anotar?{" "}
            <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Por ejemplo: sonrió cuando escuchó la canción del Cine Metro..."
            className="min-h-20 text-xs border-gray-200 bg-gray-50/50"
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || saved}
          className="w-full bg-[#2c5f7c] hover:bg-[#224a61] text-white font-bold text-xs py-2.5 rounded-xl transition-all"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Guardando respuesta...
            </span>
          ) : saved ? (
            <span className="flex items-center justify-center gap-2 text-green-100">
              <Check className="size-4 text-green-300" />
              Registro guardado
            </span>
          ) : (
            "Guardar registro"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
