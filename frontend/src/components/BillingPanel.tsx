import { useEffect, useState } from "react";
import { getMe } from "../api/auth";
import { cancelSubscription, createCheckout, getBillingStatus } from "../api/billing";
import type { BillingStatus } from "../api/billing";
import { ApiError } from "../api/client";
import { Button } from "./ui/button";

interface BillingPanelProps {
  onCheckout?: (url: string) => void;
  embedded?: boolean;
}

const statusMessages: Record<BillingStatus["subscription_status"], string> = {
  none: "Todavía usas el plan gratis.",
  incomplete: "El pago está pendiente de completar.",
  incomplete_expired: "El intento de pago venció. Puedes iniciar otro.",
  trialing: "La suscripción está pendiente de confirmar un pago.",
  active: "Tu suscripción está activa.",
  past_due: "No se pudo completar la renovación.",
  canceled: "Tu suscripción terminó.",
  unpaid: "No hay un pago confirmado para este periodo.",
  paused: "La suscripción está en pausa.",
};

export function BillingPanel({ onCheckout = (url) => window.location.assign(url), embedded = false }: BillingPanelProps) {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [caregiver, setCaregiver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getBillingStatus(), getMe()]).then(([plan, account]) => {
      if (!active) return;
      setStatus(plan);
      setCaregiver(account.user.role === "cuidador_principal");
      setError(null);
    }).catch((err: unknown) => {
      if (active) setError(err instanceof Error ? err : new Error("No pudimos consultar el plan."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  function refresh() {
    setLoading(true);
    setAttempt((value) => value + 1);
  }

  async function checkout() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const link = await createCheckout();
      const url = new URL(link.checkout_url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.username || url.password) {
        throw new Error("No pudimos abrir el pago de prueba. Inténtalo de nuevo.");
      }
      sessionStorage.setItem("ayni_checkout_return", "settings:plan");
      onCheckout(url.href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error("No pudimos iniciar el pago de prueba."));
    } finally { setSaving(false); }
  }

  async function cancel() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await cancelSubscription();
      setStatus(updated);
      setConfirmCancel(false);
      setNotice("La renovación está cancelada. Conservas el periodo que ya pagaste.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error("No pudimos cancelar la renovación."));
    } finally { setSaving(false); }
  }

  const canSubscribe = status && ["none", "canceled", "incomplete_expired"].includes(status.subscription_status);
  const canCancel = status && !canSubscribe && !status.cancel_at_period_end;
  const returned = new URLSearchParams(window.location.search).get("billing");

  return (
    <section id="billing-panel" aria-labelledby="billing-title" className={embedded ? "space-y-6 py-1 text-[#264653]" : "relative left-1/2 w-screen -translate-x-1/2 scroll-mt-20 bg-[#17232d] px-4 py-10 text-white sm:px-8 sm:py-14"}>
      <div className={embedded ? "flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between" : "mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between"}>
        <div className="max-w-2xl space-y-3">
          <p className={`text-sm font-semibold ${embedded ? "text-[#e76f51]" : "text-[#e9c46a]"}`}>Plan suscrito</p>
          <h2 id="billing-title" className={`text-2xl font-semibold ${embedded ? "text-[#2c5f7c]" : "text-white sm:text-3xl"}`}>Plan Familia</h2>
          <p className={`text-sm leading-relaxed ${embedded ? "text-slate-600" : "text-white/75"}`}>El Plan Familia reúne herramientas para organizar recuerdos y acompañar conversaciones en casa.</p>
          <ul className={`space-y-2 text-sm leading-relaxed ${embedded ? "text-slate-600" : "text-white/80"}`}>
            <li>• Espacio para reunir fotos, anécdotas y canciones significativas.</li>
            <li>• Guía de conversación de aproximadamente 15 minutos, que pueden pausar o terminar.</li>
            <li>• Un momento para conversar sobre cómo se sintió cada persona al finalizar.</li>
          </ul>
          {loading ? <p role="status" className="text-sm text-slate-500">Consultando el plan...</p> : status && <p className="text-sm text-slate-600">Plan actual: <strong className="text-[#264653]">{status.plan === "family" ? "Familia" : "Gratis"}</strong>. {statusMessages[status.subscription_status]}</p>}
          {status?.paid_until && <p className="text-sm text-slate-600">Periodo pagado hasta el {new Date(status.paid_until).toLocaleDateString("es-PE")}.</p>}
          {status?.cancel_at_period_end && <p className="text-sm text-slate-600">La renovación está cancelada. Conservas el periodo pagado.</p>}
          {!caregiver && status && <p className="text-sm text-slate-600">La persona cuidadora principal gestiona el plan de la familia.</p>}
          {returned === "success" && status?.plan !== "family" && <p role="status" className="text-sm text-slate-600">Estamos verificando el pago. Actualiza el estado en unos momentos.</p>}
          {returned === "cancel" && <p className="text-sm text-slate-600">Saliste del pago de prueba. Puedes revisar tu plan aquí.</p>}
          {error && <p role="alert" data-error-code={error instanceof ApiError ? error.code : undefined} className="text-sm text-red-700">{error.message}</p>}
          {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
        </div>
        <div className={embedded ? "flex shrink-0 flex-col items-start gap-3 lg:min-w-56 lg:items-end" : "flex shrink-0 flex-col items-start gap-4 sm:items-end"}>
          <p className={`text-3xl font-bold ${embedded ? "text-[#2c5f7c]" : "text-white sm:text-4xl"}`}>S/ 19.90 <span className={`text-base font-medium ${embedded ? "text-slate-500" : "text-white/70"}`}>al mes</span></p>
          {caregiver && canSubscribe && !loading && <Button type="button" variant="secondary" disabled={saving} onClick={checkout} className="w-auto min-h-11 px-5 text-sm">{saving ? "Abriendo pago..." : status?.subscription_status === "canceled" ? "Renovar suscripción" : status?.subscription_status === "incomplete_expired" ? "Reintentar pago" : "Suscribirme"}</Button>}
          {caregiver && !loading && !confirmCancel && (canCancel
            ? <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirmCancel(true)} className={embedded ? "w-auto border-slate-300 bg-white text-[#2c5f7c] hover:bg-slate-50" : "w-auto border-white/40 bg-transparent text-white hover:bg-white/10"}>Cancelar suscripción</Button>
            : <Button type="button" variant="outline" disabled title="No hay una suscripción activa para cancelar" className={embedded ? "w-auto border-slate-200 bg-slate-50 text-slate-400" : "w-auto border-white/20 bg-transparent text-white/50"}>Cancelar suscripción</Button>)}
          <Button type="button" variant="outline" disabled={loading || saving} onClick={refresh} className={embedded ? "w-auto border-slate-300 bg-white text-[#2c5f7c] hover:bg-slate-50" : "w-auto border-white/40 bg-transparent text-white hover:bg-white/10"}>Actualizar estado</Button>
          <p className={`max-w-xs text-xs ${embedded ? "text-slate-500 lg:text-right" : "text-white/60 sm:text-right"}`}>Los pagos están en modo de prueba y todavía no se realizan cobros reales.</p>
        </div>
      </div>
      {confirmCancel && <div className={`mt-6 space-y-3 pt-5 ${embedded ? "border-t border-slate-200" : "mx-auto max-w-7xl border-t border-white/20"}`}>
        <p className={`text-sm ${embedded ? "text-[#264653]" : "text-white"}`}>¿Quieres detener las próximas renovaciones? Conservas el periodo que ya pagaste.</p>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="destructive" disabled={saving} onClick={cancel} className="w-auto">Confirmar cancelación</Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirmCancel(false)} className={embedded ? "w-auto border-slate-300 bg-white text-[#2c5f7c] hover:bg-slate-50" : "w-auto border-white/40 bg-transparent text-white hover:bg-white/10"}>Volver</Button>
        </div>
      </div>}
    </section>
  );
}
