import { useEffect, useState } from "react";
import { getMe, logout } from "./api/auth";
import { SESSION_EXPIRED_EVENT } from "./api/client";
import type { User } from "./api/auth";
import { Heart, LogOut, UserRound } from "lucide-react";

import { WelcomePage } from "./pages/WelcomePage";
import { HomePage } from "./pages/HomePage";
import { AuthPage } from "./pages/AuthPage";
import { SessionGuide } from "./components/SessionGuide";
import { UploadModule } from "./components/UploadModule";
import { FamilyDashboard } from "./components/FamilyDashboard";
import { AccountPage } from "./pages/AccountPage";
import type { AccountSection } from "./pages/AccountPage";

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"welcome" | "auth_login" | "auth_register" | "home" | "settings" | "session" | "memories" | "dashboard">("welcome");
  const [accountSection, setAccountSection] = useState<AccountSection>("overview");

  useEffect(() => {
    let active = true;
    let sessionExpired = false;
    const billingReturn = ["success", "cancel"].includes(new URLSearchParams(window.location.search).get("billing") ?? "");
    const restorePlan = billingReturn || sessionStorage.getItem("ayni_checkout_return") === "settings:plan";
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
        if (restorePlan) {
          setAccountSection("plan");
          setView("settings");
          sessionStorage.removeItem("ayni_checkout_return");
        } else {
          setView("home");
        }
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
          setView("home");
        }}
      />
    );
  }

  // 3. NAVEGACIÓN Y APLICACIÓN PRINCIPAL
  return (
    <div className="min-h-screen bg-white text-[#264653]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setView("home")}
            className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-80"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-[#2c5f7c] text-[#e76f51]"><Heart className="size-5 fill-current" /></span>
            <span><span className="block font-extrabold leading-tight text-[#2c5f7c]">Ayni Digital</span><span className="block text-[10px] font-normal text-slate-500">Recuerdos que nos acercan</span></span>
          </button>
          
          <nav className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-3 text-xs font-semibold">
            <button
              onClick={() => setView("home")}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                view === "home" ? "bg-[#2c5f7c] text-white" : "text-[#264653] hover:bg-[#2c5f7c]/10"
              }`}
            >
              Inicio
            </button>
            <button
              onClick={() => setView("memories")}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                view === "memories" ? "bg-[#2c5f7c] text-white" : "text-[#264653] hover:bg-[#2c5f7c]/10"
              }`}
            >
              Subir recuerdos
            </button>
            <button
              onClick={() => setView("session")}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                view === "session" ? "bg-[#2c5f7c] text-white" : "text-[#264653] hover:bg-[#2c5f7c]/10"
              }`}
            >
              Guía de Sesión
            </button>
            <button
              onClick={() => setView("dashboard")}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                view === "dashboard" ? "bg-[#2c5f7c] text-white" : "text-[#264653] hover:bg-[#2c5f7c]/10"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => { logout(); sessionStorage.removeItem("ayni_checkout_return"); setCurrentUser(null); setView("welcome"); }}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-[#d65d3f] hover:underline"
            >
              <LogOut className="size-4" aria-hidden="true" /> <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
            <button
              onClick={() => { setAccountSection("overview"); setView("settings"); }}
              aria-label="Abrir perfil familiar"
              title="Perfil familiar"
              className={`order-3 inline-flex size-8 items-center justify-center rounded-full transition-colors ${view === "settings" ? "bg-[#2c5f7c] text-white" : "text-[#2c5f7c] hover:bg-slate-100"}`}
            >
              <UserRound className="size-4" />
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {view === "home" && currentUser && (
          <HomePage
            currentUser={currentUser}
            onStartSession={() => setView("session")}
            onViewMemories={() => setView("memories")}
          />
        )}

        {view === "session" && (
          <div className="max-w-2xl mx-auto">
            {currentUser && <SessionGuide currentUser={currentUser} onOpenMemories={() => setView("memories")} />}
          </div>
        )}

        {view === "settings" && currentUser && (
          <AccountPage currentUser={currentUser} initialSection={accountSection} onSectionChange={setAccountSection} />
        )}

        {view === "memories" && (
          <div className="max-w-2xl mx-auto">
            <UploadModule />
          </div>
        )}

        {view === "dashboard" && (
          <div className="max-w-7xl mx-auto">
            {currentUser && <FamilyDashboard currentUser={currentUser} onOpenMemories={() => setView("memories")} onOpenSession={() => setView("session")} />}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
