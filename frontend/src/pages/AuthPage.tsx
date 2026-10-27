import React, { useState } from "react";
import { Heart, ArrowLeft, Mail, Lock, User, ShieldCheck, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { login, register, loginCaregiver, registerCaregiver } from "../api/auth";
import type { User as UserType } from "../api/auth";

interface AuthPageProps {
  initialMode?: "login" | "register";
  onBack: () => void;
  onSuccess: (user: UserType) => void;
}

const DEMO_USER: UserType = {
  id: "demo-user-1",
  email: "demo@ayni.pe",
  name: "Cuidador Ayni",
  family_id: "demo-family-1",
  role: "cuidador_principal",
  created_at: "2026-10-27T00:00:00.000Z",
};

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = "register",
  onBack,
  onSuccess,
}) => {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [familyName, setFamilyName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let response;
      if (mode === "login") {
        const fn = loginCaregiver || login;
        response = await fn({ email, password });
      } else {
        const fn = registerCaregiver || register;
        response = await fn({
          email,
          password,
          name,
          family_name: familyName || "Familia Ayni",
        });
      }

      if (response && response.user) {
        onSuccess(response.user);
      } else {
        // Fallback de demostración si el backend backend no retorna usuario
        onSuccess(DEMO_USER);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudo conectar con el servidor. Puedes ingresar con el modo demostración.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = () => {
    onSuccess(DEMO_USER);
  };

  return (
    <div className="min-h-screen bg-[#f1faee] flex flex-col justify-between p-4 sm:p-8 text-[#264653]">
      <div className="mx-auto max-w-5xl w-full flex items-center justify-between pb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#2c5f7c] hover:underline"
        >
          <ArrowLeft className="size-4" /> Volver al inicio
        </button>

        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-[#2c5f7c] text-white shadow-sm">
            <Heart className="size-4 fill-current text-[#e76f51]" />
          </div>
          <span className="font-extrabold text-[#2c5f7c] text-sm">Ayni Digital</span>
        </div>
      </div>

      <div className="mx-auto max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-xl p-6 sm:p-8 space-y-6">
        <div className="flex rounded-xl bg-[#f1faee] p-1 border border-gray-200">
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === "register"
                ? "bg-[#2c5f7c] text-white shadow-sm"
                : "text-gray-500 hover:text-[#264653]"
            }`}
          >
            Registro del Cuidador
          </button>
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === "login"
                ? "bg-[#2c5f7c] text-white shadow-sm"
                : "text-gray-500 hover:text-[#264653]"
            }`}
          >
            Iniciar Sesión
          </button>
        </div>

        <div>
          <h2 className="text-xl font-extrabold text-[#2c5f7c]">
            {mode === "register" ? "Crear cuenta de cuidador" : "Bienvenido de nuevo"}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {mode === "register"
              ? "Registra tu grupo familiar para empezar a subir recuerdos."
              : "Ingresa tus credenciales para acceder a tus sesiones."}
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 space-y-2">
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={handleDemoAccess}
              className="text-[#2c5f7c] font-bold underline hover:text-[#224a61]"
            >
              Hacer clic aquí para entrar en modo vista previa ➔
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#264653]">Tu Nombre Completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 size-4 text-gray-400" />
                  <Input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Maria Martinez"
                    className="pl-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#264653]">Nombre del Grupo Familiar</label>
                <div className="relative">
                  <Sparkles className="absolute left-3 top-3 size-4 text-gray-400" />
                  <Input
                    required
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="Ej. Familia Martinez"
                    className="pl-9 text-xs"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#264653]">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 size-4 text-gray-400" />
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="pl-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#264653]">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 size-4 text-gray-400" />
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9 text-xs"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#e76f51] hover:bg-[#d65d3f] text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Procesando...
              </span>
            ) : mode === "register" ? (
              "Crear Cuenta de Cuidador"
            ) : (
              "Ingresar a Ayni Digital"
            )}
          </Button>
        </form>

        <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleDemoAccess}
            className="w-full border-[#2c5f7c]/30 text-[#2c5f7c] hover:bg-[#2c5f7c]/10 font-bold text-xs py-2.5 rounded-xl"
          >
            Ingresar directo (Vista Previa) <ArrowRight className="size-3.5 ml-1" />
          </Button>

          <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-1">
            <ShieldCheck className="size-4 text-[#2c5f7c] shrink-0" />
            <span>Tus datos y archivos familiares están protegidos de forma privada.</span>
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-gray-400 py-4">
        © 2026 Ayni Digital • Acompañamiento familiar por reminiscencia
      </footer>
    </div>
  );
};
