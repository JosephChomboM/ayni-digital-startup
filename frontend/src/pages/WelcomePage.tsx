import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Heart, Image, Music2, BookOpen, ShieldCheck, MessageCircle, Check, Menu, X } from "lucide-react";
import type { User } from "../api/auth";
import { Brand } from "../components/Brand";
import { AyniCompanion } from "../components/AyniCompanion";

interface WelcomePageProps { onLoginClick?: () => void; onRegisterClick?: () => void; onLoginSuccess?: (user: User) => void }
const examples = {
  photo: { title: "Ese paseo que siempre recordamos", question: "¿Qué era lo que más disfrutabas de esos paseos?", image: "/images/recuerdos.jpg", label: "Una foto" },
  song: { title: "La canción de las tardes en casa", question: "¿Qué canción te gustaría volver a escuchar en familia?", image: "/images/propio-ritmo.avif", label: "Una canción" },
  anecdote: { title: "Los domingos alrededor de la mesa", question: "¿Qué te gustaba compartir después del almuerzo?", image: "/images/familia-participa.jpg", label: "Una historia" },
};
export function WelcomePage({ onLoginClick, onRegisterClick }: WelcomePageProps) {
  const [year] = useState(() => new Date().getFullYear());
  const [menu, setMenu] = useState(false);
  const [example, setExample] = useState<keyof typeof examples>("photo");
  const journeyGridRef = useRef<HTMLDivElement>(null);
  const sample = examples[example];
  useEffect(() => {
    const grid = journeyGridRef.current;
    if (!grid || typeof IntersectionObserver === "undefined") return;

    const cards = grid.querySelectorAll<HTMLElement>(".journey-card");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -32px 0px" });

    grid.classList.add("journey-grid--reveal");
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);
  return <div className="welcome-page">
    <header className="public-header"><a href="#inicio" aria-label="Ayni, inicio"><Brand /></a>
      <nav className="public-links" aria-label="Secciones de Ayni"><a href="#como-funciona">Cómo funciona</a><a href="#conoce-ayni">Conoce a Ayni</a><a href="#preguntas">Preguntas</a></nav>
      <div className="public-actions"><button className="text-action" onClick={onLoginClick}>Iniciar sesión</button><button className="primary-action" onClick={onRegisterClick}>Crear cuenta <ArrowUpRight size={17}/></button></div>
      <button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label={menu ? "Cerrar menú" : "Abrir menú"} aria-expanded={menu}>{menu ? <X/> : <Menu/>}</button>
      {menu && <nav className="public-mobile-menu" aria-label="Menú móvil"><a href="#como-funciona" onClick={() => setMenu(false)}>Cómo funciona</a><a href="#conoce-ayni" onClick={() => setMenu(false)}>Conoce a Ayni</a><button onClick={onLoginClick}>Iniciar sesión</button><button onClick={onRegisterClick}>Crear cuenta</button></nav>}
    </header>
    <main id="inicio">
      <section className="landing-hero">
        <div className="hero-copy"><p className="eyebrow"><span className="little-sun"/> PARA LOS MOMENTOS QUE IMPORTAN</p>
          <h1>Hay recuerdos<br/>que nos hacen<br/><em>volver a estar cerca.</em></h1>
          <p className="hero-description">Una foto, su canción favorita, una historia de siempre. Ayni les ayuda a convertirlas en nuevas conversaciones en familia.</p>
          <div className="hero-actions"><button className="primary-action" onClick={onRegisterClick}>Empezar nuestra historia <ArrowRight size={19}/></button><a href="#conoce-ayni" className="text-action">Descubrir Ayni <span>↗</span></a></div>
          <p className="hero-note"><ShieldCheck size={17}/> Tus recuerdos, en un espacio privado.</p>
        </div>
        <div className="hero-collage">
          <span className="collage-orbit" aria-hidden="true"/>
          <figure className="hero-photo"><img src="/images/recuerdos.jpg" alt="Un abuelo y sus nietos comparten un álbum de fotografías" fetchPriority="high"/><figcaption><Heart size={16}/> Las historias más bonitas son las nuestras.</figcaption></figure>
          <div className="memory-sticker"><Music2/><div><strong>Su canción favorita</strong><span>Un buen comienzo para conversar</span></div><span className="mini-wave" aria-hidden="true"><i/><i/><i/><i/></span></div>
          <div className="hero-companion"><AyniCompanion decorative/><p>Hola, soy <strong>Ayni.</strong><br/>¿Conversamos?</p></div>
          <Heart className="collage-heart" aria-hidden="true" />
        </div>
      </section>
      <div className="landing-ribbon"><span><Image size={20}/> Fotos que cuentan</span><i/><span><Music2 size={20}/> Canciones que conectan</span><i/><span><BookOpen size={20}/> Historias que acompañan</span></div>
      <section className="landing-section" id="como-funciona">
        <div className="section-heading"><div><p className="eyebrow">TAN SENCILLO COMO ESTAR JUNTOS</p><h2>Un pequeño momento.<br/><em>Una gran conexión.</em></h2></div><p>No hace falta preparar un discurso ni recordar cada fecha. Solo traer un recuerdo y las ganas de escucharse.</p></div>
        <div className="journey-grid" ref={journeyGridRef}>
          {[{icon: Image,title:"Reúnan sus recuerdos",text:"Suban una foto, escriban una anécdota o compartan el enlace de una canción.",color:"peach"}, {icon:MessageCircle,title:"Dejen que fluya",text:"Ayni propone preguntas a partir de sus recuerdos y sigue el hilo de la conversación.",color:"sage"}, {icon:Heart,title:"Guarden cómo les fue",text:"Al terminar, registren la reacción y compartan este pequeño momento con la familia.",color:"butter"}].map(({icon:Icon,title,text,color},i)=><article className={`journey-card ${color}`} key={title}><div><Icon size={30} strokeWidth={1.7}/><span>0{i+1}</span></div><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>
      <section className="companion-intro" id="conoce-ayni">
        <div className="companion-copy"><p className="eyebrow">UN COMPAÑERO PARA CONVERSAR</p><h2>Conoce a Ayni.<br/><em>Siempre a su ritmo.</em></h2><p>Un acompañante con inteligencia artificial que escucha lo que cuentan, hace una pregunta a la vez y les ayuda a explorar sus recuerdos.</p><ul><li><Check size={18}/> Hablen o escriban, como prefieran.</li><li><Check size={18}/> Elijan el recuerdo o pidan una sugerencia.</li><li><Check size={18}/> Pausen cuando quieran, sin apuro.</li></ul><button className="primary-action" onClick={onRegisterClick}>Quiero conocerlo <ArrowUpRight size={18}/></button></div>
        <div className="preview-session"><div className="preview-top"><span className="status-dot"/> Un vistazo a una sesión <small>Ejemplo ilustrativo</small></div><div className="preview-stage"><AyniCompanion decorative/><div className="preview-bubble">{sample.question}</div></div><div className="example-picker" role="group" aria-label="Explorar ejemplos de recuerdos">{Object.entries(examples).map(([key,value])=><button key={key} aria-pressed={key===example} onClick={()=>setExample(key as keyof typeof examples)}>{value.label}</button>)}</div><figure className="sample-memory"><img src={sample.image} alt="Escena familiar ilustrativa" loading="lazy"/><figcaption><small>EL RECUERDO QUE NOS REÚNE</small><strong>{sample.title}</strong></figcaption></figure></div>
      </section>
      <section className="landing-section family-promise"><div className="promise-photo"><img src="/images/familia-participa.jpg" alt="Familia reunida alrededor de una persona mayor" loading="lazy"/><span>Estar presentes.<br/>Incluso desde lejos.</span></div><div><p className="eyebrow">HECHO PARA TU FAMILIA</p><h2>Lo importante<br/>es <em>compartirlo.</em></h2><p>Cada familiar puede aportar una historia. Juntos construyen un lugar para volver a las cosas que les gusta recordar.</p><div className="promise-points"><span><ShieldCheck/> Recuerdos privados</span><span><Heart/> Sin respuestas correctas</span><span><BookOpen/> A su propio ritmo</span></div></div></section>
      <section className="landing-section faq-section" id="preguntas"><div><p className="eyebrow">ANTES DE EMPEZAR</p><h2>¿Conversamos<br/><em>un poquito más?</em></h2></div><div>{[
        ["¿Qué necesito para empezar?","Crea tu cuenta, completa el perfil familiar y comparte un recuerdo positivo. Puedes empezar escribiendo, sin cámara ni micrófono."],
        ["¿Ayni reemplaza la atención de un profesional?","No. Ayni facilita conversaciones y actividades familiares. No es un servicio de salud ni realiza diagnósticos. Si tu familiar tiene un diagnóstico de demencia, consulta con su médico antes de empezar."],
        ["¿Tengo que activar la cámara?","Es opcional. Al permitirla y pedirle a Ayni que mire algo, se comparte una captura con Groq. Puedes apagarla en cualquier momento."],
        ["¿Puedo probarlo gratis?","Sí, existe un plan gratuito para comenzar. El Plan Familia cuesta S/ 19.90 al mes. Actualmente los pagos son de prueba: no se realizan cobros reales."],
      ].map(([title,text])=><details key={title}><summary>{title}<span aria-hidden="true">+</span></summary><p>{text}</p></details>)}</div></section>
      <section className="closing-invitation"><span className="eyebrow">LAS MEJORES HISTORIAS YA LAS TIENEN</span><h2>Hoy puede empezar<br/>otra bonita conversación.</h2><button className="light-action" onClick={onRegisterClick}>Crear nuestro espacio <ArrowRight size={18}/></button><span className="invitation-flower" aria-hidden="true">✳</span></section>
    </main>
    <footer className="public-footer"><Brand/><p>Acompañamos momentos familiares.<br/>Ayni no es un servicio de salud.</p><span>Hecho con cariño en Perú.<br/>© {year} Ayni Digital</span></footer>
  </div>;
}
