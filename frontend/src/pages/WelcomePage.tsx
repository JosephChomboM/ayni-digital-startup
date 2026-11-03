import React, { useState, useEffect } from "react";
import {
  Heart,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
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
    url: "/images/recuerdos.jpg",
    title: "Familia compartiendo en la Plaza Mayor",
    subtitle: "Recordando paseos y vivencias familiares en Lima",
  },
  {
    url: "/images/guia-sesion.jpg",
    title: "Un recuerdo compartido en familia",
    subtitle: "Cada quien puede aportar una historia",
  },
  {
    url: "/images/emociones.jpg",
    title: "Un momento para escuchar",
    subtitle: "Cada emoción merece respeto y espacio",
  },
  {
    url: "/images/recuerdos.jpg",
    title: "Momentos cotidianos que nos acercan",
    subtitle: "Conversar juntos, con calma y a su ritmo",
  },
];

const FEATURE_CARDS = [
  { title: "Suben sus recuerdos", text: "Fotos, anécdotas y canciones que la familia puede compartir.", more: "Cada persona de la familia puede aportar una historia, el nombre de quienes aparecen en una foto o el recuerdo que acompaña una canción.", image: "/images/recuerdos.jpg" },
  { title: "Guía de 15 minutos", text: "Una conversación breve, con preguntas sencillas y sin apuro.", more: "La guía propone una pregunta a la vez. Pueden conversar, hacer una pausa o terminar cuando la persona lo prefiera.", image: "/images/guia-sesion.jpg" },
  { title: "Registro de emociones", text: "Anota cómo se sintió la persona y comparte el momento con la familia.", more: "Al terminar, conversen sobre cómo se sintió. El registro persistente estará disponible cuando se conecte el servicio del backend.", image: "/images/emociones.jpg" },
];

export const WelcomePage: React.FC<WelcomePageProps> = ({
  onLoginClick,
  onRegisterClick,
  onLoginSuccess,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [benefitSlide, setBenefitSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const benefits = [
    { title: "Cero sobrecarga", text: "Pantallas sencillas y palabras claras para acompañar sin complicaciones.", image: "/images/cero-sobrecarga.jpg" },
    { title: "Toda la familia participa", text: "Tus familiares pueden aportar recuerdos aunque estén lejos.", image: "/images/familia-participa.jpg" },
    { title: "A su propio ritmo", text: "Si la persona se siente incómoda, hagan una pausa o cambien de tema.", image: "/images/propio-ritmo.jpg" },
  ];

  const handleLogin = () => {
    if (onLoginClick) onLoginClick();
    else if (onLoginSuccess) onLoginSuccess(MOCK_USER);
  };

  const handleRegister = () => {
    if (onRegisterClick) onRegisterClick();
    else if (onLoginSuccess) onLoginSuccess(MOCK_USER);
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-[#264653] flex flex-col justify-between">
      {/* BARRA SUPERIOR PÚBLICA */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-md px-4 py-3 sm:px-8">
        <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="relative flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[#2c5f7c] text-white shadow-sm sm:size-10">
              <Heart className="size-5 fill-current text-[#e76f51]" />
              <span className="absolute -right-1 -top-1 size-3 rounded-full bg-[#e9c46a]" />
            </div>
            <div>
              <p className="text-base font-extrabold tracking-tight text-[#2c5f7c] sm:text-lg">Ayni Digital</p>
              <p className="hidden text-xs text-gray-500 sm:block">Recuerdos que nos acercan</p>
            </div>
          </div>

          <nav aria-label="Secciones de Ayni" className="hidden items-center gap-5 text-sm font-medium text-gray-600 xl:flex">
            <a href="#como-funciona" className="hover:text-[#2c5f7c]">Cómo funciona</a>
            <a href="#pensado-para-ti" className="hover:text-[#2c5f7c]">Pensado para ti</a>
            <a href="#impacto" className="hover:text-[#2c5f7c]">Impacto</a>
            <a href="#preguntas" className="hover:text-[#2c5f7c]">Preguntas</a>
            <a href="#plan-title" className="hover:text-[#2c5f7c]">Plan</a>
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
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
          <div className="flex shrink-0 items-center gap-2 sm:hidden">
            <Button size="sm" onClick={handleRegister} className="h-9 rounded-xl bg-[#e76f51] px-3 text-xs font-bold text-white hover:bg-[#d65d3f]">Crear cuenta</Button>
            <button type="button" aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="grid size-9 place-items-center rounded-xl border border-gray-200 text-[#2c5f7c]">
              {mobileMenuOpen ? <X className="size-5"/> : <Menu className="size-5"/>}
            </button>
          </div>
          {mobileMenuOpen && <nav aria-label="Secciones de Ayni para móvil" className="absolute inset-x-0 top-full z-40 mt-3 grid gap-1 rounded-2xl border border-gray-200 bg-white p-3 text-sm font-medium text-gray-700 shadow-lg sm:hidden">
            {[["Cómo funciona", "#como-funciona"], ["Pensado para ti", "#pensado-para-ti"], ["Impacto", "#impacto"], ["Preguntas frecuentes", "#preguntas"], ["Plan familiar", "#plan-title"]].map(([label, href]) => <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 hover:bg-gray-50 hover:text-[#2c5f7c]">{label}</a>)}
            <button type="button" onClick={() => { setMobileMenuOpen(false); handleLogin(); }} className="rounded-lg px-3 py-3 text-left font-semibold text-[#2c5f7c] hover:bg-gray-50">Iniciar sesión</button>
          </nav>}
        </div>
      </header>

      {/* HÉROE PRINCIPAL UNIFORME Y ELEGANTE */}
      <main className="mx-auto w-full max-w-7xl space-y-12 px-4 py-8 sm:space-y-16 sm:px-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="space-y-6 text-left lg:col-span-7">
            <p className="text-base font-medium text-[#e76f51]">
              Estimulación cognitiva por reminiscencia en casa
            </p>

            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-[#2c5f7c] sm:text-6xl">
              Cuidar la memoria de quienes <span className="text-[#e76f51]">más queremos</span>
            </h1>

            <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl">
              Transformamos las fotos de la juventud, las anécdotas de trabajo y sus canciones o boleros favoritos en guías breves para compartir en familia y coordinar cómodamente desde casa.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-4">
              <a href="#plan-title" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#e76f51] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#e76f51]/20 transition-colors hover:bg-[#d65d3f]">
                Ver el plan <ArrowRight className="ml-2 size-4" />
              </a>
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
          <div aria-roledescription="carrusel" aria-label="Momentos Ayni Digital" className="relative isolate flex h-[280px] flex-col justify-end overflow-hidden rounded-2xl bg-gray-100 text-white sm:h-[380px] lg:col-span-5">
            <img key={CAROUSEL_ITEMS[currentSlide].url} src={CAROUSEL_ITEMS[currentSlide].url} alt="" className="absolute inset-0 -z-10 h-full w-full animate-fade-in object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
            <div aria-live="polite" className="space-y-1 px-6 pb-5">
              <p className="text-lg font-semibold">{CAROUSEL_ITEMS[currentSlide].title}</p>
              <p className="text-sm text-white/90">{CAROUSEL_ITEMS[currentSlide].subtitle}</p>
            </div>
            <div className="flex items-center justify-between px-6 pb-5">
              <div className="flex gap-2">
                {CAROUSEL_ITEMS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    aria-label={`Mostrar imagen ${idx + 1} de ${CAROUSEL_ITEMS.length}`}
                    aria-pressed={currentSlide === idx}
                    className={`h-2 rounded-full transition-all ${
                      currentSlide === idx ? "w-6 bg-white" : "w-2 bg-white/60"
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePrev}
                  aria-label="Imagen anterior"
                  className="grid size-9 place-items-center rounded-full bg-white/90 text-[#264653] transition-colors hover:bg-white"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={handleNext}
                  aria-label="Siguiente imagen"
                  className="grid size-9 place-items-center rounded-full bg-white/90 text-[#264653] transition-colors hover:bg-white"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN CÓMO FUNCIONA */}
        <section id="como-funciona" className="scroll-mt-24 space-y-8 pt-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#e76f51]">¿Cómo funciona Ayni?</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#2c5f7c]">El poder de la memoria afectiva</h2>
            <p className="text-xs sm:text-sm text-gray-600">
              No necesitas ser un especialista. Ayni organiza tus recuerdos para que disfrutes momentos significativos con tu familiar en 3 sencillos pasos.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {FEATURE_CARDS.map((item, index) => <article key={item.title} className="group">
              <div className="relative h-48 overflow-hidden rounded-2xl bg-[#f1faee] sm:h-56"><img src={item.image} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" loading="lazy"/><span className="absolute left-4 top-4 grid size-9 place-items-center rounded-full bg-white text-sm font-bold text-[#2c5f7c] shadow">0{index + 1}</span></div>
              <div className="space-y-2 py-4"><h3 className="text-lg font-bold text-[#264653]">{item.title}</h3><p className="text-sm leading-relaxed text-gray-600">{item.text}</p><details className="group/more pt-1"><summary className="inline-flex cursor-pointer list-none items-center text-sm font-semibold text-[#2c5f7c]">Saber más <ChevronDown className="ml-1 size-4 transition group-open/more:rotate-180"/></summary><p className="mt-2 text-sm leading-relaxed text-gray-600">{item.more}</p></details></div>
            </article>)}
          </div>
        </section>

        {/* BENEFICIOS */}
        <section id="pensado-para-ti" className="relative left-1/2 w-screen -translate-x-1/2 scroll-mt-24 bg-[#17232d] px-4 py-12 text-white sm:px-8 sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-center">
            <div className="space-y-5">
              <p className="text-sm font-semibold text-[#e9c46a]">Pensado para ti</p>
              <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">¿Por qué acompañar con Ayni Digital?</h2>
              <div aria-live="polite" className="min-h-32 space-y-3 py-2">
                <p className="text-2xl font-semibold">{benefits[benefitSlide].title}</p>
                <p className="max-w-lg text-base leading-relaxed text-white/80">{benefits[benefitSlide].text}</p>
                <div className="flex items-center gap-3 pt-2"><button aria-label="Beneficio anterior" onClick={() => setBenefitSlide((benefitSlide + benefits.length - 1) % benefits.length)} className="rounded-full border border-white/40 p-2 transition hover:bg-white/10"><ChevronLeft className="size-5"/></button><span className="text-sm text-white/70">{benefitSlide + 1} de {benefits.length}</span><button aria-label="Siguiente beneficio" onClick={() => setBenefitSlide((benefitSlide + 1) % benefits.length)} className="rounded-full border border-white/40 p-2 transition hover:bg-white/10"><ChevronRight className="size-5"/></button></div>
              </div>
              <Button onClick={handleRegister} className="min-h-11 bg-[#e76f51] px-5 text-white hover:bg-[#d65d3f]">Crear cuenta de la familia</Button>
            </div>
            <div className="relative min-h-[250px] overflow-hidden rounded-2xl bg-white/5 sm:min-h-[390px]">
              <img key={benefits[benefitSlide].image} src={benefits[benefitSlide].image} alt={benefits[benefitSlide].title} className="absolute inset-0 h-full w-full animate-fade-in object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <p className="absolute bottom-5 left-5 right-5 text-lg font-semibold">{benefits[benefitSlide].title}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl space-y-3 py-4 text-center">
          <p className="text-2xl font-medium leading-relaxed text-[#2c5f7c] sm:text-3xl">“No es solo recordar el pasado, es conectar en el presente.”</p>
          <p className="text-sm text-gray-500">Diseñado en Lima para acompañar con cariño a quienes cuidamos en casa.</p>
        </section>

        <section id="preguntas" aria-labelledby="faq-heading" className="scroll-mt-24 space-y-6 py-4">
          <div><p className="text-sm font-semibold text-[#e76f51]">Resolvemos tus dudas</p><h2 id="faq-heading" className="mt-1 text-2xl font-bold text-[#2c5f7c]">Preguntas frecuentes</h2></div>
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {[
              ["¿Ayni reemplaza una atención médica?", "No. Ayni es una herramienta familiar para compartir recuerdos; no diagnostica ni sustituye atención profesional."],
              ["¿Quién puede aportar recuerdos?", "La persona cuidadora puede invitar a familiares para sumar fotos, anécdotas y canciones."],
              ["¿Cuánto dura una sesión?", "La guía propone alrededor de 15 minutos. Pueden hacer pausas o terminar cuando quieran."],
              ["¿Qué hacemos si un recuerdo incomoda?", "Pueden cambiar de tema, guardar el recuerdo para después o detener la sesión. El bienestar de la persona es lo primero."],
              ["¿Cómo funciona el pago?", "El acceso se ofrece por un pago único de S/ 19.90. El cobro se habilitará cuando esté conectada la pasarela de pago."],
            ].map(([question, answer]) => <details key={question} className="group py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-[#264653]">{question}<ChevronDown className="size-5 shrink-0 transition group-open:rotate-180"/></summary><p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">{answer}</p></details>)}
          </div>
        </section>

        {/* IMPACTO SOCIAL & ODS */}
        <section id="impacto" className="scroll-mt-24 space-y-8 py-8">
          <div className="max-w-3xl space-y-3">
            <div>
              <p className="text-sm font-semibold text-[#e76f51]">Nuestro compromiso</p>
              <h2 className="text-2xl font-semibold text-[#2c5f7c] sm:text-3xl">Impacto social y Objetivos de Desarrollo Sostenible</h2>
              <p className="mt-2 text-base leading-relaxed text-gray-600">Ayni Digital acompaña a las familias y se inspira en dos objetivos de las Naciones Unidas.</p>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-2 md:gap-12">
            <article className="flex items-start gap-5 border-b border-gray-200 pb-7 md:border-b-0 md:border-r md:pb-0 md:pr-10">
              <a href="https://share.google/LoRB2g9gJcjAWnr6i" target="_blank" rel="noreferrer" aria-label="Ver imagen del ODS 3" className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-[#4C9F38] sm:size-28"><img src="/images/ods-3.jpg" alt="ODS 3: Salud y bienestar" loading="lazy" className="h-full w-full object-cover"/><span className="absolute inset-x-0 bottom-0 bg-[#4C9F38]/90 p-1.5 text-center text-xs font-bold text-white">ODS 3</span></a>
              <div className="space-y-2"><h3 className="text-lg font-semibold text-[#264653]">Salud y bienestar</h3><p className="text-sm leading-relaxed text-gray-600">Promovemos momentos de conexión y bienestar emocional en familia, respetando el ritmo de cada persona.</p></div>
            </article>
            <article className="flex items-start gap-5">
              <a href="https://share.google/hYJiBco3nknXAqCKk" target="_blank" rel="noreferrer" aria-label="Ver imagen del ODS 10" className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-[#DD1367] sm:size-28"><img src="/images/ods-10.jpg" alt="ODS 10: Reducción de las desigualdades" loading="lazy" className="h-full w-full object-cover"/><span className="absolute inset-x-0 bottom-0 bg-[#DD1367]/90 p-1.5 text-center text-xs font-bold text-white">ODS 10</span></a>
              <div className="space-y-2"><h3 className="text-lg font-semibold text-[#264653]">Reducción de las desigualdades</h3><p className="text-sm leading-relaxed text-gray-600">Buscamos que las familias puedan crear recuerdos compartidos con herramientas digitales sencillas y accesibles.</p></div>
            </article>
          </div>
        </section>

        <section aria-labelledby="plan-title" className="relative left-1/2 w-screen -translate-x-1/2 scroll-mt-24 bg-[#17232d] px-4 py-12 text-white sm:px-8 sm:py-16">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl space-y-3"><p className="text-sm font-semibold text-[#e9c46a]">Acceso familiar</p><h2 id="plan-title" className="text-3xl font-semibold">Un solo pago, recuerdos para compartir</h2><p className="text-base leading-relaxed text-white/75">El plan contempla acceso a las herramientas de Ayni para organizar recuerdos familiares y acompañar conversaciones.</p><ul className="space-y-2 text-sm leading-relaxed text-white/80"><li>• Espacio para reunir fotos, anécdotas y canciones significativas.</li><li>• Guía de conversación de aproximadamente 15 minutos, con opción de pausar o terminar.</li><li>• Registro para conversar sobre cómo se sintió la persona al finalizar.</li></ul></div>
            <div className="flex shrink-0 flex-col items-start gap-4 sm:items-end"><p className="text-4xl font-bold">S/ 19.90 <span className="text-base font-medium text-white/70">pago único</span></p><Button onClick={handleRegister} className="min-h-12 bg-[#e76f51] px-6 text-base font-semibold text-white hover:bg-[#d65d3f]">Crear cuenta <ArrowRight className="ml-2 size-4"/></Button><p className="max-w-xs text-xs text-white/60 sm:text-right">El cobro todavía no está habilitado. Falta definir límites del plan y conectar la pasarela.</p></div>
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
