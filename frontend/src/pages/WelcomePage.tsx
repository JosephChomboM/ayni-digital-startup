import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Heart, Image, Music2, BookOpen, ShieldCheck, Check, Menu, X, Play, Mail, Phone } from "lucide-react";
import type { User } from "../api/auth";
import { Brand } from "../components/Brand";
import { AyniCompanion } from "../components/AyniCompanion";

interface WelcomePageProps { onLoginClick?: () => void; onRegisterClick?: () => void; onLoginSuccess?: (user: User) => void }
const examples = {
  photo: { title: "Una foto puede abrir una historia", question: "¿Qué detalle de este momento recuerdas con cariño?", description: "Miren una imagen juntos. Ayni propone una pregunta sencilla para empezar a conversar sobre lo que esa foto significa para su familia.", image: "/images/recuerdos.jpg", label: "Fotos", mood: "curious" as const, color: "peach", emoji: "🖼️" },
  song: { title: "Una canción puede traer muchos recuerdos", question: "¿Qué te gustaría contarme de esta canción?", description: "Elijan una canción importante para ustedes y conversen sobre cuándo la escuchaban, quién la compartía o qué momento les trae a la memoria.", image: "/images/conociendo%20ayni/canciones/Escuchando%20m%C3%BAsica%20en%20familia.png", label: "Canciones", mood: "joyful" as const, color: "sage", emoji: "🎧" },
  anecdote: { title: "Una anécdota, contada a su ritmo", question: "¿Qué parte de ese día te gustaría recordar?", description: "Compartan una historia familiar. Ayni escucha lo que cuentan y acompaña la conversación con una pregunta a la vez, sin apurar las respuestas.", image: "/images/familia-participa.jpg", label: "Anécdotas", mood: "warm" as const, color: "butter", emoji: "📜" },
};
const apiUrl = import.meta.env.VITE_API_URL?.toLowerCase() ?? "";
const isTestBillingEnvironment = import.meta.env.DEV || /localhost|127\.0\.0\.1|stage/.test(apiUrl);
export function WelcomePage({ onLoginClick, onRegisterClick }: WelcomePageProps) {
  const [year] = useState(() => new Date().getFullYear());
  const [menu, setMenu] = useState(false);
  const [example, setExample] = useState<keyof typeof examples>("photo");
  const [songProvider, setSongProvider] = useState<"youtube" | "spotify">("youtube");
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
      <nav className="public-links" aria-label="Secciones de Ayni"><a href="#como-funciona">Cómo funciona</a><a href="#conoce-ayni">Conoce a Ayni</a><a href="#planes">Planes</a><a href="#preguntas">Preguntas</a></nav>
      <div className="public-actions"><button className="text-action" onClick={onLoginClick}>Iniciar sesión</button><a className="primary-action" href="#planes">Prueba hoy <ArrowRight size={17}/></a></div>
      <button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label={menu ? "Cerrar menú" : "Abrir menú"} aria-expanded={menu}>{menu ? <X/> : <Menu/>}</button>
      {menu && <nav className="public-mobile-menu" aria-label="Menú móvil"><a href="#como-funciona" onClick={() => setMenu(false)}>Cómo funciona</a><a href="#conoce-ayni" onClick={() => setMenu(false)}>Conoce a Ayni</a><a href="#planes" onClick={() => setMenu(false)}>Planes · Prueba hoy</a><button onClick={onLoginClick}>Iniciar sesión</button><button onClick={onRegisterClick}>Crear cuenta</button></nav>}
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
          <div className="hero-companion"><AyniCompanion decorative mood="joyful"/><p>Hola, soy <strong>Ayni.</strong><br/>¿Conversamos?</p></div>
          <Heart className="collage-heart" aria-hidden="true" />
        </div>
      </section>
      <div className="landing-ribbon" role="img" aria-label="Fotos que cuentan, canciones que conectan e historias que acompañan">
        <div className="landing-ribbon-track" aria-hidden="true">
          {[0,1].map(copy=><div className="landing-ribbon-group" key={copy}><span><Image size={20}/> Fotos que cuentan</span><i/><span><Music2 size={20}/> Canciones que conectan</span><i/><span><BookOpen size={20}/> Historias que acompañan</span><i/><span><Heart size={19}/> Momentos que nos acercan</span><i/></div>)}
        </div>
      </div>
      <section className="landing-section" id="como-funciona">
        <div className="section-heading"><div><p className="eyebrow">TAN SENCILLO COMO ESTAR JUNTOS</p><h2>Un pequeño momento.<br/><em>Una gran conexión.</em></h2></div><p>No hace falta preparar un discurso ni recordar cada fecha. Solo traer un recuerdo y las ganas de escucharse.</p></div>
        <div className="journey-grid" ref={journeyGridRef}>
          {[{emoji:"📸",title:"Reúnan sus recuerdos",text:"Suban una foto, escriban una anécdota o compartan el enlace de una canción.",color:"peach"}, {emoji:"💬",title:"Dejen que fluya",text:"Ayni acompaña con preguntas sencillas, una a la vez, y sigue el hilo de la conversación.",color:"sage"}, {emoji:"💛",title:"Guarden cómo les fue",text:"Al terminar, registren la reacción y compartan este pequeño momento con la familia.",color:"butter"}].map(({emoji,title,text,color},i)=><article className={`journey-card ${color}`} key={title}><div><span className="journey-emoji" aria-hidden="true">{emoji}</span><span className="journey-step">0{i+1}</span></div><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>
      <section className="companion-intro" id="conoce-ayni">
        <div className="companion-intro-inner">
          <div className="companion-heading"><p className="eyebrow">UN COMPAÑERO PARA CONVERSAR</p><h2>Conoce a Ayni.<br/><em>Siempre a su ritmo.</em></h2><p>Una compañía con inteligencia artificial para convertir recuerdos familiares en conversaciones cálidas, sencillas y sin apuro.</p></div>
          <div className="companion-picker" role="group" aria-label="Descubre cómo Ayni acompaña cada recuerdo">{Object.entries(examples).map(([key,value])=><button className={`companion-tab companion-tab-${value.color}`} key={key} aria-pressed={key===example} onClick={()=>setExample(key as keyof typeof examples)}><span className="companion-tab-emoji" aria-hidden="true">{value.emoji}</span>{value.label}</button>)}</div>
          <div className={`companion-feature companion-feature-${sample.color}`} key={example}>
            <div className={`companion-visual companion-visual-${example}${example === "song" ? " companion-visual-song" : ""}`} aria-label={`Ejemplo de conversación a partir de ${sample.label.toLowerCase()}`}>
              <span className="companion-orbit companion-orbit-one" aria-hidden="true"/><span className="companion-orbit companion-orbit-two" aria-hidden="true"/>
              {example === "photo" ? <>
                <div className="companion-photo-burst" aria-label="Dos fotos familiares salen de una tarjeta">
                  <figure className="companion-photo-card companion-photo-card-one"><img src="/images/conociendo%20ayni/fotos/familia.png" alt="Madre y padre sostienen a su bebé en casa" loading="lazy"/></figure>
                  <figure className="companion-photo-card companion-photo-card-two"><img src="/images/conociendo%20ayni/fotos/viendo%20fotos.png" alt="Familia reunida para mirar un álbum de recuerdos" loading="lazy"/></figure>
                </div>
                <div className="companion-photo-owl"><AyniCompanion decorative mood="joyful" animation="present" className="session-owl"/><span className="companion-held-card" aria-hidden="true">🖼️</span></div>
              </> : example === "anecdote" ? <>
                <figure className="companion-memory companion-memory-anecdote"><img src="/images/conociendo%20ayni/anecdota/bicicleta.png" alt="Una mujer pasea en bicicleta por su barrio al atardecer" loading="lazy"/><figcaption><Heart size={14}/> Un paseo para recordar</figcaption></figure>
                <div className="companion-thought-owl"><AyniCompanion decorative mood="curious" animation="present" className="session-owl"/><span className="companion-thought-bubble" aria-hidden="true"><i/><i/><i/></span></div>
              </> : <figure className="companion-memory"><img src={sample.image} alt={`Recuerdo familiar: ${sample.title}`} loading="lazy"/><figcaption><Heart size={14}/> Una canción que vuelve</figcaption></figure>}
              {example === "song" && <figure className="companion-memory companion-memory-secondary"><img src="/images/conociendo%20ayni/canciones/Bailando%20juntos.png" alt="Abuela y nieto bailan juntos en casa" loading="lazy"/><figcaption><Heart size={14}/> Bailar juntos</figcaption></figure>}
              {example === "song" && <figure className="companion-memory companion-memory-tertiary"><img src="/images/conociendo%20ayni/canciones/Cantando%20un%20recuerdo.png" alt="Familia canta y comparte una canción alrededor de la mesa" loading="lazy"/><figcaption><Music2 size={14}/> Cantar en familia</figcaption></figure>}
              {example === "song" && <div className="companion-song-owl"><AyniCompanion decorative mood="joyful" animation="music" className="session-owl"/></div>}
              <span className="companion-spark companion-spark-one" aria-hidden="true">✳</span><span className="companion-spark companion-spark-two" aria-hidden="true">✦</span>
            </div>
            <div className="companion-feature-copy"><span className="companion-feature-kicker"><span className="status-dot"/> ASÍ EMPIEZA UNA CONVERSACIÓN</span><h3>{sample.title}</h3><p>{sample.description}</p>{example === "song" && <div className="companion-song-player"><div className="companion-provider-tabs" role="group" aria-label="Elige dónde explorar música"><button type="button" aria-pressed={songProvider === "youtube"} onClick={()=>setSongProvider("youtube")}>YouTube</button><button type="button" aria-pressed={songProvider === "spotify"} onClick={()=>setSongProvider("spotify")}>Spotify</button></div><div className="companion-track"><button className="companion-player-button" type="button" aria-label={`Explorar música en ${songProvider === "youtube" ? "YouTube" : "Spotify"}`} onClick={()=>window.open(songProvider === "youtube"?"https://www.youtube.com/results?search_query=canciones+para+compartir+en+familia":"https://open.spotify.com/search/canciones%20para%20compartir%20en%20familia","_blank","noopener,noreferrer")}><Play size={21} fill="currentColor"/></button><div className="companion-track-info"><strong>Música que despierta recuerdos</strong><span>Explora canciones para compartir en familia</span><div className="companion-waveform" aria-hidden="true">{Array.from({length:30},(_,i)=><i key={i} style={{height:`${10+((i*17+11)%24)}px`}}/>)}</div></div><Music2 className="companion-track-note" size={24}/></div><p>Guarda un enlace de video de YouTube o de una canción de Spotify en <strong>Recuerdos</strong>; Ayni lo reproducirá durante la sesión.</p></div>}<div className="companion-feature-points"><span><span className="companion-point-emoji" aria-hidden="true">🗣️</span> Una pregunta a la vez</span><span><span className="companion-point-emoji" aria-hidden="true">🌱</span> A su propio ritmo</span></div><button className="companion-cta" onClick={onRegisterClick}>Conocer Ayni Digital <ArrowUpRight size={18}/></button></div>
          </div>
        </div>
      </section>
      <section className="landing-section family-values" aria-labelledby="values-title">
        <div className="values-heading">
          <p className="eyebrow">HECHO PARA TU FAMILIA</p>
          <h2 id="values-title">Nuestros valores</h2>
          <p>Lo importante es compartirlo, con cariño y a la manera de cada familia.</p>
        </div>
        <div className="values-grid">
          <article className="value-card value-card-private"><span className="value-emoji" aria-hidden="true">🔐</span><h3>Recuerdos privados</h3><p>Un espacio familiar para guardar y compartir sus historias con tranquilidad.</p></article>
          <article className="value-card value-card-kind"><span className="value-emoji" aria-hidden="true">🫶</span><h3>Sin respuestas correctas</h3><p>Cada quien puede contar lo que recuerda, con sus propias palabras y sin presión.</p></article>
          <article className="value-card value-card-pace"><span className="value-emoji" aria-hidden="true">🌿</span><h3>A su propio ritmo</h3><p>Pueden conversar, pausar o cambiar de tema cuando lo necesiten.</p></article>
        </div>
      </section>
      <section className="plans-section" id="planes" aria-labelledby="plans-title">
        <div className="plans-heading">
          <p className="eyebrow">UN ESPACIO PARA CADA FAMILIA</p>
          <h2 id="plans-title">Empieza gratis.<br/><em>Crece a tu ritmo.</em></h2>
          <p>Prueba Ayni sin costo y, cuando quieran compartir más, elijan el Plan Familia.</p>
        </div>
        <div className="plans-grid">
          <article className="welcome-plan-card welcome-plan-free" aria-labelledby="free-plan-title">
            <div className="welcome-plan-kicker"><span>Para comenzar</span><Heart size={19} aria-hidden="true"/></div>
            <h3 id="free-plan-title">Plan Gratis</h3>
            <p className="welcome-plan-description">Un primer espacio para guardar recuerdos y conversar en familia.</p>
            <p className="welcome-plan-price"><strong>S/ 0</strong><span>sin costo</span></p>
            <ul>
              <li><Check size={18}/>Hasta 10 fotos familiares</li>
              <li><Check size={18}/>Hasta 3 canciones</li>
              <li><Check size={18}/>1 guía de sesión cada 7 días</li>
              <li><Check size={18}/>Invita a 1 familiar</li>
            </ul>
            <button className="welcome-plan-secondary" onClick={onRegisterClick}>Empezar gratis <ArrowRight size={17}/></button>
          </article>
          <article className="welcome-plan-card welcome-plan-family" aria-labelledby="family-plan-title">
            <div className="welcome-plan-kicker"><span>Para compartir más</span><span className="welcome-plan-spark" aria-hidden="true">✳</span></div>
            <h3 id="family-plan-title">Plan Familia</h3>
            <p className="welcome-plan-description">Más espacio para reunir historias y preparar nuevos encuentros.</p>
            <p className="welcome-plan-price"><strong>S/ 19.90</strong><span>al mes</span></p>
            <ul>
              <li><Check size={18}/>Fotos sin límite durante el plan activo</li>
              <li><Check size={18}/>Guías de sesión sin límite semanal</li>
              <li><Check size={18}/>Anécdotas, canciones y recuerdos en familia</li>
              <li><Check size={18}/>Suscripción administrada desde tu cuenta</li>
            </ul>
            <button className="welcome-plan-primary" onClick={onRegisterClick}>Crear cuenta y continuar <ArrowRight size={17}/></button>
          </article>
        </div>
        <p className="plans-payment-note"><ShieldCheck size={17}/>{isTestBillingEnvironment ? <>Tus datos de pago se procesan de forma segura en Stripe. Para continuar con Plan Familia, crea una cuenta y abre “Plan” en tu espacio.</> : <>La contratación de Plan Familia aún no está habilitada en producción.</>}</p>
      </section>
      <section className="landing-section faq-section" id="preguntas"><div><p className="eyebrow">ANTES DE EMPEZAR</p><h2>¿Conversamos<br/><em>un poquito más?</em></h2></div><div>{[
        ["¿Qué necesito para empezar?","Crea tu cuenta, completa el perfil familiar y comparte un recuerdo positivo. Puedes empezar escribiendo, sin cámara ni micrófono."],
        ["¿Ayni reemplaza la atención de un profesional?","No. Ayni facilita conversaciones y actividades familiares. No es un servicio de salud ni realiza diagnósticos. Si tu familiar tiene un diagnóstico de demencia, consulta con su médico antes de empezar."],
        ["¿Tengo que activar la cámara?","Es opcional. Al permitirla y pedirle a Ayni que mire algo, se comparte una captura con Groq. Puedes apagarla en cualquier momento."],
        ["¿Puedo probarlo gratis?", isTestBillingEnvironment ? "Sí, existe un plan gratuito para comenzar. El Plan Familia cuesta S/ 19.90 al mes. Los datos de pago se procesan de forma segura en Stripe." : "Sí, existe un plan gratuito para comenzar. El Plan Familia cuesta S/ 19.90 al mes. La contratación todavía no está habilitada en producción."],
      ].map(([title,text])=><details key={title}><summary>{title}<span aria-hidden="true">+</span></summary><p>{text}</p></details>)}</div></section>
      <section className="closing-invitation"><span className="eyebrow">LAS MEJORES HISTORIAS YA LAS TIENEN</span><h2>Hoy puede empezar<br/>otra bonita conversación.</h2><button className="light-action" onClick={onRegisterClick}>Crear nuestro espacio <ArrowRight size={18}/></button><span className="invitation-flower" aria-hidden="true">✳</span></section>
    </main>
    <footer className="public-footer">
      <div className="footer-brand"><Brand/><p>Acompañamos momentos familiares.<br/>Ayni no es un servicio de salud.</p></div>
      <div className="footer-contact"><strong>Contacto</strong><a href="mailto:ayni.recuerdos@gmail.com"><Mail size={16}/>ayni.recuerdos@gmail.com</a><a href="tel:+51991171700"><Phone size={16}/>+51 991 171 700</a></div>
      <nav className="footer-socials" aria-label="Redes sociales de Ayni"><strong>Síguenos</strong>
        <a href="https://www.instagram.com/its_ayni/" target="_blank" rel="noreferrer"><span className="footer-social-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle className="footer-social-dot" cx="17.7" cy="6.5" r=".9"/></svg></span><span className="footer-social-label">Instagram <span>@its_ayni</span></span></a>
        <a href="https://www.facebook.com/its_ayni" target="_blank" rel="noreferrer"><span className="footer-social-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.2 21v-8h2.7l.4-3.2h-3.1V7.7c0-.9.3-1.5 1.6-1.5h1.7V3.3c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H8v3.2h2.8v8z"/></svg></span><span className="footer-social-label">Facebook <span>its_ayni</span></span></a>
        <a href="https://www.tiktok.com/@its_ayni" target="_blank" rel="noreferrer"><span className="footer-social-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14 3v11.2a4.2 4.2 0 1 1-3.4-4.1"/><path d="M14 3c.4 2.7 2.1 4.4 5 4.7"/></svg></span><span className="footer-social-label">TikTok <span>@its_ayni</span></span></a>
      </nav>
      <p className="footer-copyright">Hecho con cariño en Perú. · © {year} Ayni Digital</p>
    </footer>
  </div>;
}
