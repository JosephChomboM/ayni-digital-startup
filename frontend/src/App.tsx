import { useEffect, useState } from "react";
import { getMe, logout } from "./api/auth";
import { SESSION_EXPIRED_EVENT } from "./api/client";
import type { User } from "./api/auth";

import { WelcomePage } from "./pages/WelcomePage";
import { HomePage } from "./pages/HomePage";
import { AuthPage } from "./pages/AuthPage";
import { SessionGuide } from "./components/SessionGuide";
import { UploadModule } from "./components/UploadModule";
import { FamilyDashboard } from "./components/FamilyDashboard";

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"welcome" | "auth_login" | "auth_register" | "home" | "session" | "memories" | "dashboard">("welcome");

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
        setView("home");
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
          setView("home");
        }}
      />
    );
  }

  // 3. NAVEGACIÓN Y APLICACIÓN PRINCIPAL
  return (
    <div className="min-h-screen bg-[#f1faee] text-[#264653]">
      <header className="sticky top-0 z-30 border-b border-[#2c5f7c]/10 bg-[#f1faee]/90 backdrop-blur-md px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button
            onClick={() => setView("home")}
            className="flex items-center gap-3 font-extrabold text-[#2c5f7c] text-lg hover:opacity-80 transition-opacity"
          >
            Ayni Digital
          </button>
          
          <nav className="flex items-center gap-2 sm:gap-4 text-xs font-bold">
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
              onClick={() => {
                logout();
                setCurrentUser(null);
                setView("welcome");
              }}
              className="text-[#e76f51] hover:underline text-xs font-semibold ml-2"
            >
              Cerrar sesión
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {view === "home" && (
          <HomePage
            onStartSession={() => setView("session")}
            onViewMemories={() => setView("memories")}
          />
        )}

        {view === "session" && (
          <div className="max-w-2xl mx-auto">
            <SessionGuide />
          </div>
        )}

        {view === "memories" && (
          <div className="max-w-2xl mx-auto">
            <UploadModule />
          </div>
        )}

        {view === "dashboard" && (
          <div className="max-w-5xl mx-auto">
            <FamilyDashboard />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
