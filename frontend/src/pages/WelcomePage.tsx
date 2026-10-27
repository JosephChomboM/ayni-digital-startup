import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { getConsent, registerUser, loginUser } from "../api/auth";
import type { ConsentResponse, User } from "../api/auth";
import { ApiError } from "../api/client";

interface WelcomePageProps {
  onLoginSuccess: (user: User) => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState<"splash" | "consent" | "auth">("splash");
  const [authMode, setAuthMode] = useState<"login" | "register">("register");

  // Consentimiento dinámico
  const [consentData, setConsentData] = useState<ConsentResponse | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [loadingConsent, setLoadingConsent] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);

  // Campos de Formulario
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyName, setFamilyName] = useState("");

  // Estados de carga y error
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchConsent = async () => {
    setLoadingConsent(true);
    setConsentError(null);
    try {
      const data = await getConsent();
      setConsentData(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setConsentError(err.message);
      } else {
        setConsentError("No pudimos conectar con el servidor para cargar el consentimiento.");
      }
    } finally {
      setLoadingConsent(false);
    }
  };

  useEffect(() => {
    fetchConsent();
  }, []);

  const handleStartRegisterFlow = () => {
    setFormError(null);
    setConsentError(null);
    setAuthMode("register");
    fetchConsent();
    setStep("consent");
  };

  const handleSwitchToLogin = () => {
    setFormError(null);
    setAuthMode("login");
    setStep("auth");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanEmail = email.trim().toLowerCase();

    if (authMode === "register") {
      if (!hasConsented || !consentData) {
        setFormError("Debes aceptar el aviso de consentimiento para registrarte.");
        return;
      }

      if (password.length < 10) {
        setFormError("La contraseña debe tener al menos 10 caracteres.");
        return;
      }

      setSubmitting(true);
      try {
        await registerUser({
          name: name.trim(),
          email: cleanEmail,
          password,
          family_name: familyName.trim() || `Familia de ${name.trim().split(" ")[0]}`,
          consent: {
            accepted: true,
            text_version: consentData.text_version,
          },
        });

        const loginRes = await loginUser(cleanEmail, password);
        localStorage.setItem("ayni_token", loginRes.access_token);
        onLoginSuccess(loginRes.user);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.code === "consent_version_invalid") {
            setFormError("La versión del consentimiento ha cambiado. Por favor acéptala nuevamente.");
            setHasConsented(false);
            fetchConsent();
            setStep("consent");
          } else {
            setFormError(err.message);
          }
        } else {
          setFormError("Ocurrió un error al procesar tu solicitud.");
        }
      } finally {
        setSubmitting(false);
      }
    } else {
      setSubmitting(true);
      try {
        const loginRes = await loginUser(cleanEmail, password);
        localStorage.setItem("ayni_token", loginRes.access_token);
        onLoginSuccess(loginRes.user);
      } catch (err) {
        if (err instanceof ApiError) {
          setFormError(err.message);
        } else {
          setFormError("Credenciales incorrectas o error en el servidor.");
        }
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F4FBF7] text-[#1F2937] flex flex-col justify-between p-6 max-w-md mx-auto">
      {/* Vista 1: Splash */}
      {step === "splash" && (
        <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6 my-auto">
          <div className="w-28 h-28 rounded-full bg-[#E8F5E9] border-4 border-[#0D7A5F] flex items-center justify-center shadow-md animate-bounce">
            <span className="text-4xl font-extrabold text-[#0D7A5F]">Ayni</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[#0D7A5F]">¡Te damos la bienvenida a Ayni!</h1>
            <p className="text-sm text-gray-600 leading-relaxed px-2">
              Un espacio para compartir actividades de estimulación cognitiva y recuerdos felices en familia.
            </p>
          </div>

          <div className="w-full pt-6 space-y-3">
            <Button onClick={handleStartRegisterFlow}>
              Crear cuenta de cuidadora
            </Button>
            <Button variant="outline" onClick={handleSwitchToLogin}>
              Ya tengo una cuenta
            </Button>
          </div>
        </div>
      )}

      {/* Vista 2: Consentimiento Obligatorio */}
      {step === "consent" && (
        <div className="flex-1 flex flex-col justify-between space-y-6 my-auto py-4">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#0D7A5F] text-center">Antes de comenzar</h2>

            {loadingConsent && (
              <div className="p-6 text-center text-xs text-gray-500">Cargando términos de consentimiento...</div>
            )}

            {consentError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs space-y-2 text-center">
                <p>⚠️ {consentError}</p>
                <button
                  type="button"
                  onClick={fetchConsent}
                  className="px-3 py-1 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 text-xs"
                >
                  Reintentar
                </button>
              </div>
            )}

            {consentData && !loadingConsent && (
              <>
                <div className="bg-[#FEF3C7] border border-[#D97706]/30 p-4 rounded-2xl space-y-2">
                  <span className="text-2xl">📌</span>
                  <p className="text-xs text-[#92400E] leading-relaxed font-medium">
                    {consentData.onboarding_notice}
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3 shadow-sm">
                  <h3 className="text-sm font-semibold text-[#0D7A5F]">
                    Protección de datos (Versión {consentData.text_version})
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {consentData.text}
                  </p>

                  <label className="flex items-start space-x-3 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasConsented}
                      onChange={(e) => setHasConsented(e.target.checked)}
                      className="mt-1 w-5 h-5 text-[#0D7A5F] rounded focus:ring-[#0D7A5F]"
                    />
                    <span className="text-xs text-gray-700 font-medium leading-tight">
                      Acepto los términos y el almacenamiento seguro de datos.
                    </span>
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="space-y-3">
            <Button
              disabled={!hasConsented || !consentData || loadingConsent}
              onClick={() => setStep("auth")}
            >
              Continuar al registro
            </Button>
            <Button variant="outline" onClick={() => setStep("splash")}>
              Volver
            </Button>
          </div>
        </div>
      )}

      {/* Vista 3: Formulario Auth */}
      {step === "auth" && (
        <div className="flex-1 flex flex-col justify-center space-y-4 my-auto py-2">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold text-[#0D7A5F]">
              {authMode === "register" ? "Registro de Cuidadora" : "Iniciar Sesión"}
            </h2>
            <p className="text-xs text-gray-600">
              {authMode === "register"
                ? "Completa los datos para crear la red de tu familia"
                : "Ingresa tu correo y contraseña para acceder"}
            </p>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs text-center font-medium">
              ⚠️ {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            {authMode === "register" ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre completo</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Ana de prueba"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ana@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Contraseña (Mínimo 10 caracteres)</label>
                  <input
                    type="password"
                    required
                    minLength={10}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre del grupo familiar</label>
                  <input
                    type="text"
                    required
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="Ej. Familia de prueba"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ana@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Contraseña</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  />
                </div>
              </>
            )}

            <Button type="submit" disabled={submitting} className="mt-3">
              {submitting
                ? authMode === "register" ? "Creando cuenta..." : "Ingresando..."
                : authMode === "register" ? "Completar Registro (Cuidador)" : "Ingresar a Ayni"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              if (authMode === "login") {
                handleStartRegisterFlow();
              } else {
                handleSwitchToLogin();
              }
            }}
            className="text-xs text-[#0D7A5F] font-semibold text-center hover:underline"
          >
            {authMode === "register"
              ? "¿Ya tienes cuenta? Inicia sesión aquí"
              : "¿No tienes cuenta? Regístrate aquí"}
          </button>
        </div>
      )}
    </div>
  );
};

