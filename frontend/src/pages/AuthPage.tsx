import React, { useState } from "react";
import { Heart, ArrowLeft, Mail, Lock, Users, ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";
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
      if (!firstName.trim() || !lastName.trim() ||
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
    <div className="min-h-screen bg-white flex flex-col text-[#264653]">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
        <button
          onClick={onBack}
          className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#2c5f7c] hover:underline"
        >
          <ArrowLeft className="size-4" /> Volver al inicio
        </button>

        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-[#2c5f7c] text-white shadow-xs">
            <Heart className="size-4 fill-current text-[#b94c35]" />
          </div>
          <span className="font-extrabold text-[#2c5f7c] text-sm">Ayni Digital</span>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-7 px-4 pb-8 sm:px-8 lg:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)] lg:items-start lg:gap-14">
        <section className="order-2 mx-auto w-full max-w-xl lg:order-1">
          <div className="mb-7 max-w-lg">
            <p className="text-sm font-semibold text-[#b94c35]">
              {mode === "register" ? "Un espacio para tus recuerdos" : "Tu espacio familiar te espera"}
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-[#2c5f7c] sm:text-4xl">
              {mode === "register" ? "Crea tu espacio en familia" : "Qué bueno verte de nuevo"}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-gray-600">
              {mode === "register"
                ? "Reúnan fotos, anécdotas y canciones para compartir conversaciones con calma."
                : "Ingresa para continuar compartiendo recuerdos y acompañar a tu familia."}
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-6 border-b border-gray-200">
              <button
                type="button"
                onClick={() => { reloadConsent(); setMode("register"); setError(null); setNotice(null); }}
                disabled={loading}
                aria-pressed={mode === "register"}
                className={`min-h-11 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
                  mode === "register"
                    ? "border-[#b94c35] text-[#2c5f7c]"
                    : "border-transparent text-gray-500 hover:text-[#264653]"
                }`}
              >
                Crear cuenta
              </button>
              <button
                type="button"
                onClick={() => { setMode("login"); setError(null); setNotice(null); }}
                disabled={loading}
                aria-pressed={mode === "login"}
                className={`min-h-11 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
                  mode === "login"
                    ? "border-[#b94c35] text-[#2c5f7c]"
                    : "border-transparent text-gray-500 hover:text-[#264653]"
                }`}
              >
                Iniciar sesión
              </button>
            </div>

            {notice && <p role="status" className="text-xs text-gray-500">{notice}</p>}
            {error && (
              <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 space-y-2">
                <p className="font-semibold">{error}</p>
              </div>
            )}

            {mode === "login" && <details className="text-sm text-[#264653]"><summary className="min-h-11 cursor-pointer py-3 font-semibold">¿No puedes entrar?</summary><p>Comprueba tu correo y contraseña. La recuperación de contraseña todavía no está disponible.</p></details>}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><label htmlFor="auth-first-name" className="text-xs font-bold text-[#264653]">Nombre</label><Input id="auth-first-name" required autoComplete="given-name" maxLength={60} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ej. María" className="text-sm" /></div>
                    <div className="space-y-1"><label htmlFor="auth-last-name" className="text-xs font-bold text-[#264653]">Apellido</label><Input id="auth-last-name" required autoComplete="family-name" maxLength={60} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ej. Martínez" className="text-sm" /></div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="auth-registration-mode" className="text-xs font-bold text-[#264653]">¿Cómo vas a participar?</label>
                    <select
                      id="auth-registration-mode"
                      value={registrationMode}
                      onChange={(e) => setRegistrationMode(e.target.value as "family" | "invitation")}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs"
                    >
                      <option value="family">Crear y gestionar mi familia</option>
                      <option value="invitation">Unirme con una invitación</option>
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
                    autoComplete="email"
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
                className="w-full bg-[#b94c35] hover:bg-[#9e3f2c] text-white font-bold text-xs py-3 rounded-lg shadow-xs transition-all mt-2"
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
              <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-1">
                <ShieldCheck className="size-4 text-[#2c5f7c] shrink-0" />
                <span>Los recuerdos de tu cuenta se consultan dentro de tu familia. Las fotos se guardan solo en este navegador.</span>
              </div>
            </div>
          </div>
        </section>

        <aside aria-label="Ayni acompaña los recuerdos familiares" className="order-1 relative h-44 overflow-hidden rounded-xl bg-[#17232d] sm:h-56 lg:sticky lg:top-8 lg:order-2 lg:h-[min(72vh,620px)] lg:min-h-[480px]">
          <img src="/images/familia-participa.jpg" alt="Una familia comparte recuerdos con una persona mayor" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#17232d]/25" />
          <div className="absolute inset-x-0 bottom-0 bg-[#17232d]/80 px-5 py-4 text-white sm:px-7 sm:py-6">
            <p className="text-base font-semibold leading-snug sm:text-xl">Cada historia merece su espacio.</p>
            <p className="mt-1 max-w-lg text-sm leading-relaxed text-white/85">Compartan fotos, canciones y momentos importantes, cada quien desde donde esté.</p>
          </div>
        </aside>
      </main>

      <footer className="border-t border-gray-100 px-4 py-4 text-center text-xs text-gray-500 sm:px-8">
        <p>© 2026 Ayni Digital · Recuerdos que nos acercan</p>
      </footer>
    </div>
  );
};
