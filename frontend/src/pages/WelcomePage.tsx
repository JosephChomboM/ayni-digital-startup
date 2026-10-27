import React, { useState, useEffect } from "react";
import {
  Heart,
  Sparkles,
  ArrowRight,
  Image,
  Smile,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "../components/ui/button";
import type { User } from "../api/auth";

interface WelcomePageProps {
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onLoginSuccess?: (user: User) => void;
}

const MOCK_USER: User = {
  id: "demo-user-1",
  email: "demo@ayni.pe",
  name: "Cuidador Ayni",
  family_id: "demo-family-1",
  role: "cuidador_principal",
  created_at: "2026-10-27T00:00:00.000Z",
};

const CAROUSEL_ITEMS = [
  {
    type: "image",
    url: "https://images.unsplash.com/photo-1544027993-37dbfe43562a?auto=format&fit=crop&q=80&w=800",
    title: "Familia compartiendo en la Plaza Mayor",
    subtitle: "Recordando paseos y vivencias familiares en Lima",
  },
  {
    type: "quote",
    quote: "“Recordar juntos sus canciones preferidas ha devuelto las sonrisas de los domingos a nuestra casa.”",
    author: "María T. · Cuidadora en Lima",
  },
  {
    type: "image",
    url: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&q=80&w=800",
    title: "Don Carlos conversando con su nieto",
    subtitle: "Reconociendo fotos de su primer trabajo",
  },
  {
    type: "quote",
    quote: "“Ayni Digital nos dio una forma sencilla y llena de cariño para conectar en familia sin presiones.”",
    author: "Jorge L. · Familiar en Surco",
  },
];

export const WelcomePage: React.FC<WelcomePageProps> = ({
  onLoginClick,
  onRegisterClick,
  onLoginSuccess,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % CAROUSEL_ITEMS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % CAROUSEL_ITEMS.length);
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + CAROUSEL_ITEMS.length) % CAROUSEL_ITEMS.length);
  };

  const handleLogin = () => {
    if (onLoginClick) onLoginClick();
    else if (onLoginSuccess) onLoginSuccess(MOCK_USER);
  };

  const handleRegister = () => {
    if (onRegisterClick) onRegisterClick();
    else if (onLoginSuccess) onLoginSuccess(MOCK_USER);
  };

  return (
    <div className="min-h-screen bg-[#f1faee] text-[#264653] flex flex-col justify-between">
      {/* BARRA SUPERIOR PÚBLICA */}
      <header className="sticky top-0 z-30 border-b border-[#2c5f7c]/10 bg-[#f1faee]/90 backdrop-blur-md px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex size-10 items-center justify-center rounded-2xl bg-[#2c5f7c] text-white shadow-sm">
              <Heart className="size-5 fill-current text-[#e76f51]" />
              <span className="absolute -right-1 -top-1 size-3 rounded-full bg-[#e9c46a]" />
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-tight text-[#2c5f7c]">Ayni Digital</p>
              <p className="hidden text-xs text-gray-500 sm:block">Recuerdos que nos acercan</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogin}
              className="border-[#2c5f7c]/30 text-[#2c5f7c] hover:bg-[#2c5f7c]/10 font-bold text-xs rounded-xl"
            >
              Iniciar sesión
            </Button>
            <Button
              size="sm"
              onClick={handleRegister}
              className="bg-[#e76f51] hover:bg-[#d65d3f] text-white font-bold text-xs rounded-xl shadow-sm"
            >
              Crear cuenta
            </Button>
          </div>
        </div>
      </header>

      {/* HÉROE PRINCIPAL UNIFORME Y ELEGANTE */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-8 space-y-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#e9c46a]/30 border border-[#e9c46a]/50 px-3.5 py-1 text-xs font-bold text-[#264653]">
              <Sparkles className="size-3.5 text-[#e76f51]" />
              <span>Estimulación cognitiva por reminiscencia en casa</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight text-[#2c5f7c] tracking-tight">
              Cuidar la memoria de quienes <span className="text-[#e76f51]">más queremos</span>
            </h1>

            <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl">
              Transformamos las fotos de la juventud, las anécdotas de trabajo y sus canciones o boleros favoritos en guías breves para compartir en familia y coordinar cómodamente desde casa.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                onClick={handleRegister}
                className="bg-[#e76f51] hover:bg-[#d65d3f] text-white font-bold text-sm py-3 px-8 rounded-2xl shadow-lg shadow-[#e76f51]/25 transition-all"
              >
                Comenzar gratis <ArrowRight className="size-4 ml-2" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleLogin}
                className="border-[#2c5f7c]/20 bg-white text-[#2c5f7c] hover:bg-gray-50 font-bold text-sm py-3 px-6 rounded-2xl"
              >
                Ya tengo una cuenta
              </Button>
            </div>

            <p className="text-xs text-gray-500 pt-1 flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-[#2c5f7c]" />
              <span>Diseñado para familias sin necesidad de formación médica.</span>
            </p>
          </div>

          {/* CARRUSEL EMOTIVO */}
          <div className="lg:col-span-5 relative rounded-3xl bg-gradient-to-br from-[#2c5f7c] via-[#264653] to-[#3d7896] p-6 text-white shadow-2xl h-[360px] flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between z-10">
              <span className="text-xs font-bold text-[#e9c46a] uppercase tracking-wider">
                Momentos Ayni Digital
              </span>
              <div className="p-2 rounded-full bg-white/10">
                <Heart className="size-5 fill-current text-[#e76f51]" />
              </div>
            </div>

            <div className="relative my-auto flex-1 flex items-center justify-center text-center px-2 transition-all duration-500">
              {CAROUSEL_ITEMS[currentSlide].type === "image" ? (
                <div className="space-y-3 animate-fade-in w-full">
                  <div className="relative h-44 w-full overflow-hidden rounded-2xl border-2 border-white/20 shadow-lg">
                    <img
                      src={CAROUSEL_ITEMS[currentSlide].url}
                      alt="Familia en Lima"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{CAROUSEL_ITEMS[currentSlide].title}</p>
                    <p className="text-xs text-white/80">{CAROUSEL_ITEMS[currentSlide].subtitle}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in my-auto">
                  <p className="text-xl sm:text-2xl font-serif italic text-white/95 leading-relaxed">
                    {CAROUSEL_ITEMS[currentSlide].quote}
                  </p>
                  <p className="text-xs font-bold text-[#e9c46a] uppercase tracking-wide">
                    {CAROUSEL_ITEMS[currentSlide].author}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/20 pt-3 z-10">
              <div className="flex gap-1.5">
                {CAROUSEL_ITEMS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2 rounded-full transition-all ${
                      currentSlide === idx ? "w-6 bg-[#e9c46a]" : "w-2 bg-white/40"
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePrev}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={handleNext}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN CÓMO FUNCIONA */}
        <section className="space-y-8 pt-6 border-t border-gray-200/80">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#e76f51]">¿Cómo funciona Ayni?</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#2c5f7c]">El poder de la memoria afectiva</h2>
            <p className="text-xs sm:text-sm text-gray-600">
              No necesitas ser un especialista. Ayni organiza tus recuerdos para que disfrutes momentos significativos con tu familiar en 3 sencillos pasos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <div className="size-10 rounded-xl bg-[#2c5f7c]/10 text-[#2c5f7c] flex items-center justify-center font-bold">
                1
              </div>
              <h3 className="font-bold text-base text-[#264653] flex items-center gap-2">
                <Image className="size-4 text-[#e76f51]" /> Suben sus recuerdos
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Nietos e hijos comparten fotos de la juventud, notas escritas y música mediante enlaces sencillos.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <div className="size-10 rounded-xl bg-[#e9c46a]/30 text-[#264653] flex items-center justify-center font-bold">
                2
              </div>
              <h3 className="font-bold text-base text-[#264653] flex items-center gap-2">
                <Clock className="size-4 text-[#2c5f7c]" /> Guía de 15 minutos
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Genera automáticamente una sesión guiada con preguntas disparadoras fáciles para entablar una conversación amena.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <div className="size-10 rounded-xl bg-[#e76f51]/10 text-[#e76f51] flex items-center justify-center font-bold">
                3
              </div>
              <h3 className="font-bold text-base text-[#264653] flex items-center gap-2">
                <Smile className="size-4 text-[#e76f51]" /> Registro de emociones
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Anota con un clic si la persona estuvo receptiva o emocionada, compartiendo los avances con el resto de la familia.
              </p>
            </div>
          </div>
        </section>

        {/* BENEFICIOS */}
        <section className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-10 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#e76f51]">Pensado para ti</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#2c5f7c]">¿Por qué acompañar con Ayni Digital?</h2>
            <div className="space-y-3 text-xs text-gray-600">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-4 text-[#2c5f7c] shrink-0 mt-0.5" />
                <p><strong>Cero sobrecarga para el cuidador:</strong> Pantallas muy simples, texto claro sin términos médicos complicados.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-4 text-[#2c5f7c] shrink-0 mt-0.5" />
                <p><strong>Involucra a toda la familia:</strong> Los familiares pueden unirse a distancia para aportar recuerdos comunitarios.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-4 text-[#2c5f7c] shrink-0 mt-0.5" />
                <p><strong>Respeto y pausado ético:</strong> La app detecta si la persona no se siente bien y te recomienda pausar la actividad.</p>
              </div>
            </div>

            <Button
              onClick={handleRegister}
              className="bg-[#2c5f7c] hover:bg-[#224a61] text-white font-bold text-xs py-2.5 px-6 rounded-xl mt-2"
            >
              Crear cuenta de la familia
            </Button>
          </div>

          <div className="bg-[#f1faee] p-6 rounded-2xl border border-[#2c5f7c]/20 space-y-4 text-center">
            <div className="inline-flex p-3 bg-white rounded-2xl shadow-sm text-[#e76f51]">
              <Heart className="size-8 fill-current" />
            </div>
            <h3 className="font-bold text-base text-[#2c5f7c]">"No es solo recordar el pasado, es conectar en el presente."</h3>
            <p className="text-xs text-gray-500 italic">
              Diseñado en Lima para acompañar con cariño a quienes cuidamos en casa.
            </p>
          </div>
        </section>

        {/* IMPACTO SOCIAL & ODS */}
        <section className="rounded-3xl bg-white p-8 border border-gray-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <span className="text-2xl">🌍</span>
            <div>
              <h3 className="text-base font-bold text-[#2c5f7c]">Impacto Social & Objetivos de Desarrollo Sostenible (ODS)</h3>
              <p className="text-xs text-gray-500">Ayni Digital impulsa dos pilares de las Naciones Unidas para las familias en Lima Metropolitana</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#f1faee] p-5 rounded-2xl border border-[#4C9F38]/30 flex flex-col sm:flex-row items-start gap-4">
              <div className="size-20 bg-[#4C9F38] text-white rounded-xl shrink-0 p-2 flex flex-col justify-between shadow-sm border border-[#4C9F38]">
                <span className="text-[10px] font-black uppercase tracking-wider">ODS 3</span>
                <div className="space-y-0.5">
                  <p className="text-xs font-black leading-none">SALUD</p>
                  <p className="text-[9px] font-semibold leading-none opacity-90">& BIENESTAR</p>
                </div>
              </div>
              <div className="space-y-1.5 flex-1">
                <h4 className="text-xs font-bold text-[#264653] uppercase tracking-wide">
                  Salud y Bienestar
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Promoción del bienestar emocional y estímulo cognitivo del adulto mayor, reduciendo el agotamiento emocional en las cuidadoras informales.
                </p>
              </div>
            </div>

            <div className="bg-[#f1faee] p-5 rounded-2xl border border-[#DD1367]/30 flex flex-col sm:flex-row items-start gap-4">
              <div className="size-20 bg-[#DD1367] text-white rounded-xl shrink-0 p-2 flex flex-col justify-between shadow-sm border border-[#DD1367]">
                <span className="text-[10px] font-black uppercase tracking-wider">ODS 10</span>
                <div className="space-y-0.5">
                  <p className="text-xs font-black leading-none">REDUCCIÓN DE</p>
                  <p className="text-[9px] font-semibold leading-none opacity-90">DESIGUALDADES</p>
                </div>
              </div>
              <div className="space-y-1.5 flex-1">
                <h4 className="text-xs font-bold text-[#264653] uppercase tracking-wide">
                  Reducción de las Desigualdades
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Herramienta digital accesible para familias que no cuentan con recursos para estimulación privada costosa en Lima.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#2c5f7c]/10 bg-white/50 py-6 px-4 text-center text-xs text-gray-500 space-y-2">
        <p>© 2026 Ayni Digital • Proyecto Final de Carrera (USIL)</p>
        <p className="text-[11px] text-gray-400 max-w-2xl mx-auto">
          Ayni Digital no es un servicio de salud ni realiza diagnósticos ni evaluaciones clínicas. Es una herramienta de acompañamiento y reminiscencia informal familiar.
        </p>
      </footer>
    </div>
  );
};
