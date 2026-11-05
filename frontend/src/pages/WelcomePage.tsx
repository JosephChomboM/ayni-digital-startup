import React, { useState } from "react";
import { AyniIcon } from "../components/AyniIcon";
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

export const WelcomePage: React.FC<WelcomePageProps> = ({
  onLoginClick,
  onRegisterClick,
  onLoginSuccess,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [memoryType, setMemoryType] = useState<"story" | "song">("story");
  const handleLogin = () => {
    if (onLoginClick) onLoginClick();
    else if (onLoginSuccess) onLoginSuccess(MOCK_USER);
  };

  const handleRegister = () => {
    if (onRegisterClick) onRegisterClick();
    else if (onLoginSuccess) onLoginSuccess(MOCK_USER);
  };

  return (
    <div className="ayni-welcome min-h-screen overflow-x-clip bg-white text-[#264653] flex flex-col justify-between">
      {/* BARRA SUPERIOR PÚBLICA */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-3 sm:px-8">
        <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <img src="/favicon.svg" width="40" height="40" alt="" className="shrink-0" />
            <div>
              <p className="text-base font-extrabold tracking-tight text-[#2c5f7c] sm:text-lg">Ayni Digital</p>
              <p className="hidden text-xs text-gray-500 sm:block">Recuerdos que nos acercan</p>
            </div>
          </div>

          <nav aria-label="Secciones de Ayni" className="hidden items-center gap-5 text-sm font-medium text-gray-600 xl:flex">
            <a href="#como-funciona" className="hover:text-[#2c5f7c]">Cómo funciona</a>
            <a href="#pensado-para-ti" className="hover:text-[#2c5f7c]">Pensado para ti</a>
            <a href="#plan-title" className="hover:text-[#2c5f7c]">Plan</a>
            <a href="#preguntas" className="hover:text-[#2c5f7c]">Preguntas</a>
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
              className="bg-[#b94c35] hover:bg-[#9e3f2c] text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Crear cuenta
            </Button>
          </div>
          <div className="flex shrink-0 items-center gap-2 xl:hidden">
            <Button size="sm" onClick={handleRegister} className="min-h-11 rounded-xl bg-[#b94c35] px-3 text-xs font-bold text-white hover:bg-[#9e3f2c] sm:hidden">Crear cuenta</Button>
            <button type="button" aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="grid size-11 place-items-center rounded-xl border border-gray-200 text-[#2c5f7c]">
              {mobileMenuOpen ? <AyniIcon name="close" className="size-5"/> : <AyniIcon name="menu" className="size-5"/>}
            </button>
          </div>
          {mobileMenuOpen && <nav aria-label="Secciones de Ayni para móvil" className="absolute inset-x-0 top-full z-40 mt-3 grid gap-1 rounded-2xl border border-gray-200 bg-white p-3 text-sm font-medium text-gray-700 shadow-lg xl:hidden">
            {[["Cómo funciona", "#como-funciona"], ["Pensado para ti", "#pensado-para-ti"], ["Plan familiar", "#plan-title"], ["Preguntas frecuentes", "#preguntas"]].map(([label, href]) => <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 hover:bg-gray-50 hover:text-[#2c5f7c]">{label}</a>)}
            <button type="button" onClick={() => { setMobileMenuOpen(false); handleLogin(); }} className="rounded-lg px-3 py-3 text-left font-semibold text-[#2c5f7c] hover:bg-gray-50">Iniciar sesión</button>
          </nav>}
        </div>
      </header>

      {/* HÉROE PRINCIPAL UNIFORME Y ELEGANTE */}
      <main className="mx-auto w-full max-w-7xl space-y-12 px-4 py-8 sm:space-y-16 sm:px-8 sm:py-10">
        <section className="ayni-intro" aria-labelledby="welcome-title">
          <h1 id="welcome-title">Cuidar la memoria de quienes <span>más queremos</span></h1>
          <div className="ayni-intro-bottom">
            <p>Reúne sus anécdotas y canciones favoritas en un espacio familiar. Encuentra una historia para conversar, escuchar y compartir sin apuro.</p>
            <div className="ayni-actions"><Button onClick={handleRegister}>Crear cuenta de la familia <AyniIcon name="arrow" /></Button><a href="#como-funciona">Conocer Ayni <AyniIcon name="down" /></a></div>
          </div>
        </section>

        <figure className="ayni-family-photo">
          <img src="/images/recuerdos.jpg" width="612" height="408" alt="Un abuelo y dos nietos miran un álbum juntos al aire libre" fetchPriority="high" />
          <figcaption>Un momento para compartir historias.<span>Fotografía ilustrativa; no representa a usuarios de Ayni.</span></figcaption>
        </figure>

        <section id="como-funciona" className="scroll-mt-24 space-y-6" aria-labelledby="example-title">
          <div className="ayni-section-heading"><h2 id="example-title">Un recuerdo puede abrir una conversación</h2><p>Así se ven una anécdota y una canción en Ayni. El contenido es ilustrativo y puedes cambiar entre ambos.</p></div>
          <figure className="ayni-product" aria-label="Ejemplo de recuerdos familiares en Ayni">
            <div className="ayni-product-bar"><span><AyniIcon name="album" /> Recuerdos de la familia</span><span>Ejemplo ilustrativo</span></div>
            <div className="ayni-product-body">
              <div className="ayni-memory-types" role="group" aria-label="Tipo de recuerdo de ejemplo">
                <button aria-pressed={memoryType === "story"} onClick={() => setMemoryType("story")}><AyniIcon name="story" />Anécdota</button>
                <button aria-pressed={memoryType === "song"} onClick={() => setMemoryType("song")}><AyniIcon name="song" />Canción</button>
              </div>
              <article className="ayni-memory" aria-live="polite">
                <h3>{memoryType === "story" ? "Los domingos en casa" : "La canción de la sobremesa"}</h3>
                <p>{memoryType === "story" ? "Los domingos nos reuníamos para almorzar en casa. Cada quien llevaba algo y la mesa se llenaba de historias. Después, nos quedábamos conversando hasta la tarde." : "Después del almuerzo, mi mamá ponía su canción favorita. Decía que le recordaba sus paseos de juventud y siempre la cantaba bajito."}</p>
                <p className="ayni-question">{memoryType === "story" ? "¿Qué era lo que más te gustaba de esos domingos?" : "¿Qué canción les gustaría volver a escuchar juntos?"}</p>
              </article>
            </div>
            <figcaption>Vista de ejemplo de Ayni, sin datos de una familia real. En tu cuenta puedes guardar anécdotas y enlaces de canciones; las fotos aún no están disponibles.</figcaption>
          </figure>
        </section>

        <section id="pensado-para-ti" className="ayni-companion scroll-mt-24" aria-labelledby="companion-title">
          <div><h2 id="companion-title">Acompañar, a su propio ritmo</h2><p>La persona cuidadora prepara los recuerdos y puede invitar a familiares para sumar sus historias, aunque estén lejos.</p><p>La guía de ejemplo ofrece preguntas sencillas. Si un recuerdo incomoda, pueden cambiar de tema, hacer una pausa o terminar.</p><Button onClick={handleRegister}>Crear cuenta de la familia <AyniIcon name="arrow" /></Button></div>
          <div className="ayni-guide-example"><h3>Una pregunta para empezar</h3><p>¿Qué lugar recuerdas con cariño?</p><p>Escuchen lo que la persona quiera contar. No hace falta recordar fechas ni responder todo.</p><small>Ejemplo de la guía · Acompañamiento familiar sin función clínica.</small></div>
        </section>

        <section id="plan-title" aria-labelledby="plan-heading" className="relative -mx-4 scroll-mt-24 sm:-mx-8 bg-[#17232d] px-4 py-12 text-white sm:px-8 sm:py-16">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-3"><h2 id="plan-heading" className="text-3xl font-semibold">Un plan mensual, recuerdos para compartir</h2><p className="text-base leading-relaxed text-white/75">Actualmente puedes guardar anécdotas y enlaces de canciones. Las fotos y el registro de sesiones todavía no están disponibles.</p><ul className="space-y-2 text-sm leading-relaxed text-white/80"><li>• Espacio familiar para reunir anécdotas y canciones significativas.</li><li>• Guía de ejemplo para conversar, con opción de pausar o terminar.</li><li>• Preguntas para conversar sobre cómo se sintió la persona al finalizar.</li></ul></div>
            <div className="flex shrink-0 flex-col items-start gap-4 lg:items-end"><p className="text-4xl font-bold">S/ 19.90 <span className="text-base font-medium text-white/70">al mes</span></p><Button onClick={handleRegister} className="min-h-12 bg-[#b94c35] px-6 text-base font-semibold text-white hover:bg-[#9e3f2c]">Crear cuenta <AyniIcon name="arrow" className="ml-2 size-4"/></Button><p className="max-w-xs text-xs text-white/60 lg:text-right">Gestiona el Plan Familia desde tu cuenta. Los pagos están en modo de prueba.</p></div>
          </div>
        </section>

        <section id="preguntas" aria-labelledby="faq-heading" className="scroll-mt-24 space-y-6 py-4">
          <div><h2 id="faq-heading" className="mt-1 text-2xl font-bold text-[#2c5f7c]">Preguntas frecuentes</h2></div>
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {[
              ["¿Ayni reemplaza una atención médica?", "No. Ayni es una herramienta familiar para compartir recuerdos; no diagnostica ni sustituye atención profesional."],
              ["¿Quién puede aportar recuerdos?", "La persona cuidadora puede invitar a familiares para sumar anécdotas y enlaces de canciones. Las fotos todavía no están disponibles."],
              ["¿Cuánto dura una sesión?", "Pueden explorar la guía de ejemplo a su ritmo, hacer pausas o terminar cuando quieran. Esta guía no guarda sesiones ni reacciones."],
              ["¿Qué hacemos si un recuerdo incomoda?", "Pueden cambiar de tema, guardar el recuerdo para después o detener la sesión. El bienestar de la persona es lo primero."],
              ["¿Cómo funciona el pago?", "El Plan Familia cuesta S/ 19.90 al mes. La pasarela funciona en modo de prueba, sin cobros reales."],
            ].map(([question, answer]) => <details key={question} className="group py-4"><summary className="flex cursor-pointer list-none min-h-11 items-center justify-between gap-4 text-base font-semibold text-[#264653]">{question}<AyniIcon name="down" className="size-5 shrink-0 transition group-open:rotate-180"/></summary><p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">{answer}</p></details>)}
          </div>
        </section>

        {/* IMPACTO SOCIAL & ODS */}
        <section id="impacto" className="scroll-mt-24 space-y-8 py-8">
          <div className="max-w-3xl space-y-3">
            <div>
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


      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#2c5f7c]/10 bg-white/50 py-6 px-4 text-center text-xs text-gray-500 space-y-2">
        <p>© 2026 Ayni Digital • Proyecto Final de Carrera (USIL)</p>
        <p className="text-sm text-gray-600 max-w-2xl mx-auto">
          Ayni Digital no es un servicio de salud ni realiza diagnósticos ni evaluaciones clínicas. Es una herramienta de acompañamiento y reminiscencia informal familiar.
        </p>
      </footer>
    </div>
  );
};
