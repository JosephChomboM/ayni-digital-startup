import { PageIntro } from "./PageIntro";
import { useEffect, useMemo, useRef, useState } from "react"
import { Check, FileText, ImagePlus, Link2, Music2, Trash2, Users, Heart, Search, CalendarDays, Pencil, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { Badge } from "./ui/badge"
import { getMe } from "../api/auth"
import type { User } from "../api/auth"
import { createMemory, deleteMemory, getMemory, listMemories, memoryErrorMessage, updateMemory } from "../api/memories"
import type { Memory, MemoryInput, MemoryType } from "../api/memories"
import { uploadPhoto, listPhotos, deletePhoto } from "../api/photos"
import type { MemoryPhoto } from "../api/photos"
import { ProfilePage } from "../pages/ProfilePage"

function SpotifyIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.899 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.019zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.18-.1.2-1.02-.36-.84-.18-.6-.84-.36-1.02 4.2-1.26 11.28-1.02 15.72 1.62.54.3.72.96.42 1.5-.3.54-.96.72-1.5.42z" />
    </svg>
  );
}

export function UploadModule() {
  const [section, setSection] = useState<"add" | "list">("add")
  const panel = useRef<HTMLElement>(null)
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
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [successDialog, setSuccessDialog] = useState(false)
  useEffect(() => { if (!successDialog) panel.current?.focus(); }, [section, successDialog])

  useEffect(() => {
    let active = true
    getMe().then(async ({ user }) => {
      if (!active) return
      setCurrentUser(user)
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
    try {
      let saved: Memory
      if (editing) {
        const { type, ...changes } = data
        if (type !== editing.type) throw new Error("No puedes cambiar el tipo de recuerdo.")
        saved = await updateMemory(editing.id, changes)
      } else {
        saved = await createMemory(data)
      }
      // Preserve the ID and remaining files if a later upload fails.
      setEditing(saved)
      for (const file of pendingPhotos) {
        await uploadPhoto(saved.id, file)
        setPendingPhotos((files) => files.slice(1))
      }
      setSuccess(editing ? "Cambios guardados." : "Recuerdo guardado.")
      resetForm()
      setRevision((value) => value + 1)
      setSection("list")
      setSuccessDialog(true)
    } catch (err) {
      setRevision((value) => value + 1)
      setError(memoryErrorMessage(err))
    }
    finally { setPending(false) }
  }

  const handleEdit = async (id: string) => {
    setPending(true); setError(null); setSuccess(null)
    try {
      const memory = await getMemory(id)
      setPendingPhotos([])
      setMemoryMode(memory.type)
      setEditing(memory); setTitle(memory.title); setAnecdote(memory.text ?? ""); setSong(memory.url ?? "")
      setPositive(memory.is_positive); setSensitive(memory.is_sensitive)
      setSection("add")
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
    } catch (err) {
      setRevision((value) => value + 1)
      setError(memoryErrorMessage(err))
    }
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
    const invalid = selected.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024)
    if (invalid) {
      setPhotoError("Usa fotos JPG, PNG o WebP de hasta 8 MB cada una.")
      return
    }
    setPendingPhotos((current) => [...current, ...selected])
  }

  const handleDeletePhoto = async (photo: MemoryPhoto) => {
    setPending(true); setError(null); setSuccess(null)
    try {
      await deletePhoto(photo)
      setRevision((value) => value + 1)
      setSuccess("Foto eliminada.")
    } catch (err) { setError(memoryErrorMessage(err)) }
    finally { setPending(false) }
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
    <div className="memories-page space-y-6">
    <PageIntro eyebrow="EL ÁLBUM DE NUESTRA VIDA" title="Recuerdos">Una fotografía, una canción, un momento que merece volver a contarse.</PageIntro>
    <nav aria-label="Secciones de recuerdos" className="flex flex-wrap gap-2">
      <Button variant={section === "add" ? "default" : "outline"} aria-pressed={section === "add"} disabled={pending} onClick={() => setSection("add")}>{editing ? "Editar recuerdo" : "Agregar recuerdo"}</Button>
      <Button variant={section === "list" ? "default" : "outline"} aria-pressed={section === "list"} disabled={pending} onClick={() => setSection("list")}>Mis recuerdos</Button>
    </nav>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {success && !successDialog && <p role="status" className="text-sm text-[#2c5f7c]">{success}</p>}
    <section ref={panel} tabIndex={-1} aria-label={section === "add" ? editing ? "Editar recuerdo" : "Agregar recuerdo" : "Mis recuerdos"} className="focus:outline-none">
    {section === "add" ? <>
    <Card className="memory-composer">
      <CardHeader className="memory-composer-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="memory-composer-mark"><Heart className="size-6 fill-current text-[#e76f51]" aria-hidden="true" /></div>
            <div>
              <CardTitle className="memory-composer-title">
                {editing ? "Editar recuerdo" : "Agregar recuerdo"}
              </CardTitle>
              <CardDescription className="memory-composer-description">
                Cada recuerdo compartido se convierte en un momento de estímulo y conexión.
              </CardDescription>
            </div>
          </div>
          <span className="memory-family-note"><Users size={17} aria-hidden="true"/> Un espacio familiar</span>
        </div>
      </CardHeader>

      <CardContent className="memory-composer-content">
        <section className="memory-photo-section" aria-labelledby="family-photos-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="memory-section-heading"><span className="memory-step-number">01</span><div><h3 id="family-photos-title">Fotos para compartir</h3><p>Elige imágenes familiares para acompañar una conversación.</p></div></div>
            <label className="memory-photo-picker">
              <ImagePlus className="size-4" /> Seleccionar fotos
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={pending || !currentUser} onChange={(event) => { handlePhotoFiles(event.target.files); event.currentTarget.value = "" }} className="sr-only" />
            </label>
          </div>
          {photoError && <p role="alert" className="text-sm text-red-700">{photoError}</p>}
          {pendingPhotos.length > 0 && <p className="memory-selected-count">{pendingPhotos.length} {pendingPhotos.length === 1 ? "foto lista" : "fotos listas"} para acompañar la historia</p>}
          {pendingPhotos.length > 0 && <StagedPhotoGrid files={pendingPhotos} onRemove={(index) => setPendingPhotos((items) => items.filter((_, itemIndex) => itemIndex !== index))} />}
          {pendingPhotos.length === 0 && <p className="memory-photo-empty"><ImagePlus size={19} aria-hidden="true"/> Puedes agregar una o varias fotos; aparecerán aquí antes de guardar.</p>}
        </section>

        <div className="memory-story-section">
          <div className="memory-section-heading"><span className="memory-step-number">02</span><div><h3>Guardar un recuerdo</h3><p>Una historia o canción puede abrir una conversación especial.</p></div></div>
          <div className="memory-kind-tabs" role="tablist" aria-label="Tipo de recuerdo">
            <button type="button" role="tab" aria-selected={memoryMode === "anecdote"} onClick={() => { setMemoryMode("anecdote"); setSong(""); setError(null) }}>
              <FileText aria-hidden="true"/><span>Anécdota</span><small>Un momento contado</small>
            </button>
            <button type="button" role="tab" aria-selected={memoryMode === "song"} onClick={() => { setMemoryMode("song"); setAnecdote(""); setError(null) }}>
              <Music2 aria-hidden="true"/><span>Canción</span><small>Una melodía especial</small>
            </button>
          </div>
          <div className="memory-compose-layout">
            <div className="memory-compose-main">
              <div className="memory-fields flex flex-col gap-1.5">
                <label htmlFor="memory-title">Título del recuerdo <small>Un nombre corto para encontrarlo luego</small></label>
                <Input id="memory-title" required maxLength={100} value={title} disabled={pending}
                  onChange={(e) => { setTitle(e.target.value); setSuccess(null) }}
                  placeholder="Ej. Un paseo en familia" className="memory-title-input" />
                {memoryMode === "anecdote" && <label htmlFor="memory" className="memory-story-label"><FileText aria-hidden="true"/> Una anécdota especial</label>}
                {memoryMode === "anecdote" && <Textarea
                  id="memory"
                  maxLength={5000}
                  disabled={pending || memoryMode !== "anecdote"}
                  value={anecdote}
                  onChange={(e) => { setAnecdote(e.target.value); setSuccess(null) }}
                  placeholder="¿Qué pasó? ¿Quiénes estaban? ¿Qué detalle de ese día recuerdan con cariño?"
                  className="memory-story-input"
                />}
              </div>

              {memoryMode === "song" && <div className="memory-song-field">
                <label htmlFor="song"><span><Music2 aria-hidden="true"/> Enlace de YouTube o Spotify</span><span className="memory-song-provider"><SpotifyIcon/> YouTube · Spotify</span></label>
                <div className="relative">
                  <Link2 className="absolute left-4 top-4 size-4 text-[#829397]" aria-hidden="true" />
                  <Input id="song" type="url" maxLength={2048} disabled={pending} value={song}
                    onChange={(e) => { setSong(e.target.value); setSuccess(null) }}
                    className="memory-song-input" placeholder="Pega aquí el enlace de la canción" />
                </div>
              </div>}
            </div>
            <aside className={`memory-writing-ideas memory-writing-${memoryMode}`}>
              <span className="memory-ideas-icon">{memoryMode === "song" ? <Music2 aria-hidden="true"/> : <Heart aria-hidden="true"/>}</span>
              <p>Una pista para empezar</p>
              <h4>{memoryMode === "song" ? "Las canciones guardan momentos." : "No hace falta contarlo todo."}</h4>
              <ul>{(memoryMode === "song" ? ["¿Cuándo la escuchaban?", "¿Quién la elegía?", "¿Qué les hace sentir?"] : ["¿Quién estaba contigo?", "¿Qué detalle recuerdas?", "¿Qué los hizo reír?"]).map(item => <li key={item}>{item}</li>)}</ul>
            </aside>
          </div>

        <div className="memory-feelings flex flex-col gap-2 text-xs text-[#264653]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={positive} disabled={pending} onChange={(e) => setPositive(e.target.checked)} />
            Es un recuerdo bonito
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sensitive} disabled={pending} onChange={(e) => setSensitive(e.target.checked)} />
            Es un tema delicado
          </label>
        </div>

        <div className="memory-save-row">
          <Badge variant="secondary" className="memory-private-badge">
            <Check className="size-3 mr-1" /> Contenido protegido
          </Badge>
          <Button
            onClick={handleSave}
            disabled={pending}
            className="bg-[#2c5f7c] hover:bg-[#244f68] text-white font-bold text-xs px-5 py-2 rounded-xl transition-all"
          >
            {pending ? "Guardando…" : editing ? "Guardar cambios" : memoryMode === "song" ? "Guardar canción" : "Guardar anécdota"}
          </Button>
        </div>

        {editing && <Button variant="outline" disabled={pending} onClick={() => { resetForm(); setError(null); setSuccess(null); setSection("list") }}>Cancelar edición</Button>}
        <div className="memory-utility-actions"><button type="button" disabled={pending} onClick={openProfile}>Perfil y familia <span aria-hidden="true">→</span></button><button type="button" onClick={handleShareWhatsApp}><Users size={16} aria-hidden="true"/> Compartir Ayni por WhatsApp</button></div>
        </div>
      </CardContent>
    </Card>
    </> : <Contributions revision={revision} busy={pending} onAdd={() => setSection("add")} onDeletePhoto={handleDeletePhoto} onEdit={handleEdit} onDelete={handleDelete} />}
    </section>
    {successDialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="memory-saved-title" className="w-full max-w-sm rounded-xl bg-white p-7 text-center shadow-xl"><div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check className="size-7" aria-hidden="true" /></div><h2 id="memory-saved-title" className="mt-4 text-xl font-semibold text-[#2c5f7c]">¡Se guardó correctamente!</h2><p className="mt-2 text-sm text-slate-600">{success}</p><Button autoFocus onClick={() => setSuccessDialog(false)} className="mt-5 w-full bg-[#2c5f7c] hover:bg-[#244f68]">OK</Button></section></div>}
    </div>
  )
}

function PhotoGrid({ photos, canManage, busy, onDelete, onRefresh }: {
  photos: MemoryPhoto[];
  canManage: boolean;
  busy: boolean;
  onDelete?: (photo: MemoryPhoto) => void;
  onRefresh: () => void;
}) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {photos.map((photo) => <figure key={photo.id} className="group relative overflow-hidden rounded-lg">
      <img key={photo.url} src={photo.url} alt="Foto familiar guardada" onError={(event) => {
        event.currentTarget.hidden = true
      }} className="aspect-square w-full object-cover" />
      <figcaption className="flex items-center justify-between gap-2 py-2 text-xs text-slate-600">
        <span className="truncate">Foto familiar</span>
        <button type="button" disabled={busy} onClick={onRefresh} aria-label="Actualizar enlace de foto" className="underline">Actualizar</button>
        {canManage && <button type="button" disabled={busy} onClick={() => onDelete?.(photo)} aria-label="Eliminar foto familiar" className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-red-700"><Trash2 className="size-4" /></button>}
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

export function Contributions({ revision = 0, busy = false, onAdd, onDeletePhoto, onEdit, onDelete }: {
  revision?: number; busy?: boolean;
  onAdd?: () => void;
  onDeletePhoto?: (photo: MemoryPhoto) => void;
  onEdit?: (id: string) => void; onDelete?: (id: string) => void;
}) {
  const [items, setItems] = useState<Memory[]>([])
  const [photos, setPhotos] = useState<Record<string, MemoryPhoto[]>>({})
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
  const [typeFilter, setTypeFilter] = useState<"all" | "anecdote" | "song">("all")
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")

  useEffect(() => {
    let active = true
    setLoading(true); setItems([]); setError(null)
    Promise.all([listMemories({ q: query || undefined, include_sensitive: includeSensitive, limit: 100, offset: page * 100 }), getMe()])
      .then(async ([data, account]) => {
        const photos = await Promise.all(data.items.map(async (memory) =>
          [memory.id, memory.deletion_pending ? [] : await listPhotos(memory.id)] as const))
        if (!active) return
        setItems(data.items); setPhotos(Object.fromEntries(photos)); setTotal(data.total); setUser(account.user); setError(null)
      }).catch((err: unknown) => { if (active) setError(memoryErrorMessage(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision, includeSensitive, page, attempt, query])
  useEffect(() => {
    // Signed links last five minutes; renew while the gallery is mounted.
    const timer = window.setInterval(() => setAttempt((value) => value + 1), 240_000)
    return () => window.clearInterval(timer)
  }, [])
  const visibleItems = useMemo(() => items.filter((memory) => {
    const date = new Date(memory.created_at)
    const now = new Date()
    if (dateRange === "3days" && date < new Date(now.getTime() - 3 * 86400000)) return false
    if (dateRange === "week" && date < new Date(now.getTime() - 7 * 86400000)) return false
    if (dateFrom && date < new Date(`${dateFrom}T00:00:00`)) return false
    if (dateTo && date > new Date(`${dateTo}T23:59:59.999`)) return false
    if (typeFilter !== "all" && memory.type !== typeFilter) return false
    return true
  }).sort((left, right) => (sortOrder === "newest" ? -1 : 1) * (Date.parse(left.created_at) - Date.parse(right.created_at))), [items, dateRange, dateFrom, dateTo, typeFilter, sortOrder])
  const formatMemoryDate = (value: string) => new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value))
  return (
    <section className="memory-collection" aria-labelledby="memory-collection-title">
      <header className="memory-collection-header">
        <div><p className="memory-collection-kicker">HISTORIAS QUE NOS ACERCAN</p><h2 id="memory-collection-title">El álbum de la familia</h2><p>Encuentra una anécdota, una canción o una foto para volver a compartir.</p></div>
        <div className="memory-collection-count"><strong>{loading ? "—" : total}</strong><span>{total === 1 ? "recuerdo" : "recuerdos"}</span></div>
        {onAdd && <Button type="button" onClick={onAdd} className="memory-collection-add"><ImagePlus size={17} aria-hidden="true"/> Agregar recuerdo</Button>}
      </header>

      <div className="memory-filter-area">
        <form className="memory-search-form" role="search" onSubmit={(event) => { event.preventDefault(); setPage(0); setQuery(searchText.trim()) }}>
          <Search size={19} aria-hidden="true"/><label className="sr-only" htmlFor="memory-search">Buscar recuerdos</label>
          <Input id="memory-search" maxLength={100} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Busca por título, persona o lugar" />
          {query && <button type="button" aria-label="Limpiar búsqueda" onClick={() => { setSearchText(""); setQuery(""); setPage(0) }}>×</button>}
          <Button type="submit" aria-label="Buscar"><Search size={17} aria-hidden="true"/><span>Buscar</span></Button>
        </form>
        <div className="memory-filter-row">
          <div className="memory-type-filters" role="group" aria-label="Filtrar por tipo de recuerdo">
            {([{ id: "all", label: "Todos" }, { id: "anecdote", label: "Anécdotas" }, { id: "song", label: "Canciones" }] as const).map(filter => <button key={filter.id} type="button" aria-pressed={typeFilter === filter.id} onClick={() => setTypeFilter(filter.id)}>{filter.label}</button>)}
          </div>
          <label className="memory-date-filter"><CalendarDays size={17} aria-hidden="true"/><span className="sr-only">Filtrar por fecha</span><select aria-label="Filtrar por fecha" value={dateRange} onChange={(event) => setDateRange(event.target.value)}><option value="all">Cualquier fecha</option><option value="3days">Últimos 3 días</option><option value="week">Última semana</option><option value="custom">Elegir fechas</option></select></label>
          <label className="memory-sort-filter"><span>Ordenar:</span><select aria-label="Orden de los recuerdos" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest")}><option value="newest">Más recientes</option><option value="oldest">Más antiguos</option></select></label>
          <label className="memory-sensitive-filter"><input type="checkbox" aria-label="Mostrar temas delicados" checked={includeSensitive} onChange={(e) => { setIncludeSensitive(e.target.checked); setPage(0); setLoading(true) }}/><span>Incluir temas delicados</span></label>
        </div>
        {dateRange === "custom" && <div className="memory-custom-dates"><label>Desde<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)}/></label><label>Hasta<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)}/></label></div>}
      </div>

      {loading && <p role="status" className="memory-list-status">Reuniendo sus recuerdos…</p>}
      {error && <div role="alert" className="memory-list-error"><p>{error}</p><button onClick={() => { setLoading(true); setAttempt((value) => value + 1) }}>Volver a intentar</button></div>}
      {!loading && !error && visibleItems.length === 0 && <div className="memory-empty-state"><span><Heart size={25} aria-hidden="true"/></span><h3>{items.length ? "No hay recuerdos con estos filtros" : query ? "No encontramos recuerdos con esa búsqueda." : "Todavía no hay recuerdos para mostrar."}</h3><p>{items.length ? "Prueba otro periodo o tipo de recuerdo para ampliar la búsqueda." : query ? "Revisa las palabras o intenta buscar por otro título o lugar." : "El álbum empieza con una historia: guarda una anécdota, una canción o una foto para volver a compartirla."}</p>{!items.length && onAdd && <Button type="button" onClick={onAdd} className="memory-collection-add"><ImagePlus size={17} aria-hidden="true"/> Agregar el primer recuerdo</Button>}</div>}
      {!loading && !error && visibleItems.length > 0 && <div className="memory-list-intro"><span>Una colección familiar, a su ritmo</span><span>{visibleItems.length} en esta vista · {total} en total</span></div>}
      {!loading && !error && <div className="memory-collection-list">{visibleItems.map((memory, index) => {
        const canManage = !!user && (user.role === "cuidador_principal" || user.id === memory.created_by);
        const memoryPhotos = photos[memory.id] ?? [];
        return <article key={memory.id} className={`memory-entry memory-entry-${index % 3}`}>
          <div className="memory-entry-rail"><span>{memory.type === "song" ? <Music2 size={20} aria-hidden="true"/> : <FileText size={20} aria-hidden="true"/>}</span><i aria-hidden="true"/></div>
          <div className="memory-entry-body">
            <div className="memory-entry-top"><span className={`memory-kind memory-kind-${memory.type}`}>{memory.type === "song" ? "Canción" : "Anécdota"}</span><time dateTime={memory.created_at}>{formatMemoryDate(memory.created_at)}</time></div>
            <div className="memory-entry-heading"><h3>{memory.title}</h3>{canManage && <div className="memory-entry-actions">{onEdit && <button type="button" disabled={busy || memory.deletion_pending} onClick={() => onEdit(memory.id)} aria-label={`Editar ${memory.title}`}><Pencil size={16}/></button>}{onDelete && <button type="button" disabled={busy} onClick={() => onDelete(memory.id)} aria-label={`Eliminar ${memory.title}`}><Trash2 size={16}/></button>}</div>}</div>
            {memory.deletion_pending && <p role="status" className="memory-pending-note">El borrado quedó pendiente. Puedes volver a intentarlo.</p>}
            {memory.type === "anecdote" ? <p className="memory-entry-text">{memory.text}</p> : <a href={memory.url ?? undefined} target="_blank" rel="noopener noreferrer" className="memory-song-link"><Music2 size={18} aria-hidden="true"/> Escuchar esta canción <span aria-hidden="true">↗</span></a>}
            {memoryPhotos.length > 0 && <div className="memory-entry-photos"><PhotoGrid photos={memoryPhotos} busy={busy} canManage={canManage} onDelete={onDeletePhoto} onRefresh={() => setAttempt((value) => value + 1)} /></div>}
            <div className="memory-entry-tags">{memory.is_positive && <span className="memory-tag memory-tag-warm"><Heart size={13} aria-hidden="true"/> Recuerdo bonito</span>}{memory.is_sensitive && <span className="memory-tag memory-tag-calm">Tema delicado</span>}{memoryPhotos.length > 0 && <span className="memory-tag memory-tag-photo"><ImagePlus size={13} aria-hidden="true"/> {memoryPhotos.length} {memoryPhotos.length === 1 ? "foto" : "fotos"}</span>}</div>
          </div>
        </article>;
      })}</div>}
      {!loading && !error && total > 100 && <nav className="memory-pagination" aria-label="Páginas de recuerdos"><span>Página {page + 1} de {Math.ceil(total / 100)}</span><div><Button size="sm" variant="outline" aria-label="Anterior" disabled={page === 0} onClick={() => { setPage((value) => value - 1); setLoading(true) }}><ChevronLeft size={17}/></Button><Button size="sm" variant="outline" aria-label="Siguiente" disabled={(page + 1) * 100 >= total} onClick={() => { setPage((value) => value + 1); setLoading(true) }}><ChevronRight size={17}/></Button></div></nav>}
    </section>
  )
}
