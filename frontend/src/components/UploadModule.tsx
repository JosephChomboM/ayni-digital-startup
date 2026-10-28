import { useEffect, useState } from "react"
import { Camera, Check, FileText, Link2, Music2, Upload, Users, Heart } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Badge } from "./ui/badge"
import { getMe } from "../api/auth"
import type { User } from "../api/auth"
import { createMemory, deleteMemory, getMemory, listMemories, memoryErrorMessage, updateMemory } from "../api/memories"
import type { Memory, MemoryInput } from "../api/memories"
import { ProfilePage } from "../pages/ProfilePage"

function SpotifyIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.899 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.019zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.18-.1.2-1.02-.36-.84-.18-.6-.84-.36-1.02 4.2-1.26 11.28-1.02 15.72 1.62.54.3.72.96.42 1.5-.3.54-.96.72-1.5.42z" />
    </svg>
  );
}

export function UploadModule() {
  const [pending, setPending] = useState(false)
  const [title, setTitle] = useState("")
  const [anecdote, setAnecdote] = useState("")
  const [song, setSong] = useState("")
  const [positive, setPositive] = useState(false)
  const [sensitive, setSensitive] = useState(false)
  const [editing, setEditing] = useState<Memory | null>(null)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [profileUser, setProfileUser] = useState<User | null>(null)

  const resetForm = () => {
    setTitle(""); setAnecdote(""); setSong(""); setPositive(false); setSensitive(false); setEditing(null)
  }

  const handleSave = async () => {
    setError(null); setSuccess(null)
    if (Boolean(anecdote.trim()) === Boolean(song.trim())) {
      setError("Escribe una anécdota o pega una canción, una a la vez.")
      return
    }
    const fields = { title, is_positive: positive, is_sensitive: sensitive }
    const data: MemoryInput = anecdote.trim()
      ? { ...fields, type: "anecdote", text: anecdote }
      : { ...fields, type: "song", url: song }
    setPending(true)
    try {
      if (editing) {
        const { type, ...changes } = data
        if (type !== editing.type) throw new Error("No puedes cambiar el tipo de recuerdo.")
        await updateMemory(editing.id, changes)
      } else {
        await createMemory(data)
      }
      setSuccess(editing ? "Cambios guardados." : "Recuerdo guardado.")
      resetForm()
      setRevision((value) => value + 1)
    } catch (err) { setError(memoryErrorMessage(err)) }
    finally { setPending(false) }
  }

  const handleEdit = async (id: string) => {
    setPending(true); setError(null); setSuccess(null)
    try {
      const memory = await getMemory(id)
      setEditing(memory); setTitle(memory.title); setAnecdote(memory.text ?? ""); setSong(memory.url ?? "")
      setPositive(memory.is_positive); setSensitive(memory.is_sensitive)
    } catch (err) { setError(memoryErrorMessage(err)) }
    finally { setPending(false) }
  }

  const handleDelete = async (id: string) => {
    setPending(true); setError(null); setSuccess(null)
    try {
      await deleteMemory(id)
      if (editing?.id === id) resetForm()
      setSuccess("Recuerdo eliminado.")
      setRevision((value) => value + 1)
    } catch (err) { setError(memoryErrorMessage(err)) }
    finally { setPending(false) }
  }

  const openProfile = async () => {
    setPending(true); setError(null); setSuccess(null)
    try { setProfileUser((await getMe()).user) }
    catch (err) { setError(memoryErrorMessage(err)) }
    finally { setPending(false) }
  }

  const handleShareWhatsApp = () => {
    const mensaje = encodeURIComponent(
      "¡Hola! 👋 Te invito a unirte a nuestro grupo en Ayni Digital para subir fotos, canciones y anécdotas familiares. 💚"
    )
    window.open(`https://wa.me/?text=${mensaje}`, "_blank")
  }

  if (profileUser) return (
    <div className="space-y-5">
      <Button variant="outline" onClick={() => { setProfileUser(null); setRevision((value) => value + 1) }}>Volver a recuerdos</Button>
      <ProfilePage currentUser={profileUser} />
    </div>
  )

  return (
    <div className="space-y-5">
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
        <div aria-disabled="true" className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#2c5f7c]/30 bg-[#f1faee] px-5 py-7 text-center">
          <div className="mb-3 rounded-full bg-white p-3 text-[#2c5f7c] shadow-sm">
            <Upload className="size-5" />
          </div>
          <p className="font-bold text-xs text-[#264653]">Fotos familiares</p>
          <p className="mt-1 text-[11px] text-gray-500">
            Próximamente
          </p>
          <Button
            disabled
            variant="outline"
            size="sm"
            className="mt-4 bg-white border-gray-300 text-[#2c5f7c] hover:bg-gray-50 font-bold text-xs rounded-xl"
          >
            <Camera className="size-3.5 mr-1.5 text-[#e76f51]" /> Elegir fotos
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          {success && <p role="status" className="text-xs text-[#2c5f7c]">{success}</p>}
          <label htmlFor="memory-title" className="text-xs font-bold text-[#264653]">Título del recuerdo</label>
          <Input id="memory-title" required maxLength={100} value={title} disabled={pending}
            onChange={(e) => { setTitle(e.target.value); setSuccess(null) }}
            placeholder="Ej. Un paseo en familia" className="text-xs border-gray-200 bg-gray-50/50" />
          <label htmlFor="memory" className="flex items-center gap-2 text-xs font-bold text-[#264653]">
            <FileText className="size-4 text-[#e76f51]" /> Una anécdota especial
          </label>
          <Textarea
            id="memory"
            maxLength={5000}
            disabled={pending || editing?.type === "song"}
            value={anecdote}
            onChange={(e) => { setAnecdote(e.target.value); setSuccess(null) }}
            placeholder="Papá trabajó 30 años en el Jirón de la Unión, le encantaba ir al cine Metro los domingos..."
            className="min-h-24 text-xs border-gray-200 bg-gray-50/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="song" className="flex items-center justify-between text-xs font-bold text-[#264653]">
            <span className="flex items-center gap-2">
              <Music2 className="size-4 text-[#e76f51]" /> Canción de YouTube o Spotify
            </span>
            <span className="text-[11px] text-[#1DB954] font-semibold flex items-center gap-1">
              <SpotifyIcon className="size-3.5" /> Enlace de canción
            </span>
          </label>
          <div className="relative">
            <Link2 className="absolute left-3 top-3 size-4 text-gray-400" />
            <Input
              id="song"
              type="url"
              maxLength={2048}
              disabled={pending || editing?.type === "anecdote"}
              value={song}
              onChange={(e) => { setSong(e.target.value); setSuccess(null) }}
              className="pl-9 text-xs border-gray-200 bg-gray-50/50"
              placeholder="Pega un enlace de video de YouTube o de canción de Spotify"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 text-xs text-[#264653]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={positive} disabled={pending} onChange={(e) => setPositive(e.target.checked)} />
            Es un recuerdo bonito
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sensitive} disabled={pending} onChange={(e) => setSensitive(e.target.checked)} />
            Es un tema delicado
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <Badge variant="secondary" className="bg-[#e76f51]/10 text-[#e76f51] hover:bg-[#e76f51]/20 font-bold text-[10px]">
            <Check className="size-3 mr-1" /> Contenido protegido
          </Badge>
          <Button
            onClick={handleSave}
            disabled={pending}
            className="bg-[#2c5f7c] hover:bg-[#224a61] text-white font-bold text-xs px-5 py-2 rounded-xl transition-all"
          >
            {pending ? "Procesando..." : editing ? "Guardar cambios" : "Guardar recuerdo"}
          </Button>
        </div>

        {editing && <Button variant="outline" disabled={pending} onClick={() => { resetForm(); setError(null); setSuccess(null) }}>Cancelar edición</Button>}
        <Button variant="outline" disabled={pending} onClick={openProfile}>Perfil y familia</Button>
        <Button
          variant="outline"
          onClick={handleShareWhatsApp}
          className="w-full border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10 font-bold text-xs rounded-xl"
        >
          <Users className="size-4 mr-2" /> Compartir Ayni por WhatsApp
        </Button>
      </CardContent>
    </Card>
    <Contributions revision={revision} busy={pending} onEdit={handleEdit} onDelete={handleDelete} />
    </div>
  )
}

export function Contributions({ revision = 0, busy = false, onEdit, onDelete }: {
  revision?: number; busy?: boolean;
  onEdit?: (id: string) => void; onDelete?: (id: string) => void;
}) {
  const [items, setItems] = useState<Memory[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [includeSensitive, setIncludeSensitive] = useState(false)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([listMemories({ include_sensitive: includeSensitive, limit: 20, offset: page * 20 }), getMe()])
      .then(([data, account]) => {
        if (!active) return
        setItems(data.items); setTotal(data.total); setUser(account.user); setError(null)
      }).catch((err: unknown) => { if (active) setError(memoryErrorMessage(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision, includeSensitive, page, attempt])
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
        <label className="flex items-center gap-2 text-xs text-[#264653]">
          <input type="checkbox" checked={includeSensitive} onChange={(e) => { setIncludeSensitive(e.target.checked); setPage(0); setLoading(true) }} />
          Mostrar temas delicados
        </label>
        {loading && <p role="status" className="text-xs text-gray-500">Cargando recuerdos...</p>}
        {error && <div role="alert" className="text-xs text-red-700">
          <p>{error}</p>
          <button className="underline" onClick={() => { setLoading(true); setAttempt((value) => value + 1) }}>Volver a intentar</button>
        </div>}
        {!loading && !error && items.length === 0 && <p className="text-xs text-gray-500">Todavía no hay recuerdos para mostrar.</p>}
        {!error && items.map((memory) => (
          <div key={memory.id} className="flex flex-col gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs font-bold text-[#264653]">{memory.title}</p>
            {memory.type === "anecdote"
              ? <p className="text-[11px] text-gray-500 whitespace-pre-wrap break-words">{memory.text}</p>
              : <a href={memory.url ?? undefined} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2c5f7c] underline">Abrir canción</a>}
            <div className="flex gap-2">
              {memory.is_positive && <Badge variant="outline">Recuerdo bonito</Badge>}
              {memory.is_sensitive && <Badge variant="outline">Tema delicado</Badge>}
            </div>
            {user && (user.role === "cuidador_principal" || user.id === memory.created_by) && (
              <div className="flex gap-2">
                {onEdit && <Button size="sm" variant="outline" disabled={busy} onClick={() => onEdit(memory.id)} aria-label={`Editar ${memory.title}`}>Editar</Button>}
                {onDelete && <Button size="sm" variant="outline" disabled={busy} onClick={() => onDelete(memory.id)} aria-label={`Eliminar ${memory.title}`}>Eliminar</Button>}
              </div>
            )}
          </div>
        ))}
        {!loading && !error && <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
          <span>{total} recuerdos</span>
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => { setPage((value) => value - 1); setLoading(true) }}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={(page + 1) * 20 >= total} onClick={() => { setPage((value) => value + 1); setLoading(true) }}>Siguiente</Button>
        </div>}
      </CardContent>
    </Card>
  )
}
