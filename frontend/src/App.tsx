import { useEffect, useState } from "react";
import { MobileLayout } from "./components/MobileLayout";
import { WelcomePage } from "./pages/WelcomePage";
import { HomePage } from "./pages/HomePage";
import { ProfilePage } from "./pages/ProfilePage";
import { getMe } from "./api/auth";
import type { User } from "./api/auth";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<"home" | "memories" | "session" | "profile">("home");

  const checkSession = async () => {
    const token = localStorage.getItem("ayni_token");
    if (!token) {
      setCurrentUser(null);
      setLoadingAuth(false);
      return;
    }

    try {
      const res = await getMe();
      setCurrentUser(res.user);
    } catch {
      localStorage.removeItem("ayni_token");
      setCurrentUser(null);
    } finally {
      setLoadingAuth(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("ayni_token");
    setCurrentUser(null);
    setActiveTab("home");
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#F4FBF7] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-[#0D7A5F] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-gray-600 font-medium">Verificando sesión...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <WelcomePage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <MobileLayout activeTab={activeTab} onTabChange={setActiveTab} title="Ayni Digital">
      <div className="flex justify-end pb-2">
        <button
          onClick={handleLogout}
          className="text-[11px] text-red-600 font-semibold hover:underline bg-red-50 px-2.5 py-1 rounded-lg border border-red-200"
        >
          Cerrar sesión ({currentUser.name})
        </button>
      </div>

      {activeTab === "home" && (
        <HomePage
          onStartSession={() => setActiveTab("session")}
          onViewMemories={() => setActiveTab("memories")}
        />
      )}

      {activeTab === "memories" && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#0D7A5F]/10 space-y-4 text-center">
          <span className="text-4xl">🖼️</span>
          <h2 className="text-lg font-bold text-[#0D7A5F]">Galería de Recuerdos</h2>
          <p className="text-xs text-gray-600">
            Esta función estará disponible pronto para subir fotos, anécdotas y canciones familiares.
          </p>
        </div>
      )}

      {activeTab === "session" && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#0D7A5F]/10 space-y-4 text-center">
          <span className="text-4xl">💚</span>
          <h2 className="text-lg font-bold text-[#0D7A5F]">Sesión de Estimulación</h2>
          <p className="text-xs text-gray-600">
            Esta función estará disponible pronto para guiar las actividades de 15 minutos.
          </p>
        </div>
      )}

      {activeTab === "profile" && <ProfilePage currentUser={currentUser} />}
    </MobileLayout>
  );
}

