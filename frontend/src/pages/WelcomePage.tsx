import React, { useState } from "react";
import { Button } from "../components/Button";

interface WelcomePageProps {
  onLoginSuccess: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState<"splash" | "consent" | "auth">("splash");
  const [authMode, setAuthMode] = useState<"login" | "register">("register");

  // Datos de la Cuidadora (USERS)
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("Perú");
  const [city, setCity] = useState("Lima");

  // Datos del Adulto Mayor (ELDER_PROFILES)
  const [elderName, setElderName] = useState("");
  const [birthYear, setBirthYear] = useState("1950");
  const [siblingsCount, setSiblingsCount] = useState("2");
  const [elderPhoto, setElderPhoto] = useState<string | null>(null);

  // Colaboradores iniciales
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [newCollaborator, setNewCollaborator] = useState("");

  const [hasConsented, setHasConsented] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setElderPhoto(URL.createObjectURL(file));
    }
  };

  const handleAddCollaborator = () => {
    if (newCollaborator.trim() && !collaborators.includes(newCollaborator.trim())) {
      setCollaborators([...collaborators, newCollaborator.trim()]);
      setNewCollaborator("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSuccess();
  };

  return (
    <div className="min-h-screen bg-[#F4FBF7] text-[#1F2937] flex flex-col justify-between p-6 max-w-md mx-auto">
      {/* Vista 1: Splash / Bienvenida */}
      {step === "splash" && (
        <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6 my-auto">
          <div className="w-28 h-28 rounded-full bg-[#E8F5E9] border-4 border-[#0D7A5F] flex items-center justify-center shadow-md animate-bounce">
            <span className="text-4xl font-extrabold text-[#0D7A5F]">Ayni</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[#0D7A5F]">¡Te damos la bienvenida a Ayni!</h1>
            <p className="text-sm text-gray-600 leading-relaxed px-2">
              Un espacio para compartir actividades de estimulación cognitiva y recuerdos felices en familia.
            </p>
          </div>

          <div className="w-full pt-6 space-y-3">
            <Button onClick={() => setStep("consent")}>
              Crear cuenta de cuidadora
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setAuthMode("login");
                setStep("auth");
              }}
            >
              Ya tengo una cuenta
            </Button>
          </div>
        </div>
      )}

      {/* Vista 2: Ley N.° 29733 y Deslinde */}
      {step === "consent" && (
        <div className="flex-1 flex flex-col justify-between space-y-6 my-auto py-4">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#0D7A5F] text-center">Antes de comenzar</h2>

            <div className="bg-[#FEF3C7] border border-[#D97706]/30 p-4 rounded-2xl space-y-2">
              <span className="text-2xl">📌</span>
              <p className="text-xs text-[#92400E] leading-relaxed font-medium">
                <strong>Aviso importante:</strong> Ayni no es un servicio de salud. Si tu familiar tiene un diagnóstico de demencia, consulta con su médico antes de empezar.
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3 shadow-sm">
              <h3 className="text-sm font-semibold text-[#0D7A5F]">Protección de tus datos (Ley N.° 29733)</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Guardamos los recuerdos de tu familia de manera segura. Al continuar, aceptas que los datos se almacenen en servidores seguros fuera del Perú (Estados Unidos).
              </p>
              
              <label className="flex items-start space-x-3 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasConsented}
                  onChange={(e) => setHasConsented(e.target.checked)}
                  className="mt-1 w-5 h-5 text-[#0D7A5F] rounded focus:ring-[#0D7A5F]"
                />
                <span className="text-xs text-gray-700 font-medium leading-tight">
                  Acepto el almacenamiento seguro de datos y las condiciones de Ayni.
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <Button disabled={!hasConsented} onClick={() => setStep("auth")}>
              Continuar al registro
            </Button>
            <Button variant="outline" onClick={() => setStep("splash")}>
              Volver
            </Button>
          </div>
        </div>
      )}

      {/* Vista 3: Formulario Detallado */}
      {step === "auth" && (
        <div className="flex-1 flex flex-col justify-center space-y-4 my-auto py-2">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold text-[#0D7A5F]">
              {authMode === "register" ? "Registro Familiar" : "Iniciar Sesión"}
            </h2>
            <p className="text-xs text-gray-600">
              {authMode === "register"
                ? "Completa los datos para personalizar la experiencia"
                : "Ingresa tus credenciales para acceder"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm max-h-[72vh] overflow-y-auto">
            {authMode === "register" ? (
              <>
                {/* Sección 1: Cuidadora Principal */}
                <div className="border-b border-gray-100 pb-3 space-y-3">
                  <span className="text-xs font-bold text-[#0D7A5F] uppercase tracking-wider">
                    👤 Datos de la Cuidadora
                  </span>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre completo</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ej. María García"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Correo electrónico</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="cuidadora@correo.com"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Contraseña</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+51 987 654 321"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">País</label>
                      <input
                        type="text"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Ciudad</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                      />
                    </div>
                  </div>
                </div>

                {/* Sección 2: Adulto Mayor */}
                <div className="border-b border-gray-100 pb-3 space-y-3 pt-1">
                  <span className="text-xs font-bold text-[#0D7A5F] uppercase tracking-wider">
                    👵 Perfil del Adulto Mayor
                  </span>

                  {/* Carga de Foto Opcional */}
                  <div className="flex items-center space-x-3">
                    <div className="w-14 h-14 rounded-full bg-[#E8F5E9] border-2 border-dashed border-[#0D7A5F] flex items-center justify-center text-xl overflow-hidden shadow-inner">
                      {elderPhoto ? (
                        <img src={elderPhoto} alt="Adulto mayor" className="w-full h-full object-cover" />
                      ) : (
                        "📸"
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0D7A5F] cursor-pointer hover:underline">
                        Subir foto de perfil (Opcional)
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                      </label>
                      <p className="text-[10px] text-gray-400">JPG o PNG de máximo 2MB</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre completo o apodo</label>
                    <input
                      type="text"
                      required
                      value={elderName}
                      onChange={(e) => setElderName(e.target.value)}
                      placeholder="Ej. Mamá Elena / Abuelo Carlos"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Año de nacimiento</label>
                      <input
                        type="number"
                        value={birthYear}
                        onChange={(e) => setBirthYear(e.target.value)}
                        placeholder="1950"
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Hermanos / Círculo</label>
                      <input
                        type="number"
                        value={siblingsCount}
                        onChange={(e) => setSiblingsCount(e.target.value)}
                        placeholder="2"
                        className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                      />
                    </div>
                  </div>
                </div>

                {/* Sección 3: Colaboradores Familiares (Estilo Duolingo) */}
                <div className="space-y-3 pt-1">
                  <span className="text-xs font-bold text-[#0D7A5F] uppercase tracking-wider">
                    👥 Colaboradores Familiares
                  </span>
                  <p className="text-[11px] text-gray-500">Añade correos de hermanos o parientes para compartir recuerdos juntos.</p>
                  
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newCollaborator}
                      onChange={(e) => setNewCollaborator(e.target.value)}
                      placeholder="familiar@correo.com"
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCollaborator}
                      className="px-3 py-2 bg-[#E8F5E9] text-[#0D7A5F] font-bold text-xs rounded-xl hover:bg-[#D4EDDA]"
                    >
                      + Añadir
                    </button>
                  </div>

                  {collaborators.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {collaborators.map((c, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-[#F4FBF7] p-2 rounded-lg text-xs">
                          <span className="text-gray-700">✉️ {c}</span>
                          <span className="text-[10px] text-[#0D7A5F] font-bold">Invitado</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cuidadora@correo.com"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Contraseña</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="mt-3">
              {authMode === "register" ? "Completar Registro Familiar" : "Ingresar a Ayni"}
            </Button>
          </form>

          <button
            onClick={() => setAuthMode(authMode === "register" ? "login" : "register")}
            className="text-xs text-[#0D7A5F] font-semibold text-center hover:underline"
          >
            {authMode === "register"
              ? "¿Ya tienes cuenta? Inicia sesión aquí"
              : "¿No tienes cuenta? Regístrate aquí"}
          </button>
        </div>
      )}
    </div>
  );
};

