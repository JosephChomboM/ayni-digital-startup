import React, { useRef, useState } from "react";
import { ArrowLeft, Mail, Lock, Users, ShieldCheck, Loader2, Phone, Eye, EyeOff } from "lucide-react";
import { Brand } from "../components/Brand";
import { AyniCompanion } from "../components/AyniCompanion";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getConsent, login, register } from "../api/auth";
import type { ConsentText, RegisterPayload, User as UserType } from "../api/auth";
import { ApiError } from "../api/client";
import { loginWithGoogle, registerWithGoogle, updateMyProfile, linkGoogle } from "../api/account";
import type { GoogleProof } from "../api/account";
import { GoogleSignInButton } from "../components/GoogleSignInButton";

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
  const [googleLinkProof, setGoogleLinkProof] = useState<GoogleProof | null>(null);
  const feedback = React.useRef<HTMLDivElement>(null);
  const [googleProof, setGoogleProof] = useState<GoogleProof | null>(null);
  const [profilePendingUser, setProfilePendingUser] = useState<UserType | null>(null);

  const [email, setEmail] = useState("");
  const emailInput = useRef<HTMLInputElement>(null);
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
  const [notice, setNotice] = useState<string | null>(() => sessionStorage.getItem("ayni_account_deleted") === "1" ? "Tu cuenta y los datos correspondientes se eliminaron correctamente." : null);
  React.useEffect(() => { sessionStorage.removeItem("ayni_account_deleted"); }, []);

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

  React.useEffect(() => {
    if (!error && !notice && !googleLinkProof) return;
    feedback.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    feedback.current?.focus();
  }, [error, notice, googleLinkProof]);

  const handleGoogle = async (proof: GoogleProof) => {
    setLoading(true); setError(null); setProfilePendingUser(null); setGoogleLinkProof(null);
    try {
      const response = await loginWithGoogle(proof);
      onSuccess(response.user);
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "google_account_not_registered") {
        setGoogleProof(proof); setMode("register"); reloadConsent();
        setNotice("Completa tus datos, elige una contraseña de Ayni y acepta el consentimiento para crear tu cuenta con Google.");
      } else if (reason instanceof ApiError && reason.code === "google_link_required") {
        setGoogleProof(null); setGoogleLinkProof(proof); setMode("login");
        setNotice("Google te reconoció. Tu cuenta de Ayni todavía usa contraseña. Ingresa tu correo y contraseña de Ayni una sola vez para vincular Google y entrar.");
      } else {
        setGoogleProof(null);
        setError(reason instanceof Error ? reason.message : "No pudimos continuar con Google.");
      }
    } finally { setLoading(false); }
  };

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
      if (registrationMode === "family" && familyName.trim() === password.trim()) {
        setError("El nombre del grupo familiar debe ser distinto de tu contraseña.");
        return;
      }
      if (!/^\+?[0-9][0-9 ()-]{5,29}$/.test(phone.trim()) || Array.from(city.trim()).length > 100 || Array.from(district.trim()).length > 100) {
        setError("Revisa tu teléfono y usa hasta 100 caracteres para ciudad y distrito.");
        return;
      }
      if (!consent || consentLoading || !hasConsented || !hasAcceptedPrivacy) {
        setError("Lee y acepta el consentimiento y el tratamiento de datos personales para continuar.");
        return;
      }
    }
    setLoading(true);

    try {
      let loginEmail = email;
      let registered = false;
      if (mode === "register" && consent) {
        const data: RegisterPayload = {
          email, password, name: `${firstName.trim()} ${lastName.trim()}`,
          consent: { accepted: true, text_version: consent.text_version },
          ...(registrationMode === "family"
            ? { family_name: familyName.trim() }
            : { invitation_token: invitationToken.trim() }),
        };
        if (googleProof) {
          const created = await registerWithGoogle({
            ...googleProof, password, name: data.name, consent: data.consent,
            ...(registrationMode === "family" ? { family_name: familyName.trim() } : { invitation_token: invitationToken.trim() }),
          });
          loginEmail = created.user.email; setEmail(loginEmail); setGoogleProof(null);
        } else await register(data);
        registered = true;
        // If login fails, the next attempt must not register the account again.
        setMode("login");
        setNotice("Tu cuenta ya está creada. Inicia sesión para continuar.");
      }
      const response = await login({ email: loginEmail, password });

      if (googleLinkProof) {
        await linkGoogle(googleLinkProof, password);
        setGoogleLinkProof(null);
      }
      setPassword("");
      if (registered) {
        try {
          const profile = await updateMyProfile({ phone: phone.trim(), city: city.trim(), district: district.trim() });
          onSuccess(profile.user);
        } catch (reason) {
          if (reason instanceof ApiError && reason.status === 401) throw reason;
          setProfilePendingUser(response.user);
          setError("Tu cuenta está creada, pero no pudimos guardar tus datos de contacto. Puedes completarlos desde Mi cuenta.");
        }
        return;
      }
      onSuccess(response.user);
    } catch (err) {
      if (err instanceof ApiError && ["invalid_google_challenge", "invalid_google_credential"].includes(err.code)) {
        setGoogleProof(null); setGoogleLinkProof(null);
        setNotice("La verificación de Google venció. Pulsa Continuar con Google otra vez; conservamos los datos que escribiste.");
      }
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
    <div className="auth-page min-h-screen flex flex-col">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
        <button
          onClick={onBack}
          className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#2c5f7c] hover:underline"
        >
          <ArrowLeft className="size-4" /> Volver al inicio
        </button>

        <div className="flex items-center gap-4">
          <Brand />
          {mode === "login" && <div className="auth-login-companion hidden items-center gap-3 sm:flex">
            <span className="auth-login-companion-avatar"><AyniCompanion decorative /></span>
            <span className="max-w-40 text-xs leading-snug text-[#435d60]">Ayni te espera para compartir un recuerdo, a tu ritmo.</span>
            <Button type="button" variant="outline" className="min-h-10 whitespace-nowrap border-[#c6d9d5] text-[#2c5f7c]" onClick={() => emailInput.current?.focus()}>
              Empezar juntos
            </Button>
          </div>}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-7 px-4 pb-8 sm:px-8 lg:grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)] lg:items-start lg:gap-14">
        <section className="auth-form order-1 mx-auto w-full max-w-xl">
          <div className="mb-7 max-w-lg">
            <p className="text-sm font-semibold text-[#e76f51]">
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
                onClick={() => { setGoogleLinkProof(null); setGoogleProof(null); reloadConsent(); setMode("register"); setError(null); setNotice(null); }}
                disabled={loading}
                className={`border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
                  mode === "register"
                    ? "border-[#e76f51] text-[#2c5f7c]"
                    : "border-transparent text-gray-500 hover:text-[#264653]"
                }`}
              >
                Crear cuenta
              </button>
              <button
                type="button"
                onClick={() => { setGoogleLinkProof(null); setGoogleProof(null); setMode("login"); setError(null); setNotice(null); }}
                disabled={loading}
                className={`border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
                  mode === "login"
                    ? "border-[#e76f51] text-[#2c5f7c]"
                    : "border-transparent text-gray-500 hover:text-[#264653]"
                }`}
              >
                Iniciar sesión
              </button>
            </div>

            <div ref={feedback} tabIndex={-1} className="focus:outline-none">
              {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-[#264653]">{notice}</p>}
              {googleProof && <p className="mt-2 font-semibold">Google verificado · Paso 2: completa el registro para guardar tu cuenta.</p>}
            </div>
            {profilePendingUser && <Button type="button" onClick={() => onSuccess(profilePendingUser)}>Continuar y completar mis datos después</Button>}
            {googleProof && <p className="text-sm text-slate-600">Usaremos el correo de tu cuenta de Google. <button type="button" className="font-semibold underline" onClick={() => { setGoogleProof(null); setNotice(null); }}>Usar correo y contraseña</button></p>}
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
                    <label htmlFor="auth-registration-mode" className="text-xs font-bold text-[#264653]">¿Cómo vas a participar?</label>
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

              <div className="space-y-1" hidden={Boolean(googleProof)}>
                <label htmlFor="auth-email" className="text-xs font-bold text-[#264653]">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 size-4 text-gray-400" />
                  <Input
                    id="auth-email"
                    ref={emailInput}
                    type="email"
                    required={!googleProof}
                    disabled={Boolean(googleProof)}
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
                className="w-full bg-[#e76f51] hover:bg-[#d65d3f] text-white font-bold text-xs py-3 rounded-lg shadow-xs transition-all mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Procesando...
                  </span>
                ) : mode === "register" ? (
                  "Crear cuenta"
                ) : (
                  googleLinkProof ? "Vincular Google y entrar" : "Ingresar a Ayni Digital"
                )}
              </Button>
            </form>

            <div className="pt-2 border-t border-gray-100 flex flex-col gap-3">
              <GoogleSignInButton disabled={loading} onCredential={(proof) => { void handleGoogle(proof); }} />
              <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-1">
                <ShieldCheck className="size-4 text-[#2c5f7c] shrink-0" />
                <span>Tus datos y archivos familiares están protegidos de forma privada.</span>
              </div>
            </div>
          </div>
        </section>

        <aside aria-label="Ayni acompaña los recuerdos familiares" className="auth-story">
          <div className="auth-mascot"><AyniCompanion decorative/></div>
          <img src="/images/familia-participa.jpg" alt="Una familia comparte recuerdos con una persona mayor" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#264653]/25" />
          <div className="absolute inset-x-0 bottom-0 bg-[#264653]/80 px-5 py-4 text-white sm:px-7 sm:py-6">
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
