import { useEffect, useMemo, useState } from "react"
import { Check, FileText, ImagePlus, Link2, Music2, Trash2, Users, Heart } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Badge } from "./ui/badge"
import { getMe } from "../api/auth"
import type { User } from "../api/auth"
import { createMemory, deleteMemory, getMemory, listMemories, memoryErrorMessage, updateMemory } from "../api/memories"
import type { Memory, MemoryInput, MemoryType } from "../api/memories"
import { deleteLocalFamilyPhoto, getLocalFamilyPhotos, saveLocalFamilyPhoto } from "../api/localMedia"
import type { LocalFamilyPhoto } from "../api/localMedia"
import { ProfilePage } from "../pages/ProfilePage"

async function rasterizePhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > 40_000_000) {
      throw new Error("La foto tiene demasiados píxeles.")
    }
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("No se pudo procesar la foto.")
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo convertir la foto.")), "image/png")
    })
    return new File([png], file.name.replace(/\.[^.]+$/, ".png"), { type: "image/png", lastModified: file.lastModified })
  } finally {
    bitmap.close()
  }
}

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
  const [memoryMode, setMemoryMode] = useState<MemoryType>("anecdote")
  const [editing, setEditing] = useState<Memory | null>(null)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [profileUser, setProfileUser] = useState<User | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [photos, setPhotos] = useState<LocalFamilyPhoto[]>([])
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [successDialog, setSuccessDialog] = useState(false)

  useEffect(() => {
    let active = true
    getMe().then(async ({ user }) => {
      if (!active) return
      setCurrentUser(user)
      const localPhotos = await getLocalFamilyPhotos(user.family_id)
      if (active) setPhotos(localPhotos)
    }).catch(() => { if (active) setCurrentUser(null) })
    return () => { active = false }
  }, [])

  const resetForm = () => {
    setTitle(""); setAnecdote(""); setSong(""); setPositive(false); setSensitive(false); setEditing(null); setMemoryMode("anecdote"); setPendingPhotos([]); setPhotoError(null)
  }

  const handleSave = async () => {
    setError(null); setSuccess(null)
    if (memoryMode === "anecdote" && !anecdote.trim()) {
      setError("Escribe una anécdota antes de guardarla.")
      return
    }
    if (memoryMode === "song" && !song.trim()) {
      setError("Pega el enlace de una canción antes de guardarla.")
      return
    }
    const fields = { title, is_positive: positive, is_sensitive: sensitive }
    const data: MemoryInput = memoryMode === "anecdote"
      ? { ...fields, type: "anecdote", text: anecdote }
      : { ...fields, type: "song", url: song }
    setPending(true)
    const savedPhotoIds: string[] = []
    try {
      if (pendingPhotos.length && currentUser) {
        for (const file of pendingPhotos) {
          const photoId = crypto.randomUUID()
          await saveLocalFamilyPhoto({ id: photoId, family_id: currentUser.family_id, created_by: currentUser.id, creator_name: currentUser.name, name: file.name, mime_type: file.type, blob: file, created_at: new Date().toISOString() })
          savedPhotoIds.push(photoId)
        }
      }
      if (editing) {
        const { type, ...changes } = data
        if (type !== editing.type) throw new Error("No puedes cambiar el tipo de recuerdo.")
        await updateMemory(editing.id, changes)
      } else {
        await createMemory(data)
      }
      if (currentUser) setPhotos(await getLocalFamilyPhotos(currentUser.family_id))
      setSuccess(editing ? "Cambios guardados." : "Recuerdo guardado.")
      resetForm()
      setRevision((value) => value + 1)
      setSuccessDialog(true)
    } catch (err) {
      if (currentUser) await Promise.all(savedPhotoIds.map((id) => deleteLocalFamilyPhoto(id, currentUser.family_id, currentUser.id)))
      setError(memoryErrorMessage(err))
    }
    finally { setPending(false) }
  }

  const handleEdit = async (id: string) => {
    setPending(true); setError(null); setSuccess(null)
    try {
      const memory = await getMemory(id)
      setMemoryMode(memory.type)
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

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files?.length || !currentUser) return
    setPhotoError(null)
    const selected = Array.from(files)
    if (photos.length + pendingPhotos.length + selected.length > 12) {
      setPhotoError("Puedes agregar hasta 12 fotos.")
      return
    }
    const invalid = selected.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024)
    if (invalid) {
      setPhotoError("Usa fotos JPG, PNG o WebP de hasta 8 MB cada una.")
      return
    }
    setPending(true)
    try {
      const safePhotos = await Promise.all(selected.map(rasterizePhoto))
      setPendingPhotos((current) => [...current, ...safePhotos])
    } catch {
      setPhotoError("No se pudo procesar una de las fotos. Elige una imagen JPG, PNG o WebP válida.")
    } finally {
      setPending(false)
    }
  }

  const handleDeletePhoto = async (photo: LocalFamilyPhoto) => {
    if (!currentUser) return
    await deleteLocalFamilyPhoto(photo.id, currentUser.family_id, currentUser.id)
    setPhotos(await getLocalFamilyPhotos(currentUser.family_id))
  }

  const handleShareWhatsApp = () => {
    const mensaje = encodeURIComponent(
      "Te invito a unirte a nuestro grupo en Ayni Digital para compartir fotos, canciones y anécdotas familiares."
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
    <Card className="border border-gray-200 bg-white shadow-xs rounded-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex size-10 items-center justify-center rounded-2xl bg-[#2c5f7c] text-white shadow-xs shrink-0">
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
        <section className="space-y-4 py-2" aria-labelledby="family-photos-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h3 id="family-photos-title" className="font-semibold text-[#2c5f7c]">Fotos para compartir</h3><p className="mt-1 text-sm text-slate-600">Elige imágenes familiares para acompañar una conversación.</p></div>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#2c5f7c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#244d66] has-[:disabled]:opacity-60">
              <ImagePlus className="size-4" /> Seleccionar fotos
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={pending || !currentUser} onChange={(event) => { handlePhotoFiles(event.target.files); event.currentTarget.value = "" }} className="sr-only" />
            </label>
          </div>
          {photoError && <p role="alert" className="text-sm text-red-700">{photoError}</p>}
          {pendingPhotos.length > 0 && <p className="text-sm font-medium text-[#2c5f7c]">{pendingPhotos.length} {pendingPhotos.length === 1 ? "foto seleccionada" : "fotos seleccionadas"}; se guardarán junto con el recuerdo.</p>}
          {pendingPhotos.length > 0 && <StagedPhotoGrid files={pendingPhotos} onRemove={(index) => setPendingPhotos((items) => items.filter((_, itemIndex) => itemIndex !== index))} />}
          {pendingPhotos.length === 0 && <p className="py-3 text-sm text-slate-500">Las fotos seleccionadas se guardan solo en este navegador al guardar el recuerdo. No se sincronizan con otros dispositivos.</p>}
        </section>

        <div className="space-y-4 border-t border-slate-200 pt-5">
          <div><h3 className="font-semibold text-[#2c5f7c]">Guardar un recuerdo</h3><p className="mt-1 text-sm text-slate-600">Conserva una historia o una canción que ayude a abrir la conversación.</p></div>
          <div className="flex gap-2" role="tablist" aria-label="Tipo de recuerdo">
            <button type="button" role="tab" aria-selected={memoryMode === "anecdote"} onClick={() => { setMemoryMode("anecdote"); setSong(""); setError(null) }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${memoryMode === "anecdote" ? "bg-[#2c5f7c] text-white" : "text-[#2c5f7c] hover:bg-slate-100"}`}>
              <FileText className="mr-2 inline size-4" />Anécdota
            </button>
            <button type="button" role="tab" aria-selected={memoryMode === "song"} onClick={() => { setMemoryMode("song"); setAnecdote(""); setError(null) }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${memoryMode === "song" ? "bg-[#2c5f7c] text-white" : "text-[#2c5f7c] hover:bg-slate-100"}`}>
              <Music2 className="mr-2 inline size-4" />Canción
            </button>
          </div>
        <div className="flex flex-col gap-1.5">
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          {success && <p role="status" className="flex items-center gap-2 text-sm font-medium text-[#2c5f7c]"><Check className="size-4" aria-hidden="true" />{success}</p>}
          <label htmlFor="memory-title" className="text-xs font-bold text-[#264653]">Título del recuerdo</label>
          <Input id="memory-title" required maxLength={100} value={title} disabled={pending}
            onChange={(e) => { setTitle(e.target.value); setSuccess(null) }}
            placeholder="Ej. Un paseo en familia" className="text-xs border-gray-200 bg-gray-50/50" />
          {memoryMode === "anecdote" && <label htmlFor="memory" className="flex items-center gap-2 text-xs font-bold text-[#264653]">
            <FileText className="size-4 text-[#e76f51]" /> Una anécdota especial
          </label>}
          {memoryMode === "anecdote" && <Textarea
            id="memory"
            maxLength={5000}
            disabled={pending || memoryMode !== "anecdote"}
            value={anecdote}
            onChange={(e) => { setAnecdote(e.target.value); setSuccess(null) }}
            placeholder="¿Qué pasó? ¿Quiénes estaban? ¿Qué detalle de ese día recuerdan con cariño?"
            className="min-h-24 text-xs border-gray-200 bg-gray-50/50"
          />}
        </div>

        {memoryMode === "song" && <div className="flex flex-col gap-1.5">
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
              disabled={pending}
              value={song}
              onChange={(e) => { setSong(e.target.value); setSuccess(null) }}
              className="pl-9 text-xs border-gray-200 bg-gray-50/50"
              placeholder="Pega un enlace de video de YouTube o de canción de Spotify"
            />
          </div>
        </div>}

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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <Badge variant="secondary" className="bg-[#e76f51]/10 text-[#e76f51] hover:bg-[#e76f51]/20 font-bold text-[10px]">
            <Check className="size-3 mr-1" /> Contenido protegido
          </Badge>
          <Button
            onClick={handleSave}
            disabled={pending}
            className="bg-[#2c5f7c] hover:bg-[#224a61] text-white font-bold text-xs px-5 py-2 rounded-xl transition-all"
          >
            {pending ? "Guardando…" : editing ? "Guardar cambios" : memoryMode === "song" ? "Guardar canción" : "Guardar anécdota"}
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
        </div>
      </CardContent>
    </Card>
    <Contributions revision={revision} busy={pending} photos={photos} currentUserId={currentUser?.id ?? ""} onDeletePhoto={handleDeletePhoto} onEdit={handleEdit} onDelete={handleDelete} />
    {successDialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="memory-saved-title" className="w-full max-w-sm rounded-xl bg-white p-7 text-center shadow-xl"><div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check className="size-7" aria-hidden="true" /></div><h2 id="memory-saved-title" className="mt-4 text-xl font-semibold text-[#2c5f7c]">¡Se guardó correctamente!</h2><p className="mt-2 text-sm text-slate-600">{success}</p><Button autoFocus onClick={() => setSuccessDialog(false)} className="mt-5 w-full bg-[#2c5f7c] hover:bg-[#224a61]">OK</Button></section></div>}
    </div>
  )
}

function PhotoGrid({ photos, currentUserId, onDelete }: {
  photos: LocalFamilyPhoto[];
  currentUserId: string;
  onDelete: (photo: LocalFamilyPhoto) => void;
}) {
  const [sources, setSources] = useState<Record<string, string>>({});
  useEffect(() => {
    const urls = photos.map((photo) => [photo.id, URL.createObjectURL(photo.blob)] as const);
    setSources(Object.fromEntries(urls));
    return () => urls.forEach(([, url]) => URL.revokeObjectURL(url));
  }, [photos]);

  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {photos.map((photo) => <figure key={photo.id} className="group relative overflow-hidden rounded-lg">
      {sources[photo.id] && <img src={sources[photo.id]} alt="Foto familiar guardada" className="aspect-square w-full object-cover" />}
      <figcaption className="flex items-center justify-between gap-2 py-2 text-xs text-slate-600">
        <span className="truncate">Foto familiar</span>
        {photo.created_by === currentUserId && <button type="button" onClick={() => onDelete(photo)} aria-label="Eliminar foto familiar" className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-red-700"><Trash2 className="size-4" /></button>}
      </figcaption>
    </figure>)}
  </div>;
}

function StagedPhotoGrid({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const [sources, setSources] = useState<string[]>([])
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file))
    setSources(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [files])
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{files.map((_, index) => <figure key={index} className="overflow-hidden rounded-lg">{sources[index] && <img src={sources[index]} alt={`Vista previa de foto ${index + 1}`} className="aspect-square w-full object-cover" />}<figcaption className="flex items-center justify-between gap-2 py-2 text-xs text-slate-600"><span className="truncate">Foto seleccionada {index + 1}</span><button type="button" onClick={() => onRemove(index)} aria-label={`Quitar foto ${index + 1}`} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-red-700"><Trash2 className="size-4" /></button></figcaption></figure>)}</div>
}

export function Contributions({ revision = 0, busy = false, photos = [], currentUserId = "", onDeletePhoto, onEdit, onDelete }: {
  revision?: number; busy?: boolean;
  photos?: LocalFamilyPhoto[]; currentUserId?: string;
  onDeletePhoto?: (photo: LocalFamilyPhoto) => void;
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
  const [searchText, setSearchText] = useState("")
  const [query, setQuery] = useState("")
  const [dateRange, setDateRange] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  useEffect(() => {
    let active = true
    setLoading(true); setItems([]); setError(null)
    Promise.all([listMemories({ q: query || undefined, include_sensitive: includeSensitive, limit: 100, offset: page * 100 }), getMe()])
      .then(([data, account]) => {
        if (!active) return
        setItems(data.items); setTotal(data.total); setUser(account.user); setError(null)
      }).catch((err: unknown) => { if (active) setError(memoryErrorMessage(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision, includeSensitive, page, attempt, query])
  const visibleItems = useMemo(() => items.filter((memory) => {
    const date = new Date(memory.created_at)
    const now = new Date()
    if (dateRange === "3days" && date < new Date(now.getTime() - 3 * 86400000)) return false
    if (dateRange === "week" && date < new Date(now.getTime() - 7 * 86400000)) return false
    if (dateFrom && date < new Date(`${dateFrom}T00:00:00`)) return false
    if (dateTo && date > new Date(`${dateTo}T23:59:59.999`)) return false
    return true
  }), [items, dateRange, dateFrom, dateTo])
  return (
    <Card className="border border-gray-200 bg-white shadow-xs rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base font-bold text-[#2c5f7c]">
          Contribuciones familiares
        </CardTitle>
        <CardDescription className="text-xs text-gray-500 mt-0.5">
          Los recuerdos que comparte la red familiar entre todos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {photos.length > 0 && <section className="space-y-3" aria-labelledby="saved-family-photos"><h3 id="saved-family-photos" className="text-sm font-semibold text-[#264653]">Fotos guardadas</h3><PhotoGrid photos={photos} currentUserId={currentUserId} onDelete={(photo) => onDeletePhoto?.(photo)} /></section>}
        <form className="flex flex-col gap-2" onSubmit={(event) => {
          event.preventDefault(); setPage(0); setQuery(searchText.trim())
        }}>
          <label htmlFor="memory-search" className="text-xs font-bold text-[#264653]">Buscar recuerdos</label>
          <Input id="memory-search" maxLength={100} value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Título, palabras, personas o lugares" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="outline">Buscar</Button>
            <Button type="button" size="sm" variant="outline" disabled={!searchText && !query}
              onClick={() => { setSearchText(""); setQuery(""); setPage(0) }}>Limpiar búsqueda</Button>
          </div>
        </form>
        <label className="flex items-center gap-2 text-xs text-[#264653]">
          <input type="checkbox" checked={includeSensitive} onChange={(e) => { setIncludeSensitive(e.target.checked); setPage(0); setLoading(true) }} />
          Mostrar temas delicados
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#264653]">Fecha
            <select value={dateRange} onChange={(event) => setDateRange(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
              <option value="all">Cualquier fecha</option><option value="3days">Últimos 3 días</option><option value="week">Última semana</option><option value="custom">Elegir fechas</option>
            </select>
          </label>
          {dateRange === "custom" && <><label className="flex flex-col gap-1 text-xs font-semibold text-[#264653]">Desde<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" /></label><label className="flex flex-col gap-1 text-xs font-semibold text-[#264653]">Hasta<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal" /></label></>}
        </div>
        {loading && <p role="status" className="text-xs text-gray-500">Cargando recuerdos...</p>}
        {error && <div role="alert" className="text-xs text-red-700">
          <p>{error}</p>
          <button className="underline" onClick={() => { setLoading(true); setAttempt((value) => value + 1) }}>Volver a intentar</button>
        </div>}
        {!loading && !error && visibleItems.length === 0 && <p className="text-xs text-gray-500">{items.length ? "No hay recuerdos en ese periodo." : query ? "No encontramos recuerdos con esa búsqueda." : "Todavía no hay recuerdos para mostrar."}</p>}
        {!loading && !error && visibleItems.map((memory) => (
          <div key={memory.id} className="flex flex-col gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs font-bold text-[#264653]">{memory.title}</p>
            {memory.type === "anecdote"
              ? <p className="text-[11px] text-gray-500 whitespace-pre-wrap wrap-break-word">{memory.text}</p>
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
          <span>{visibleItems.length} mostrados · {total} recuerdos en total</span>
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => { setPage((value) => value - 1); setLoading(true) }}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={(page + 1) * 100 >= total} onClick={() => { setPage((value) => value + 1); setLoading(true) }}>Siguiente</Button>
        </div>}
      </CardContent>
    </Card>
  )
}
