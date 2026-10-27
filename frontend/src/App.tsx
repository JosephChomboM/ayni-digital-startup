import { useState } from "react";
import { MobileLayout } from "./components/MobileLayout";
import { Button } from "./components/Button";
import { WelcomePage } from "./pages/WelcomePage";
import { HomePage } from "./pages/HomePage";
import { ProfilePage } from "./pages/ProfilePage";

export default function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeTab, setActiveTab] = useState<"home" | "memories" | "session" | "profile">("home");

  if (showWelcome) {
    return <WelcomePage onLoginSuccess={() => setShowWelcome(false)} />;
  }

  return (
    <MobileLayout activeTab={activeTab} onTabChange={setActiveTab} title="Ayni Digital">
      {activeTab === "home" && (
        <HomePage
          elderName="Mamá María"
          onStartSession={() => setActiveTab("session")}
          onViewMemories={() => setActiveTab("memories")}
        />
      )}

      {activeTab === "memories" && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#0D7A5F]/10 space-y-4 text-center">
          <span className="text-4xl">🖼️</span>
          <h2 className="text-lg font-bold text-[#0D7A5F]">Galería de Recuerdos</h2>
          <p className="text-sm text-gray-600">
            Aquí podrás subir fotos, anécdotas y canciones especiales para tu familiar.
          </p>
          <Button variant="secondary" onClick={() => alert("Próximamente: subir recuerdos")}>
            + Agregar recuerdo
          </Button>
        </div>
      )}

      {activeTab === "session" && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#0D7A5F]/10 space-y-4 text-center">
          <span className="text-4xl">💚</span>
          <h2 className="text-lg font-bold text-[#0D7A5F]">Guía de Sesión de Reminiscencia</h2>
          <p className="text-sm text-gray-600">
            Guía paso a paso para conversar sobre recuerdos positivos de manera cálida y natural.
          </p>
          <Button onClick={() => alert("Próximamente: iniciar actividad de 15 minutos")}>
            Comenzar guía de 15 minutos
          </Button>
        </div>
      )}

      {activeTab === "profile" && <ProfilePage />}
    </MobileLayout>
  );
}

