import { lazy, Suspense, useEffect, useState } from "react";
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
const PageAssistant = lazy(() => import("./components/PageAssistant").then(module => ({ default: module.PageAssistant })));

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"welcome" | "auth_login" | "auth_register" | "home" | "profile" | "session" | "memories" | "dashboard" | "billing" | "settings">("welcome");

  const [accountSection, setAccountSection] = useState<AccountSection>("overview");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantRequest, setAssistantRequest] = useState<{ id: string; text: string }>();
  const askAssistant = (text: string) => {
    setAssistantRequest({ id: crypto.randomUUID(), text });
    setAssistantOpen(true);
  };

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
    <><div className="app-shell">
      <a href="#main-content" className="skip-link">Ir al contenido</a>
      <header className="app-sidebar">
        <button onClick={() => setView("home")} aria-label="Ayni Digital, ir al inicio" className="brand-button"><Brand /></button>
        <p className="sidebar-eyebrow">NUESTRO ESPACIO</p>
        <nav aria-label="Tu espacio familiar" className="app-navigation">
          {([["home", "Inicio", House], ["profile", "Perfil familiar", Users], ["memories", "Recuerdos", Images], ["session", "Guía de sesión", MessageCircle], ["dashboard", "Dashboard", ChartNoAxesCombined], ["billing", "Plan", Leaf]] as const).map(([destination, label, Icon]) =>
            <button key={destination} onClick={() => setView(destination)} aria-current={view === destination ? "page" : undefined}><Icon aria-hidden="true" size={20}/><span>{label}</span>{view === destination && <i aria-hidden="true"/>}</button>)}
        </nav>
        <div className="sidebar-companion"><AyniCompanion decorative/><strong>Un recuerdo puede<br/>acercarnos mucho.</strong><span>Aquí, a su ritmo.</span></div>
        <div className="sidebar-account"><button onClick={() => { setAccountSection("overview"); setView("settings"); }} aria-label={`Abrir la cuenta de ${currentUser?.name || "usuario"}`} aria-current={view === "settings" ? "page" : undefined}><span className="user-avatar"><UserRound size={20}/></span><span><strong>{currentUser?.name || "Mi cuenta"}</strong><small>{currentUser?.role === "cuidador_principal" ? "Cuidador principal" : "Familiar invitado"}</small></span></button>
        <button onClick={() => { logout(); sessionStorage.removeItem("ayni_checkout_return"); setCurrentUser(null); setView("welcome"); }} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={18}/></button></div>
      </header>

      <main id="main-content" className="app-content" data-view={view}>
        <div className="workspace-caption"><span>AYNI / TU ESPACIO FAMILIAR</span><span><i/> Momentos que nos acercan</span></div>
        {view === "settings" && currentUser && <AccountPage currentUser={currentUser} initialSection={accountSection} onSectionChange={setAccountSection} onOpenFamilyProfile={() => setView("profile")} onUserUpdated={setCurrentUser} />}
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
            {currentUser && <SessionGuide currentUser={currentUser} assistantActive={assistantOpen} onAppInstruction={askAssistant} onOpenMemories={() => setView("memories")} onOpenPlan={() => setView("billing")} onOpenDashboard={() => setView("dashboard")} />}
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
        {view === "billing" && <div className="module-container plan-page space-y-4"><h1 className="text-2xl font-bold text-[#2c5f7c]">Tu plan familiar</h1><BillingPanel /></div>}
      </main>
    </div>
    {currentUser && <Suspense fallback={null}><PageAssistant key={currentUser.id} open={assistantOpen} onOpenChange={setAssistantOpen} request={assistantRequest} /></Suspense>}
    </>
  );
}

export default App;
