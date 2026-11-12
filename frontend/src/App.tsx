import { useEffect, useState } from "react";
import { House, Images, MessageCircle, ChartNoAxesCombined, Users, Leaf, LogOut, UserRound } from "lucide-react";
import { Brand } from "./components/Brand";
import { AyniCompanion } from "./components/AyniCompanion";
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
          <AyniCompanion state="thinking" className="loading-companion" decorative/>
          <p className="text-xs font-semibold text-[#223e38]">Cargando Ayni Digital...</p>
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
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Ir al contenido</a>
      <header className="app-sidebar">
        <button onClick={() => setView("home")} aria-label="Ayni Digital, ir al inicio" className="brand-button"><Brand /></button>
        <p className="sidebar-eyebrow">NUESTRO ESPACIO</p>
        <nav aria-label="Tu espacio familiar" className="app-navigation">
          {([["home", "Inicio", House], ["profile", "Perfil familiar", Users], ["memories", "Recuerdos", Images], ["session", "Guía de sesión", MessageCircle], ["dashboard", "Dashboard", ChartNoAxesCombined], ["billing", "Plan", Leaf]] as const).map(([destination, label, Icon]) =>
            <button key={destination} onClick={() => setView(destination)} aria-current={view === destination ? "page" : undefined}><Icon aria-hidden="true" size={20}/><span>{label}</span>{view === destination && <i aria-hidden="true"/>}</button>)}
        </nav>
        <div className="sidebar-companion"><AyniCompanion decorative/><strong>Un recuerdo puede<br/>acercarnos mucho.</strong><span>Aquí, a su ritmo.</span></div>
        <div className="sidebar-account"><button onClick={() => setView("account")} aria-label="Abrir mi cuenta" aria-current={view === "account" ? "page" : undefined}><span className="user-avatar"><UserRound size={20}/></span><span><strong>{currentUser?.name || "Mi cuenta"}</strong><small>{currentUser?.role === "cuidador_principal" ? "Cuidador principal" : "Familiar invitado"}</small></span></button>
        <button onClick={() => { logout(); sessionStorage.removeItem("ayni_checkout_return"); setCurrentUser(null); setView("welcome"); }} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={18}/></button></div>
      </header>

      <main id="main-content" className="app-content" data-view={view}>
        <div className="workspace-caption"><span>AYNI / TU ESPACIO FAMILIAR</span><span><i/> Momentos que nos acercan</span></div>
        {view === "account" && currentUser && <section className="account-overview space-y-6" aria-labelledby="account-title">
          <div><h1 id="account-title" className="text-3xl font-bold text-[#235c50]">Mi cuenta</h1><p className="mt-2 leading-relaxed">Esta es la cuenta con la que has iniciado sesión en Ayni.</p></div>
          <dl className="divide-y divide-[#235c50]/15 rounded-2xl bg-white px-6">
            <div className="py-5"><dt className="text-sm text-gray-600">Nombre</dt><dd className="mt-1 break-words text-lg font-semibold">{currentUser.name || "Nombre no disponible"}</dd></div>
            <div className="py-5"><dt className="text-sm text-gray-600">Correo electrónico</dt><dd className="mt-1 break-all">{currentUser.email}</dd></div>
            <div className="py-5"><dt className="text-sm text-gray-600">Tu participación</dt><dd className="mt-1 font-semibold">{currentUser.role === "cuidador_principal" ? "Persona cuidadora principal" : "Familiar invitado"}</dd><dd className="mt-2 text-sm leading-relaxed">{currentUser.role === "cuidador_principal" ? "Puedes gestionar el perfil de la persona acompañada e invitar a tu familia." : "Puedes consultar el perfil de la persona acompañada y aportar recuerdos."}</dd></div>
          </dl>
          <p className="text-sm leading-relaxed text-gray-600">El perfil de la persona acompañada está en “Perfil familiar”. La edición del nombre y correo de tu cuenta aún no está disponible. Desde aquí puedes revisar el plan y la configuración familiar.</p>
          <div className="flex flex-wrap gap-3"><button onClick={() => setView("profile")} className="min-h-12 rounded-lg bg-[#235c50] px-5 font-semibold text-white">Ver persona y familia</button><button onClick={() => setView("billing")} className="min-h-12 rounded-lg border border-[#235c50]/30 px-5 font-semibold text-[#235c50]">Plan familiar</button><button onClick={() => setView("settings")} className="min-h-12 rounded-lg border border-[#235c50]/30 px-5 font-semibold text-[#235c50]">Configuración y privacidad</button><button onClick={() => { logout(); sessionStorage.removeItem("ayni_checkout_return"); setCurrentUser(null); setView("welcome"); }} className="min-h-12 rounded-lg border border-[#235c50]/30 px-5 font-semibold">Cerrar sesión</button></div>
        </section>}

        {view === "settings" && currentUser && <AccountPage currentUser={currentUser} initialSection={accountSection} onSectionChange={setAccountSection} onUserUpdated={setCurrentUser} />}
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
          <div className="module-container">
            {currentUser && <SessionGuide currentUser={currentUser} onOpenMemories={() => setView("memories")} />}
          </div>
        )}

        {view === "profile" && currentUser && (
          <div className="module-container">
            <ProfilePage currentUser={currentUser} />
          </div>
        )}

        {view === "memories" && (
          <div className="module-container">
            <UploadModule />
          </div>
        )}

        {view === "dashboard" && (
          <div className="module-container module-dashboard">
            {currentUser && <FamilyDashboard currentUser={currentUser} onOpenMemories={() => setView("memories")} onOpenSession={() => setView("session")} />}
          </div>
        )}
        {view === "billing" && <div className="module-container plan-page space-y-4"><h1 className="text-2xl font-bold text-[#235c50]">Tu plan familiar</h1><BillingPanel /></div>}
      </main>
    </div>
  );
}

export default App;
