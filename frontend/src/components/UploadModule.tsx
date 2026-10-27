import { useState } from "react"
import { Camera, Check, FileText, Link2, Music2, Upload, Users, Heart } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Badge } from "./ui/badge"

function SpotifyIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.899 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.019zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.18-.1.2-1.02-.36-.84-.18-.6-.84-.36-1.02 4.2-1.26 11.28-1.02 15.72 1.62.54.3.72.96.42 1.5-.3.54-.96.72-1.5.42z" />
    </svg>
  );
}

export function UploadModule() {
  const [saved, setSaved] = useState(false)
  const [anecdote, setAnecdote] = useState("")
  const [song, setSong] = useState("")

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleShareWhatsApp = () => {
    const mensaje = encodeURIComponent(
      "¡Hola! 👋 Te invito a unirte a nuestro grupo en Ayni Digital para subir fotos, canciones y anécdotas familiares. 💚"
    )
    window.open(`https://wa.me/?text=${mensaje}`, "_blank")
  }

  return (
    <Card className="border border-gray-200 bg-white shadow-sm rounded-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex size-10 items-center justify-center rounded-2xl bg-[#2c5f7c] text-white shadow-sm shrink-0">
              <Heart className="size-5 fill-current text-[#e76f51]" />
              <span className="absolute -right-1 -top-1 size-3 rounded-full bg-[#e9c46a]" />
            </div>
            <div>
              <CardTitle className="text-lg font-extrabold text-[#2c5f7c]">
                Construyamos su historia
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 mt-0.5">
                Cada recuerdo compartido se convierte en un momento de estímulo y conexión.
              </CardDescription>
            </div>
          </div>
          <div className="rounded-2xl bg-[#2c5f7c]/10 p-2.5 text-[#2c5f7c] shrink-0">
            <Users className="size-5" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#2c5f7c]/30 bg-[#f1faee] px-5 py-7 text-center transition-all hover:border-[#2c5f7c] hover:bg-[#2c5f7c]/5">
          <div className="mb-3 rounded-full bg-white p-3 text-[#2c5f7c] shadow-sm">
            <Upload className="size-5" />
          </div>
          <p className="font-bold text-xs text-[#264653]">Arrastra fotos familiares aquí</p>
          <p className="mt-1 text-[11px] text-gray-500">
            o elige desde tu galería • JPG, PNG hasta 10 MB
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 bg-white border-gray-300 text-[#2c5f7c] hover:bg-gray-50 font-bold text-xs rounded-xl"
          >
            <Camera className="size-3.5 mr-1.5 text-[#e76f51]" /> Elegir fotos
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="memory" className="flex items-center gap-2 text-xs font-bold text-[#264653]">
            <FileText className="size-4 text-[#e76f51]" /> Una anécdota especial
          </label>
          <Textarea
            id="memory"
            value={anecdote}
            onChange={(e) => setAnecdote(e.target.value)}
            placeholder="Papá trabajó 30 años en el Jirón de la Unión, le encantaba ir al cine Metro los domingos..."
            className="min-h-24 text-xs border-gray-200 bg-gray-50/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="song" className="flex items-center justify-between text-xs font-bold text-[#264653]">
            <span className="flex items-center gap-2">
              <Music2 className="size-4 text-[#e76f51]" /> Canción o Playlist de Spotify
            </span>
            <span className="text-[11px] text-[#1DB954] font-semibold flex items-center gap-1">
              <SpotifyIcon className="size-3.5" /> Vincular con Spotify
            </span>
          </label>
          <div className="relative">
            <Link2 className="absolute left-3 top-3 size-4 text-gray-400" />
            <Input
              id="song"
              value={song}
              onChange={(e) => setSong(e.target.value)}
              className="pl-9 text-xs border-gray-200 bg-gray-50/50"
              placeholder="Pega un enlace de canción o playlist de Spotify / YouTube (ej. Boleros de Los Panchos)"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <Badge variant="secondary" className="bg-[#e76f51]/10 text-[#e76f51] hover:bg-[#e76f51]/20 font-bold text-[10px]">
            <Check className="size-3 mr-1" /> Contenido protegido
          </Badge>
          <Button
            onClick={handleSave}
            disabled={saved}
            className="bg-[#2c5f7c] hover:bg-[#224a61] text-white font-bold text-xs px-5 py-2 rounded-xl transition-all"
          >
            {saved ? "Recuerdo guardado" : "Guardar recuerdo"}
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={handleShareWhatsApp}
          className="w-full border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10 font-bold text-xs rounded-xl"
        >
          <Users className="size-4 mr-2" /> Invitar familiar por WhatsApp
        </Button>
      </CardContent>
    </Card>
  )
}

export function Contributions() {
  return (
    <Card className="border border-gray-200 bg-white shadow-sm rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base font-bold text-[#2c5f7c]">
          Contribuciones familiares
        </CardTitle>
        <CardDescription className="text-xs text-gray-500 mt-0.5">
          Los recuerdos que comparte la red familiar entre todos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e9c46a] font-bold text-xs text-[#264653]">
            M
          </div>
          <div>
            <p className="text-xs font-bold text-[#264653]">María • Hija</p>
            <p className="text-[11px] text-gray-500">3 fotos de la época de trabajo en el centro</p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px] text-gray-400 border-gray-200">
            Hoy
          </Badge>
        </div>

        <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e76f51]/20 font-bold text-xs text-[#e76f51]">
            J
          </div>
          <div>
            <p className="text-xs font-bold text-[#264653]">Jorge • Hermano</p>
            <p className="text-[11px] text-gray-500">Canción: Sabor a mí (Los Panchos)</p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px] text-gray-400 border-gray-200">
            Ayer
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
