import React from "react";

interface MobileLayoutProps {
  children: React.ReactNode;
  activeTab?: "home" | "memories" | "session" | "profile";
  onTabChange?: (tab: "home" | "memories" | "session" | "profile") => void;
  title?: string;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  activeTab = "home",
  onTabChange,
  title = "Ayni Digital",
}) => {
  return (
    <div className="min-h-screen bg-[#F4FBF7] text-[#1F2937] flex flex-col justify-between max-w-md mx-auto shadow-lg border-x border-[#0D7A5F]/10">
      <header className="bg-[#0D7A5F] text-white p-4 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wide">{title}</h1>
          <p className="text-xs text-[#E8F5E9] opacity-90">Recuerdos en familia</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-[#E8F5E9] text-[#0D7A5F] flex items-center justify-center font-bold text-sm">
          A
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 py-2 px-4 flex justify-around items-center z-20 shadow-lg">
        <button
          onClick={() => onTabChange?.("home")}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            activeTab === "home" ? "text-[#0D7A5F] font-bold" : "text-gray-500 hover:text-[#0D7A5F]"
          }`}
        >
          <span className="text-lg">Inicio</span>
        </button>

        <button
          onClick={() => onTabChange?.("memories")}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            activeTab === "memories" ? "text-[#0D7A5F] font-bold" : "text-gray-500 hover:text-[#0D7A5F]"
          }`}
        >
          <span className="text-lg">Recuerdos</span>
        </button>

        <button
          onClick={() => onTabChange?.("session")}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            activeTab === "session" ? "text-[#0D7A5F] font-bold" : "text-gray-500 hover:text-[#0D7A5F]"
          }`}
        >
          <span className="text-lg">Sesion</span>
        </button>

        <button
          onClick={() => onTabChange?.("profile")}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            activeTab === "profile" ? "text-[#0D7A5F] font-bold" : "text-gray-500 hover:text-[#0D7A5F]"
          }`}
        >
          <span className="text-lg">Perfil</span>
        </button>
      </nav>
    </div>
  );
};

