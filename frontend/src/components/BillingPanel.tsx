import { useEffect, useState } from "react";
import { getMe } from "../api/auth";
import { cancelSubscription, createCheckout, getBillingStatus } from "../api/billing";
import type { BillingStatus } from "../api/billing";
import { ApiError } from "../api/client";
import { Button } from "./ui/button";

interface BillingPanelProps {
  onCheckout?: (url: string) => void;
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

export function BillingPanel({ onCheckout = (url) => window.location.assign(url) }: BillingPanelProps) {
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
    <section aria-labelledby="billing-title" className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="billing-title" className="text-xl font-bold text-[#2c5f7c]">Plan Familia</h2>
        <p className="font-semibold text-[#264653]">S/19.90 al mes</p>
      </div>
      <p className="text-sm text-gray-600">Pagos de prueba. No se realizan cobros reales.</p>
      {returned === "success" && status?.plan !== "family" && <p role="status" className="text-sm text-[#264653]">Estamos verificando el pago. Actualiza el estado en unos momentos.</p>}
      {returned === "cancel" && <p className="text-sm text-gray-600">Saliste del pago de prueba. Puedes revisar tu plan aquí.</p>}
      {loading ? <p role="status" className="text-sm">Consultando el plan...</p> : status && <>
        <p className="font-semibold text-[#264653]">Plan actual: {status.plan === "family" ? "Familia" : "Gratis"}</p>
        <p className="text-sm text-gray-600">{statusMessages[status.subscription_status]}</p>
        {status.paid_until && <p className="text-sm text-gray-600">Periodo pagado hasta el {new Date(status.paid_until).toLocaleDateString("es-PE")}.</p>}
        {status.cancel_at_period_end && <p className="text-sm text-gray-600">La renovación está cancelada. Conservas el periodo pagado.</p>}
        {!caregiver && <p className="text-sm text-gray-600">La persona cuidadora principal gestiona el plan de la familia.</p>}
      </>}
      {error && <p role="alert" data-error-code={error instanceof ApiError ? error.code : undefined} className="text-sm text-red-700">{error.message}</p>}
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
      <div className="flex flex-wrap gap-3">
        {caregiver && canSubscribe && !loading && <Button type="button" disabled={saving} onClick={checkout}>Continuar al pago de prueba</Button>}
        {caregiver && canCancel && !loading && !confirmCancel && <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirmCancel(true)}>Cancelar renovación</Button>}
        <Button type="button" variant="outline" disabled={loading || saving} onClick={refresh}>Actualizar estado</Button>
      </div>
      {confirmCancel && <div className="space-y-3 rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-[#264653]">¿Quieres detener las próximas renovaciones? Conservas el periodo que ya pagaste.</p>
        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={saving} onClick={cancel}>Confirmar cancelación</Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirmCancel(false)}>Volver</Button>
        </div>
      </div>}
    </section>
  );
}
