import React, { useState } from "react";
import { Heart, ArrowLeft, Mail, Lock, Users, ShieldCheck, Loader2, Phone, Eye, EyeOff } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getConsent, login, register } from "../api/auth";
import type { ConsentText, RegisterPayload, User as UserType } from "../api/auth";
import { ApiError } from "../api/client";

interface AuthPageProps {
  initialMode?: "login" | "register";
  onBack: () => void;
  onSuccess: (user: UserType) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = "register",
  onBack,
  onSuccess,
}) => {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [registrationMode, setRegistrationMode] = useState<"family" | "invitation">("family");
  const [invitationToken, setInvitationToken] = useState("");
  const [consent, setConsent] = useState<ConsentText | null>(null);
  const [consentLoading, setConsentLoading] = useState(initialMode === "register");
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentAttempt, setConsentAttempt] = useState(0);
  const [hasConsented, setHasConsented] = useState(false);
  const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reloadConsent = () => {
    setConsent(null);
    setHasConsented(false);
    setHasAcceptedPrivacy(false);
    setConsentLoading(true);
    setConsentError(null);
    setConsentAttempt((attempt) => attempt + 1);
  };

  React.useEffect(() => {
    if (mode !== "register") return;
    let active = true;
    getConsent().then((data) => {
      if (active) setConsent(data);
    }).catch((err: unknown) => {
      if (active) setConsentError(
        err instanceof Error ? err.message : "No pudimos cargar el consentimiento. Inténtalo de nuevo."
      );
    }).finally(() => {
      if (active) setConsentLoading(false);
    });
    return () => { active = false; };
  }, [mode, consentAttempt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (Array.from(password).length < 10) {
      setError("La contraseña debe tener al menos 10 caracteres.");
      return;
    }
    if (mode === "register") {
      if (!firstName.trim() || !lastName.trim() || !phone.trim() || !city.trim() || !district.trim() ||
        (registrationMode === "family" ? !familyName.trim() : !invitationToken.trim())) {
        setError("Completa todos los campos obligatorios para crear tu cuenta.");
        return;
      }
      if (!consent || consentLoading || !hasConsented || !hasAcceptedPrivacy) {
        setError("Lee y acepta el consentimiento y el tratamiento de datos personales para continuar.");
        return;
      }
    }
    setLoading(true);

    try {
      if (mode === "register" && consent) {
        const data: RegisterPayload = {
          email, password, name: `${firstName.trim()} ${lastName.trim()}`,
          consent: { accepted: true, text_version: consent.text_version },
          ...(registrationMode === "family"
            ? { family_name: familyName.trim() }
            : { invitation_token: invitationToken.trim() }),
        };
        await register(data);
        // If login fails, the next attempt must not register the account again.
        setMode("login");
        setNotice("Tu cuenta ya está creada. Inicia sesión para continuar.");
      }
      const response = await login({ email, password });

      setPassword("");
      onSuccess(response.user);
    } catch (err) {
      if (err instanceof ApiError && err.code === "consent_version_invalid") {
        reloadConsent();
      }
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("No pudimos iniciar sesión. Inténtalo de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between p-4 sm:p-8 text-[#264653]">
      <div className="mx-auto max-w-5xl w-full flex items-center justify-between pb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#2c5f7c] hover:underline"
        >
          <ArrowLeft className="size-4" /> Volver al inicio
        </button>

        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-[#2c5f7c] text-white shadow-sm">
            <Heart className="size-4 fill-current text-[#e76f51]" />
          </div>
          <span className="font-extrabold text-[#2c5f7c] text-sm">Ayni Digital</span>
        </div>
      </div>

      <div className="mx-auto max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-[0_12px_40px_rgba(38,70,83,0.08)] p-5 sm:p-8 space-y-6">
        <div className="flex rounded-lg bg-gray-50 p-1 border border-gray-200">
          <button
            type="button"
            onClick={() => { reloadConsent(); setMode("register"); setError(null); setNotice(null); }}
            disabled={loading}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === "register"
                ? "bg-[#2c5f7c] text-white shadow-sm"
                : "text-gray-500 hover:text-[#264653]"
            }`}
          >
                Crear cuenta
          </button>
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); setNotice(null); }}
            disabled={loading}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === "login"
                ? "bg-[#2c5f7c] text-white shadow-sm"
                : "text-gray-500 hover:text-[#264653]"
            }`}
          >
            Iniciar Sesión
          </button>
        </div>

        <div>
          <h2 className="text-xl font-extrabold text-[#2c5f7c]">
            {mode === "register" ? "Crear tu cuenta" : "Bienvenido de nuevo"}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {mode === "register"
              ? "Registra tu grupo familiar para empezar a subir recuerdos."
              : "Ingresa tus credenciales para acceder a tus sesiones."}
          </p>
        </div>

        {notice && <p role="status" className="text-xs text-gray-500">{notice}</p>}
        {error && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 space-y-2">
            <p className="font-semibold">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><label htmlFor="auth-first-name" className="text-xs font-bold text-[#264653]">Nombre</label><Input id="auth-first-name" required autoComplete="given-name" maxLength={60} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ej. María" className="text-sm" /></div>
                <div className="space-y-1"><label htmlFor="auth-last-name" className="text-xs font-bold text-[#264653]">Apellido</label><Input id="auth-last-name" required autoComplete="family-name" maxLength={60} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ej. Martínez" className="text-sm" /></div>
              </div>

              <div className="space-y-1">
                <label htmlFor="auth-phone" className="text-xs font-bold text-[#264653]">Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 size-4 text-gray-400" />
                  <Input
                    id="auth-phone"
                    type="tel"
                    required
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={20}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+51 987 654 321"
                    className="pl-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><label htmlFor="auth-city" className="text-xs font-bold text-[#264653]">Ciudad</label><Input id="auth-city" required autoComplete="address-level2" maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ej. Lima" className="text-sm"/></div>
                <div className="space-y-1"><label htmlFor="auth-district" className="text-xs font-bold text-[#264653]">Distrito</label><Input id="auth-district" required autoComplete="address-level3" maxLength={80} value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Ej. Surco" className="text-sm"/></div>
              </div>

              <div className="space-y-1">
                <label htmlFor="auth-registration-mode" className="text-xs font-bold text-[#264653]">Selecciona tu rol</label>
                <select
                  id="auth-registration-mode"
                  value={registrationMode}
                  onChange={(e) => setRegistrationMode(e.target.value as "family" | "invitation")}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs"
                >
                  <option value="family">Cuidador principal (hijo/a, cónyuge)</option>
                  <option value="invitation">Familiar colaborador (nieto/a, hermano/a)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="auth-family" className="text-xs font-bold text-[#264653]">
                  {registrationMode === "family" ? "Nombre del grupo familiar" : "Código de invitación"}
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 size-4 text-gray-400" />
                  <Input
                    id="auth-family"
                    required
                    maxLength={registrationMode === "family" ? 100 : undefined}
                    value={registrationMode === "family" ? familyName : invitationToken}
                    onChange={(e) => registrationMode === "family"
                      ? setFamilyName(e.target.value) : setInvitationToken(e.target.value)}
                    placeholder={registrationMode === "family" ? "Ej. Familia Martínez" : "Pega el código que te compartieron"}
                    className="pl-9 text-xs"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label htmlFor="auth-email" className="text-xs font-bold text-[#264653]">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 size-4 text-gray-400" />
              <Input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="pl-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="auth-password" className="text-xs font-bold text-[#264653]">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 size-4 text-gray-400" />
              <Input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={10}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                aria-describedby="auth-password-help"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9 pr-11 text-sm"
              />
              <button type="button" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-[#2c5f7c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2c5f7c]">
                {showPassword ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}
              </button>
            </div>
            <p id="auth-password-help" className="text-xs text-gray-500">Usa al menos 10 caracteres.</p>
          </div>

          {mode === "register" && (
            <div className="space-y-3 text-xs text-gray-500">
              {consentLoading && <p role="status">Cargando consentimiento...</p>}
              {consentError && (
                <div role="alert">
                  <p>{consentError}</p>
                  <button type="button" className="underline" onClick={reloadConsent}>
                    Volver a cargar el consentimiento
                  </button>
                </div>
              )}
              {consent && (
                <>
                  <p>{consent.onboarding_notice}</p>
                  <p>{consent.text}</p>
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={hasConsented} onChange={(e) => setHasConsented(e.target.checked)} required />
                    <span>Acepto el consentimiento mostrado (versión {consent.text_version}).</span>
                  </label>
                  <label className="flex items-start gap-2 rounded-xl border border-gray-200 p-3 text-[#264653]">
                    <input type="checkbox" checked={hasAcceptedPrivacy} onChange={(e) => setHasAcceptedPrivacy(e.target.checked)} required className="mt-0.5 accent-[#2c5f7c]" />
                    <span>Acepto el tratamiento de mis datos personales conforme a la Ley N.° 29733. Entiendo que Ayni Digital no es una herramienta médica ni emite diagnósticos clínicos.</span>
                  </label>
                </>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || (mode === "register" && (consentLoading || !consent || !hasConsented || !hasAcceptedPrivacy))}
            className="w-full bg-[#e76f51] hover:bg-[#d65d3f] text-white font-bold text-xs py-3 rounded-lg shadow-sm transition-all mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Procesando...
              </span>
            ) : mode === "register" ? (
              "Crear cuenta"
            ) : (
              "Ingresar a Ayni Digital"
            )}
          </Button>
        </form>

        <div className="pt-2 border-t border-gray-100 flex flex-col gap-3">
          <button type="button" disabled title="El acceso con Google requiere configuración del backend" className="flex min-h-11 w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-500 disabled:cursor-not-allowed"><span aria-hidden="true" className="text-base font-bold">G</span>Continuar con Google · Próximamente</button>
          <p className="text-center text-xs text-gray-500">El acceso con Google todavía necesita integración del equipo backend.</p>
          <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-1">
            <ShieldCheck className="size-4 text-[#2c5f7c] shrink-0" />
            <span>Tus datos y archivos familiares están protegidos de forma privada.</span>
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-gray-400 py-4">
        © 2026 Ayni Digital • Acompañamiento familiar por reminiscencia
      </footer>
    </div>
  );
};
