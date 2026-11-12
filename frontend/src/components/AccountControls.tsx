import { useState, type FormEvent } from "react";
import type { User } from "../api/auth";
import type { GoogleProof } from "../api/account";
import { deleteMyAccount, linkGoogle, updateMyProfile } from "../api/account";
import { SESSION_EXPIRED_EVENT } from "../api/client";
import { Button } from "./ui/button";
import { GoogleSignInButton } from "./GoogleSignInButton";

export function AccountControls({ user, onUpdated }: { user: User; onUpdated?: (user: User) => void }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [city, setCity] = useState(user.city ?? "");
  const [district, setDistrict] = useState(user.district ?? "");
  const [busy, setBusy] = useState<"profile" | "link" | "delete" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [googlePassword, setGooglePassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const wholeFamily = user.role === "cuidador_principal";
  const inputClass = "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm";

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (!name.trim() || Array.from(name.trim()).length > 100 || Array.from(city.trim()).length > 100 || Array.from(district.trim()).length > 100 || (phone.trim() && !/^\+?[0-9][0-9 ()-]{5,29}$/.test(phone.trim()))) {
      setError("Revisa el nombre, teléfono, ciudad y distrito antes de guardar."); return;
    }
    setBusy("profile");
    try {
      const result = await updateMyProfile({ name: name.trim(), phone: phone.trim() || null, city: city.trim() || null, district: district.trim() || null });
      onUpdated?.(result.user); setMessage("Tus datos se guardaron correctamente.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No pudimos guardar tus datos."); }
    finally { setBusy(null); }
  }

  async function connectGoogle(proof: GoogleProof) {
    if (Array.from(googlePassword).length < 10 || busy) return;
    setBusy("link"); setError(""); setMessage("");
    try { await linkGoogle(proof, googlePassword); setGooglePassword(""); setMessage("Tu cuenta de Google quedó vinculada."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No pudimos vincular Google."); }
    finally { setBusy(null); }
  }

  async function removeAccount(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (!acknowledged || confirmation !== "ELIMINAR" || Array.from(deletePassword).length < 10 || busy) {
      setError("Confirma el alcance, escribe ELIMINAR e ingresa tu contraseña."); return;
    }
    setBusy("delete");
    try {
      await deleteMyAccount(deletePassword, confirmation);
      setDeletePassword(""); sessionStorage.setItem("ayni_account_deleted", "1");
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos completar el borrado. Inténtalo de nuevo.");
    } finally { setBusy(null); }
  }

  return <div className="space-y-8 border-t border-slate-200 pt-6">
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="text-sm text-[#235c50]">{message}</p>}
    <form onSubmit={(event) => { void saveProfile(event); }} className="space-y-4" aria-label="Editar mis datos">
      <h2 className="text-lg font-semibold text-[#235c50]">Editar mis datos</h2>
      <fieldset disabled={Boolean(busy)} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-[#223e38]">Nombre de tu cuenta<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} autoComplete="name" /></label>
        <label className="text-sm font-medium text-[#223e38]">Teléfono de contacto<input type="tel" value={phone} maxLength={30} onChange={(event) => setPhone(event.target.value)} className={inputClass} autoComplete="tel" /></label>
        <label className="text-sm font-medium text-[#223e38]">Ciudad de residencia<input value={city} maxLength={100} onChange={(event) => setCity(event.target.value)} className={inputClass} autoComplete="address-level2" /></label>
        <label className="text-sm font-medium text-[#223e38]">Distrito de residencia<input value={district} maxLength={100} onChange={(event) => setDistrict(event.target.value)} className={inputClass} autoComplete="address-level3" /></label>
      </fieldset>
      <Button type="submit" variant="secondary" disabled={Boolean(busy)} className="w-auto">{busy === "profile" ? "Guardando datos…" : "Guardar mis datos"}</Button>
    </form>
    <section className="space-y-3 border-t border-slate-200 pt-5" aria-label="Vincular Google">
      <h2 className="text-lg font-semibold text-[#235c50]">Vincular Google</h2>
      <p className="text-sm text-slate-600">Puedes usar Google para acceder a esta misma cuenta. Primero escribe tu contraseña de Ayni y luego elige en Google el mismo correo: {user.email}.</p>
      <label className="block text-sm font-medium text-[#223e38]">Contraseña para vincular Google<input type="password" autoComplete="current-password" minLength={10} value={googlePassword} disabled={Boolean(busy)} onChange={(event) => setGooglePassword(event.target.value)} className={inputClass} /></label>
      <GoogleSignInButton disabled={Boolean(busy) || Array.from(googlePassword).length < 10} onCredential={(proof) => { void connectGoogle(proof); }} />
    </section>
    <section className="space-y-3 border-t border-slate-200 pt-5" aria-label="Eliminar cuenta">
      <h2 className="text-lg font-semibold text-[#235c50]">Eliminar cuenta</h2>
      {!deleteOpen ? <Button variant="outline" className="w-auto" disabled={Boolean(busy)} onClick={() => setDeleteOpen(true)}>Revisar eliminación de cuenta</Button> : <form onSubmit={(event) => { void removeAccount(event); }} className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-700">{wholeFamily ? "Se eliminarán toda tu familia, las cuentas de sus integrantes, el perfil, recuerdos, fotos, guías y reacciones. También se cerrará el cliente de pagos de prueba y se cancelarán sus suscripciones. Esta acción no se puede deshacer." : "Se eliminarán tu cuenta, tus recuerdos y las fotos correspondientes. Los demás integrantes conservarán su cuenta y sus recuerdos. Las guías y reacciones compartidas se conservarán sin tu identificación como autor. Esta acción no se puede deshacer."}</p>
        <fieldset disabled={Boolean(busy)} className="space-y-3">
          <label className="flex items-start gap-2 text-sm text-[#223e38]"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1" /><span>Entiendo qué datos se eliminarán y que la acción no se puede deshacer.</span></label>
          <label className="block text-sm font-medium text-[#223e38]">Escribe ELIMINAR<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={inputClass} autoComplete="off" /></label>
          <label className="block text-sm font-medium text-[#223e38]">Contraseña para eliminar la cuenta<input type="password" autoComplete="current-password" minLength={10} value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} className={inputClass} /></label>
        </fieldset>
        <p className="text-xs text-slate-500">Si el borrado no se completa, conservaremos la solicitud para que puedas volver a confirmarla. No se mostrará éxito hasta recibir la confirmación del servidor.</p>
        <div className="flex flex-wrap gap-3"><Button type="submit" variant="secondary" disabled={Boolean(busy) || !acknowledged || confirmation !== "ELIMINAR" || Array.from(deletePassword).length < 10} className="w-auto">{busy === "delete" ? "Eliminando cuenta…" : "Confirmar eliminación"}</Button><Button type="button" variant="outline" className="w-auto" disabled={Boolean(busy)} onClick={() => { setDeleteOpen(false); setDeletePassword(""); setConfirmation(""); setAcknowledged(false); }}>Cancelar</Button></div>
      </form>}
    </section>
  </div>;
}
