import { useEffect, useState } from "react";
import { Heart, LogOut, UserRound } from "lucide-react";
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
      <div className="flex min-h-screen items-center justify-center bg-white">
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
    <div className="min-h-screen bg-white text-[#264653]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <button onClick={() => setView("home")} className="flex min-h-11 items-center gap-2.5 text-left">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#2c5f7c] text-[#e76f51]"><Heart className="size-5 fill-current" /></span>
            <span><span className="block font-extrabold leading-tight text-[#2c5f7c]">Ayni Digital</span><span className="block text-[10px] text-slate-500">Recuerdos que nos acercan</span></span>
          </button>
          <nav aria-label="Tu espacio familiar" className="flex flex-wrap items-center justify-end gap-1 text-xs font-semibold sm:gap-2">
            {([["home", "Inicio"], ["profile", "Perfil familiar"], ["memories", "Subir recuerdos"], ["session", "Guía de sesión"], ["dashboard", "Dashboard"], ["billing", "Plan"]] as const).map(([destination, label]) => <button key={destination} onClick={() => setView(destination)} aria-current={view === destination ? "page" : undefined} className={`min-h-10 rounded-xl px-2.5 py-2 transition-colors sm:px-3 ${view === destination ? "bg-[#2c5f7c] text-white" : "text-[#264653] hover:bg-[#2c5f7c]/10"}`}>{label}</button>)}
            <button onClick={() => setView("account")} aria-label="Abrir mi cuenta" aria-current={view === "account" ? "page" : undefined} title="Mi perfil" className={`grid size-9 place-items-center rounded-full transition-colors ${view === "account" ? "bg-[#2c5f7c] text-white" : "text-[#2c5f7c] hover:bg-slate-100"}`}>
              <UserRound aria-hidden="true" className="size-4" />
              <span className="sr-only">{currentUser?.name} {currentUser?.role === "cuidador_principal" ? "Cuidador principal" : "Familiar invitado"}</span>
            </button>
            <button onClick={() => { logout(); sessionStorage.removeItem("ayni_checkout_return"); setCurrentUser(null); setView("welcome"); }} aria-label="Cerrar sesión" className="inline-flex min-h-10 items-center gap-1.5 px-2 text-xs font-semibold text-[#d65d3f] hover:underline">
              <LogOut aria-hidden="true" className="size-4" /><span>Cerrar sesión</span>
            </button>
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
          <p className="text-sm leading-relaxed text-gray-600">El perfil de la persona acompañada está en “Perfil familiar”. La edición del nombre y correo de tu cuenta aún no está disponible. Desde aquí puedes revisar el plan y la configuración familiar.</p>
          <div className="flex flex-wrap gap-3"><button onClick={() => setView("profile")} className="min-h-12 rounded-lg bg-[#2c5f7c] px-5 font-semibold text-white">Ver persona y familia</button><button onClick={() => setView("billing")} className="min-h-12 rounded-lg border border-[#2c5f7c]/30 px-5 font-semibold text-[#2c5f7c]">Plan familiar</button><button onClick={() => setView("settings")} className="min-h-12 rounded-lg border border-[#2c5f7c]/30 px-5 font-semibold text-[#2c5f7c]">Configuración y privacidad</button><button onClick={() => { logout(); sessionStorage.removeItem("ayni_checkout_return"); setCurrentUser(null); setView("welcome"); }} className="min-h-12 rounded-lg border border-[#2c5f7c]/30 px-5 font-semibold">Cerrar sesión</button></div>
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
