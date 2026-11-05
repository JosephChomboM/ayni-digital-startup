import { useEffect, useState } from "react";
import { getMe, logout } from "./api/auth";
import { SESSION_EXPIRED_EVENT } from "./api/client";
import type { User } from "./api/auth";

import { WelcomePage } from "./pages/WelcomePage";
import { HomePage } from "./pages/HomePage";
import { AuthPage } from "./pages/AuthPage";
import { AccountPage } from "./pages/AccountPage";
import type { AccountSection } from "./pages/AccountPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SessionGuide } from "./components/SessionGuide";
import { UploadModule } from "./components/UploadModule";
import { BillingPanel } from "./components/BillingPanel";
import { FamilyDashboard } from "./components/FamilyDashboard";

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"welcome" | "auth_login" | "auth_register" | "home" | "profile" | "session" | "memories" | "dashboard" | "billing" | "account" | "settings">("welcome");

  const [accountSection, setAccountSection] = useState<AccountSection>("overview");

  useEffect(() => {
    let active = true;
    let sessionExpired = false;
    const requireLogin = () => {
      sessionExpired = true;
      setCurrentUser(null);
      setView("auth_login");
      setLoading(false);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, requireLogin);
    async function checkSession() {
      try {
        const sessionData = await getMe();
        if (!active || sessionExpired) return;
        setCurrentUser(sessionData.user);
        const billingReturn = new URLSearchParams(window.location.search).get("billing");
        setView(billingReturn === "success" || billingReturn === "cancel" || sessionStorage.getItem("ayni_checkout_return") === "settings:plan" ? "billing" : "home");
        sessionStorage.removeItem("ayni_checkout_return");
      } catch {
        if (!active) return;
        setCurrentUser(null);
        setView(sessionExpired ? "auth_login" : "welcome");
      } finally {
        if (active) setLoading(false);
      }
    }
    checkSession();
    return () => {
      active = false;
      window.removeEventListener(SESSION_EXPIRED_EVENT, requireLogin);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1faee]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-full border-4 border-[#2c5f7c] border-t-transparent animate-spin" />
          <p className="text-xs font-semibold text-[#264653]">Cargando Ayni Digital...</p>
        </div>
      </div>
    );
  }

  // 1. LANDING PÚBLICA DE BIENVENIDA
  if (!currentUser && view === "welcome") {
    return (
      <WelcomePage
        onLoginClick={() => setView("auth_login")}
        onRegisterClick={() => setView("auth_register")}
      />
    );
  }

  // 2. PÁGINA DEDICADA DE REGISTRO / INICIO DE SESIÓN
  if (!currentUser && (view === "auth_login" || view === "auth_register")) {
    return (
      <AuthPage
        key={view}
        initialMode={view === "auth_login" ? "login" : "register"}
        onBack={() => setView("welcome")}
        onSuccess={(user) => {
          setCurrentUser(user);
          const billingReturn = new URLSearchParams(window.location.search).get("billing");
          setView(billingReturn === "success" || billingReturn === "cancel" || sessionStorage.getItem("ayni_checkout_return") === "settings:plan" ? "billing" : "home");
        sessionStorage.removeItem("ayni_checkout_return");
        }}
      />
    );
  }

  // 3. NAVEGACIÓN Y APLICACIÓN PRINCIPAL
  return (
    <div className="min-h-screen bg-[#f1faee] text-[#264653]">
      <header className="border-b border-[#2c5f7c]/15 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="flex items-center justify-between gap-4">
            <button onClick={() => setView("home")} className="min-h-11 text-lg font-bold text-[#2c5f7c]">Ayni Digital</button>
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setView("account")} aria-label="Abrir mi cuenta" aria-current={view === "account" ? "page" : undefined} className="flex min-h-12 min-w-0 items-center gap-3 rounded-lg px-2 py-1 text-left hover:bg-[#f1faee]">
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#2c5f7c] text-sm font-bold text-white">{(currentUser?.name || currentUser?.email || "A").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()}</span>
                <span className="min-w-0"><span className="block max-w-48 truncate font-semibold">{currentUser?.name || currentUser?.email || "Mi cuenta"}</span><span className="block text-xs text-gray-600">{currentUser?.role === "cuidador_principal" ? "Cuidador principal" : "Familiar invitado"} · Sesión iniciada</span></span>
              </button>
              <button onClick={() => { logout(); sessionStorage.removeItem("ayni_checkout_return"); setCurrentUser(null); setView("welcome"); }} className="hidden min-h-11 px-2 text-sm font-semibold text-[#264653] underline underline-offset-4 sm:block">Cerrar sesión</button>
            </div>
          </div>
          <nav aria-label="Tu espacio familiar" className="flex flex-wrap items-center gap-1 text-sm">
            {([
              ["home", "Inicio"], ["profile", "Persona y familia"], ["memories", "Recuerdos"], ["session", "Guía de sesión"],
            ] as const).map(([destination, label]) => <button key={destination} onClick={() => setView(destination)} aria-current={view === destination ? "page" : undefined} className={`min-h-11 rounded-xl px-3 py-2 font-semibold transition-colors ${view === destination ? "bg-[#2c5f7c] text-white" : "text-[#264653] hover:bg-[#f1faee]"}`}>{label}</button>)}
            <button onClick={() => setView("account")} aria-current={view === "account" ? "page" : undefined} className={`min-h-11 rounded-xl px-3 py-2 font-semibold ${view === "account" ? "bg-[#2c5f7c] text-white" : "text-[#264653] hover:bg-[#f1faee]"}`}>Mi cuenta</button>
            <details className="relative">
              <summary className={`flex min-h-11 cursor-pointer items-center rounded-xl px-3 py-2 font-semibold ${view === "dashboard" || view === "billing" ? "bg-[#2c5f7c] text-white" : "text-[#264653]"}`}>Más opciones</summary>
              <div className="absolute left-0 z-40 mt-2 grid min-w-48 gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                {([["dashboard", "Resumen familiar"], ["billing", "Plan Familia"], ["settings", "Configuración y privacidad"]] as const).map(([destination, label]) => <button key={destination} aria-current={view === destination ? "page" : undefined} onClick={event => { setView(destination); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="min-h-11 rounded-lg px-3 text-left text-[#264653] hover:bg-[#f1faee]">{label}</button>)}
              </div>
            </details>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {view === "account" && currentUser && <section className="mx-auto max-w-2xl space-y-6" aria-labelledby="account-title">
          <div><h1 id="account-title" className="text-3xl font-bold text-[#2c5f7c]">Mi cuenta</h1><p className="mt-2 leading-relaxed">Esta es la cuenta con la que has iniciado sesión en Ayni.</p></div>
          <dl className="divide-y divide-[#2c5f7c]/15 rounded-2xl bg-white px-6">
            <div className="py-5"><dt className="text-sm text-gray-600">Nombre</dt><dd className="mt-1 break-words text-lg font-semibold">{currentUser.name || "Nombre no disponible"}</dd></div>
            <div className="py-5"><dt className="text-sm text-gray-600">Correo electrónico</dt><dd className="mt-1 break-all">{currentUser.email}</dd></div>
            <div className="py-5"><dt className="text-sm text-gray-600">Tu participación</dt><dd className="mt-1 font-semibold">{currentUser.role === "cuidador_principal" ? "Persona cuidadora principal" : "Familiar invitado"}</dd><dd className="mt-2 text-sm leading-relaxed">{currentUser.role === "cuidador_principal" ? "Puedes gestionar el perfil de la persona acompañada e invitar a tu familia." : "Puedes consultar el perfil de la persona acompañada y aportar recuerdos."}</dd></div>
          </dl>
          <p className="text-sm leading-relaxed text-gray-600">El perfil de la persona acompañada está en “Persona y familia”. La edición del nombre y correo de tu cuenta aún no está disponible. En “Más opciones” puedes abrir Configuración y privacidad para consultar tu plan y tus aportes.</p>
          <div className="flex flex-wrap gap-3"><button onClick={() => setView("profile")} className="min-h-12 rounded-lg bg-[#2c5f7c] px-5 font-semibold text-white">Ver persona y familia</button><button onClick={() => { logout(); sessionStorage.removeItem("ayni_checkout_return"); setCurrentUser(null); setView("welcome"); }} className="min-h-12 rounded-lg border border-[#2c5f7c]/30 px-5 font-semibold">Cerrar sesión</button></div>
        </section>}

        {view === "settings" && currentUser && <AccountPage currentUser={currentUser} initialSection={accountSection} onSectionChange={setAccountSection} />}
        {view === "home" && (
          <HomePage
            onStartSession={() => setView("session")}
            onViewMemories={() => setView("memories")}
            onViewProfile={() => setView("profile")}
            currentUser={currentUser ?? undefined}
            canManageFamily={currentUser?.role === "cuidador_principal"}
          />
        )}

        {view === "session" && (
          <div className="max-w-2xl mx-auto">
            {currentUser && <SessionGuide currentUser={currentUser} onOpenMemories={() => setView("memories")} />}
          </div>
        )}

        {view === "profile" && currentUser && (
          <div className="max-w-2xl mx-auto">
            <ProfilePage currentUser={currentUser} />
          </div>
        )}

        {view === "memories" && (
          <div className="max-w-2xl mx-auto">
            <UploadModule />
          </div>
        )}

        {view === "dashboard" && (
          <div className="max-w-5xl mx-auto">
            {currentUser && <FamilyDashboard currentUser={currentUser} onOpenMemories={() => setView("memories")} onOpenSession={() => setView("session")} />}
          </div>
        )}
        {view === "billing" && <div className="mx-auto max-w-2xl space-y-4"><h1 className="text-2xl font-bold text-[#2c5f7c]">Tu plan familiar</h1><BillingPanel /></div>}
      </main>
    </div>
  );
}

export default App;
