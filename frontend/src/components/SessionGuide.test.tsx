import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionGuide } from "./SessionGuide";
import { listMemories, getMemory } from "../api/memories";
import { listPhotos } from "../api/photos";
import { clearScene, recommendMemory, generateSession, getRecordedReaction, getSession, listSessions, getMessages, sendMessage, imageForConversation, recordReaction } from "../api/sessions";
import type { FaceCue } from "./sessionSignals";
const speech = vi.hoisted(() => ({ receive: undefined as ((text: string) => void) | undefined, cancel: vi.fn(), enabled: false, capture: vi.fn() }));
vi.mock("../api/memories", () => ({ listMemories: vi.fn(), getMemory: vi.fn() }));
vi.mock("../api/photos", () => ({ listPhotos: vi.fn() }));
vi.mock("../api/sessions", () => ({ clearScene: vi.fn(), recommendMemory: vi.fn(), generateSession: vi.fn(), getRecordedReaction: vi.fn(), getSession: vi.fn(), listSessions: vi.fn(), getMessages: vi.fn(), sendMessage: vi.fn(), imageForConversation: vi.fn(), recordReaction: vi.fn() }));
vi.mock("./useSessionDictation", () => ({ useSessionDictation: (receive: (text: string) => void, enabled: boolean) => { speech.receive=receive; speech.enabled=enabled; return { state:"idle", error:"", cancel:speech.cancel, retry:vi.fn() }; } }));
vi.mock("./SessionCamera", () => ({ SessionCamera: ({ captureRef, onCue, onAnalyzeFrame }: { captureRef?: { current: (() => Promise<string>) | null }; onCue:(cue:FaceCue)=>void; onAnalyzeFrame?:(image:string)=>void }) => { if (captureRef) captureRef.current = speech.capture; return <><button onClick={() => onCue("away")}>Simular salida de cuadro</button><button onClick={() => onAnalyzeFrame?.("data:image/jpeg;base64,test")}>Conversar sobre esta imagen</button></>; } }));
const user = { id: "u", name: "Ana", email: "ana@example.test", role: "familiar" as const, family_id: "f", created_at: "" };
const memory = {
  id: "memory", elder_profile_id: "profile", created_by: "u", type: "anecdote" as const,
  title: "El paseo", text: "Caminamos por el parque.", url: null,
  is_positive: true, is_sensitive: false, entities: [], entities_status: "completed" as const,
  created_at: "", updated_at: "",
};
const guide = { id:"guide", elder_profile_id:"profile", created_at:"2026-11-12T02:00:00Z", duration_minutes:15, steps:[{ instruction:"Conversen a su ritmo", memory_id:"memory", memory_available:true }] };
const answer = { id:"reply", role:"assistant" as const, text:"Me contaste que caminabas por el parque. ¿Qué te gustaba mirar allí?", suggestion:"continue" as const, observations:[] };
const photo = { id:"photo", memory_id:"memory", created_by:"u", content_type:"image/jpeg", size_bytes:12, width:1, height:1, created_at:"", url:"https://photos.example.test/signed", url_expires_at:"2026-11-12T03:00:00Z" };
beforeEach(() => {
 vi.mocked(clearScene).mockResolvedValue(undefined);
 speech.capture.mockResolvedValue("data:image/jpeg;base64,current");
 URL.createObjectURL=vi.fn(()=>"blob:test"); URL.revokeObjectURL=vi.fn();
 vi.mocked(listMemories).mockResolvedValue({items:[memory],total:1,limit:50,offset:0});
 vi.mocked(getMemory).mockResolvedValue(memory);
 vi.mocked(listPhotos).mockResolvedValue([]);
 vi.mocked(generateSession).mockResolvedValue(guide);
 vi.mocked(getSession).mockResolvedValue(guide);
 vi.mocked(listSessions).mockResolvedValue({items:[guide],total:1,limit:10,offset:0});
 vi.mocked(getMessages).mockResolvedValue([]);
 vi.mocked(getRecordedReaction).mockResolvedValue(null);
 vi.mocked(recordReaction).mockResolvedValue({ id:"response", session_id:"guide", elder_profile_id:"profile", created_by:"u", reaction:"receptivo", occurred_at:"", created_at:"" });
 vi.mocked(sendMessage).mockImplementation(async (_id, body) => ({...answer, text:body.text ? answer.text : "Hola, ¿qué disfrutaban de sus paseos?"}));
});
afterEach(() => { cleanup(); vi.resetAllMocks(); localStorage.clear(); });
async function begin(mode="Empezar sin cámara ni micrófono") {
 render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
 fireEvent.click(await screen.findByRole("button",{name:mode}));
 await screen.findByText("Hola, ¿qué disfrutaban de sus paseos?");
}
it("el acompañante refleja la respuesta pendiente y la pausa sin fingir que habla", async () => {
 await begin();
 expect(screen.getByRole("img", { name:"Ayni está contigo" })).toBeInTheDocument();
 vi.mocked(sendMessage).mockImplementation(() => new Promise(() => {}));
 fireEvent.change(screen.getByRole("textbox", {name:"Tu respuesta"}), {target:{value:"Me gusta cantar"}});
 fireEvent.click(screen.getByRole("button", {name:"Enviar"}));
 expect(screen.getByRole("img", {name:"Ayni está preparando su respuesta"})).toBeInTheDocument();
 expect(screen.queryByRole("img", {name:"Ayni está hablando"})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button", {name:"Pausar"}));
 expect(screen.getByRole("img", {name:"Ayni está en pausa"})).toBeInTheDocument();
 expect(vi.mocked(sendMessage).mock.calls.at(-1)![2].aborted).toBe(true);
});
it("adjunta la cámara actual a lo que digo sin pulsar el botón de imagen", async () => {
 await begin("Empezar con Ayni");
 act(() => speech.receive?.("Mira acá, ¿de qué color es lo que te muestro?"));
 await screen.findByText(answer.text);
 expect(speech.capture).toHaveBeenCalledOnce();
 expect(sendMessage).toHaveBeenLastCalledWith("guide", expect.objectContaining({ text:"Mira acá, ¿de qué color es lo que te muestro?", image:"data:image/jpeg;base64,current", image_consent:true }), expect.any(AbortSignal));
});
it("el contexto visual queda siempre activo y no se puede apagar por accidente", async () => {
 await begin("Empezar con Ayni");
 expect(screen.queryByRole("checkbox", { name:"Contexto visual en vivo" })).not.toBeInTheDocument();
 act(() => speech.receive?.("¿Puedes ver mi cámara?"));
 await screen.findByText(answer.text);
 expect(speech.capture).toHaveBeenCalledOnce();
});
it("si la persona sale del cuadro Ayni avisa que sigue ahí sin llamar a la IA", async () => {
 await begin("Empezar con Ayni");
 const calls = vi.mocked(sendMessage).mock.calls.length;
 const now = performance.now();
 vi.spyOn(performance, "now").mockReturnValue(now + 60_000);
 fireEvent.click(screen.getByRole("button", { name:"Simular salida de cuadro" }));
 expect(await screen.findByText("Aquí sigo contigo. Cuando quieras, seguimos conversando.")).toBeInTheDocument();
 expect(sendMessage).toHaveBeenCalledTimes(calls);
 vi.restoreAllMocks();
});
it("envía a la IA lo que Ayni dijo en pantalla al cambiar de actividad", async () => {
 await begin();
 fireEvent.click(screen.getByRole("button", { name:"Cambiar actividad" }));
 fireEvent.change(screen.getByRole("textbox", {name:"Tu respuesta"}), {target:{value:"cuando estaba descansando"}});
 fireEvent.click(screen.getByRole("button", {name:"Enviar"}));
 await screen.findByText(answer.text);
 expect(vi.mocked(sendMessage).mock.calls.at(-1)![1].previous_prompt).toBe("Hablemos de la anécdota. ¿Qué parte te gustaría contar?");
});
it("con cámara encendida conversa sin capturas cuando no se pide mirar", async () => {
 await begin("Empezar con Ayni");
 speech.capture.mockRejectedValue(new Error("Cámara averiada"));
 act(() => speech.receive?.("Me gustaban los helados de lúcuma"));
 await screen.findByText(answer.text);
 expect(speech.capture).not.toHaveBeenCalled();
 const payload = vi.mocked(sendMessage).mock.calls.at(-1)![1];
 expect(payload.image).toBeUndefined();
 expect(payload.use_scene).toBe(false);
 expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("si la cámara falla Ayni pide que le muestren la imagen otra vez en el chat", async () => {
 await begin("Empezar con Ayni");
 speech.capture.mockRejectedValueOnce(new Error("Cámara no disponible"));
 act(() => speech.receive?.("Mira acá, este es mi álbum"));
 await screen.findByText(/La cámara todavía no me muestra la imagen/);
 expect(screen.queryByRole("button", { name:"Reintentar con IA" })).not.toBeInTheDocument();
 act(() => speech.receive?.("Mira acá, este es mi álbum"));
 await screen.findByText(answer.text);
 expect(sendMessage).toHaveBeenLastCalledWith("guide", expect.objectContaining({ text:"Mira acá, este es mi álbum", image:"data:image/jpeg;base64,current" }), expect.any(AbortSignal));
});
it("genera una guía persistida y manda la respuesta real, no una categoría",async()=>{
 await begin();
 expect(generateSession).toHaveBeenCalledTimes(1);
 fireEvent.change(screen.getByRole("textbox",{name:"Tu respuesta"}),{target:{value:"Caminábamos y comprábamos helados"}});
 fireEvent.click(screen.getByRole("button",{name:"Enviar"}));
 await screen.findByText(answer.text);
 expect(sendMessage).toHaveBeenLastCalledWith("guide",expect.objectContaining({text:"Caminábamos y comprábamos helados",request_id:expect.any(String)}),expect.any(AbortSignal));
 expect(screen.getByRole("log")).toHaveTextContent("Caminábamos y comprábamos helados");
});
it("abre mensajes guardados sin gastar otra guía ni pedir otra respuesta al proveedor",async()=>{
 vi.mocked(getMessages).mockResolvedValue([answer]);
 render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
 fireEvent.click(await screen.findByRole("button",{name:"Continuar conversación"}));
 await screen.findByText(answer.text);
 expect(getSession).toHaveBeenCalledWith("guide");
 expect(generateSession).not.toHaveBeenCalled();
 expect(sendMessage).not.toHaveBeenCalled();
});
it("continúa la conversación tras un fallo aislado de Groq", async () => {
 await begin();
 vi.mocked(sendMessage).mockRejectedValueOnce(new Error("Groq no está disponible"));
 act(() => speech.receive?.("Me gustaban los helados"));
 await screen.findByText(/Podemos seguir a tu ritmo/);
 expect(screen.queryByRole("button", { name: "Reintentar con IA" })).not.toBeInTheDocument();
 act(() => speech.receive?.("Eran de lúcuma"));
 await screen.findByText(answer.text);
});

it("reserva el aviso técnico para fallos repetidos y conserva el identificador al reintentar", async () => {
 await begin("Empezar con Ayni");
 vi.mocked(sendMessage).mockRejectedValue(new Error("Servicio temporalmente ocupado"));
 act(() => speech.receive?.("Me gusta cantar"));
 await screen.findByText(/Podemos seguir a tu ritmo/);
 expect(speech.enabled).toBe(true);
 fireEvent.change(screen.getByRole("textbox", {name:"Tu respuesta"}), {target:{value:"Quiero conversar"}});
 fireEvent.click(screen.getByRole("button", {name:"Enviar"}));
 await screen.findByRole("alert");
 expect(speech.enabled).toBe(true);
 const failed = vi.mocked(sendMessage).mock.calls.at(-1)![1];
 vi.mocked(sendMessage).mockResolvedValue(answer);
 fireEvent.click(screen.getByRole("button", {name:"Reintentar con IA"}));
 await screen.findByText(answer.text);
 expect(sendMessage).toHaveBeenLastCalledWith("guide", failed, expect.any(AbortSignal));
 expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("pausa desde un comando transcrito sin esperar al proveedor",async()=>{
 await begin("Empezar con Ayni");
 const previous=vi.mocked(sendMessage).mock.calls.length;
 act(()=>speech.receive?.("Quiero descansar un rato"));
 expect(screen.getByRole("textbox",{name:"Tu respuesta"})).toBeDisabled();
 expect(speech.enabled).toBe(false);
 expect(sendMessage).toHaveBeenCalledTimes(previous);
});
it("saves a reaction through the API instead of storing review data in the browser",async()=>{
 await begin(); expect(speech.enabled).toBe(false);
 fireEvent.click(screen.getByRole("button",{name:"Terminar"}));
 fireEvent.click(screen.getByRole("button",{name:"Receptivo"}));
 fireEvent.click(screen.getByRole("button",{name:"Guardar reacción"}));
 await screen.findByRole("heading",{name:"Reacción guardada en tu familia"});
 expect(recordReaction).toHaveBeenCalledWith("guide","receptivo");
});
it("una captura explícita se envía con consentimiento y muestra detalles detectados",async()=>{
 await begin("Empezar con Ayni");
 vi.mocked(sendMessage).mockResolvedValue({...answer,observations:["Árboles y un álbum"]});
 fireEvent.click(screen.getByRole("button",{name:"Conversar sobre esta imagen"}));
 await screen.findByText("Árboles y un álbum");
 expect(sendMessage).toHaveBeenLastCalledWith("guide",expect.objectContaining({image:"data:image/jpeg;base64,test",image_consent:true}),expect.any(AbortSignal));
});
it("no inventa una conversación si el backend rechaza una guía vacía",async()=>{
 vi.mocked(generateSession).mockRejectedValue(new Error("Primero comparte un recuerdo bonito"));
 render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
 fireEvent.click(await screen.findByRole("button",{name:"Empezar sin cámara ni micrófono"}));
 await screen.findByText("Primero comparte un recuerdo bonito");
 expect(sendMessage).not.toHaveBeenCalled();
});
it("aborta una respuesta en curso al pausar e impide que reaparezca",async()=>{
 await begin();
 vi.mocked(sendMessage).mockImplementation(()=>new Promise(()=>{}));
 fireEvent.change(screen.getByRole("textbox",{name:"Tu respuesta"}),{target:{value:"Otra historia"}});
 fireEvent.click(screen.getByRole("button",{name:"Enviar"}));
 const signal=vi.mocked(sendMessage).mock.calls.at(-1)![2];
 fireEvent.click(screen.getByRole("button",{name:"Pausar"}));
 expect(signal.aborted).toBe(true);
});
it("permite analizar una foto familiar solo mediante una acción explícita",async()=>{
 vi.mocked(listPhotos).mockResolvedValue([photo]);
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["image"],{type:"image/jpeg"}) }));
 vi.mocked(imageForConversation).mockResolvedValue("data:image/jpeg;base64,photo");
 await begin();
 fireEvent.click(screen.getByRole("button",{name:"Cambiar actividad"}));
 await screen.findByRole("button",{name:"Analizar foto con IA"});
 const previous=vi.mocked(sendMessage).mock.calls.length;
 expect(vi.mocked(sendMessage).mock.calls.some(([,body])=>Boolean(body.image))).toBe(false);
 fireEvent.click(screen.getByRole("button",{name:"Analizar foto con IA"}));
 await waitFor(()=>expect(sendMessage).toHaveBeenCalledTimes(previous+1));
 expect(sendMessage).toHaveBeenLastCalledWith("guide",expect.objectContaining({image:"data:image/jpeg;base64,photo",image_consent:true}),expect.any(AbortSignal));
});

it("keeps the review open and shows the server error if a reaction cannot be saved",async()=>{
 await begin();
 vi.mocked(recordReaction).mockRejectedValue(new Error("No pudimos guardar la reacción."));
 fireEvent.click(screen.getByRole("button",{name:"Terminar"}));
 fireEvent.click(screen.getByRole("button",{name:"Emocionado"}));
 fireEvent.click(screen.getByRole("button",{name:"Guardar reacción"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos guardar la reacción.");
 expect(screen.queryByRole("heading",{name:"Reacción guardada en tu familia"})).not.toBeInTheDocument();
});

it("permite escoger manualmente el recuerdo antes de generar",async()=>{
 render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
 const choice=await screen.findByRole("combobox",{name:"Recuerdo para la sesión"});
 fireEvent.change(choice,{target:{value:"memory"}});
 fireEvent.click(screen.getByRole("button",{name:"Empezar sin cámara ni micrófono"}));
 await screen.findByText("Hola, ¿qué disfrutaban de sus paseos?");
 expect(generateSession).toHaveBeenCalledWith("memory");
});
it("explica una recomendación sin impedir que la familia cambie de elección",async()=>{
 vi.mocked(recommendMemory).mockResolvedValue({memory_id:"memory",title:"El paseo",source:"history",reason:"Una sesión con reacción positiva",positive_reactions:1,previous_sessions:1});
 render(<SessionGuide currentUser={user} onOpenMemories={vi.fn()} />);
 fireEvent.click(await screen.findByRole("button",{name:"Recomendar un recuerdo"}));
 await screen.findByText("Una sesión con reacción positiva");
 expect(screen.getByRole("combobox",{name:"Recuerdo para la sesión"})).toHaveValue("memory");
 fireEvent.change(screen.getByRole("combobox",{name:"Recuerdo para la sesión"}),{target:{value:""}});
 expect(screen.getByRole("combobox",{name:"Recuerdo para la sesión"})).toHaveValue("");
});

it("Ayni muestra una foto cuando la IA entiende que la piden, dicho con cualquier palabra",async()=>{
 vi.mocked(listPhotos).mockResolvedValue([photo]);
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["image"],{type:"image/jpeg"}) }));
 await begin();
 vi.mocked(sendMessage).mockResolvedValue({...answer,text:"Claro, mira esta foto. ¿Qué recuerdas de ese día?",action:"show_photo"});
 act(() => speech.receive?.("oye y no tendrás por ahí algo guardado para ver"));
 await screen.findByRole("img",{name:"Foto familiar"});
 expect(vi.mocked(sendMessage).mock.calls.at(-1)![1]).toEqual(expect.objectContaining({ available:["anecdote","photo"] }));
});
it("si Ayni decide mirar, toma una captura y vuelve a responder con ella",async()=>{
 await begin("Empezar con Ayni");
 vi.mocked(sendMessage).mockResolvedValueOnce({...answer,text:"Déjame mirar.",action:"look_camera"}).mockResolvedValueOnce({...answer,text:"Veo una taza azul. ¿Es tuya?"});
 act(() => speech.receive?.("oye fíjate qué tengo en la mano"));
 await screen.findByText("Veo una taza azul. ¿Es tuya?");
 expect(speech.capture).toHaveBeenCalledOnce();
 expect(sendMessage).toHaveBeenLastCalledWith("guide",expect.objectContaining({ image:"data:image/jpeg;base64,current", image_consent:true }),expect.any(AbortSignal));
});
it("envía la foto guardada activa al preguntar por ella sin necesitar la cámara", async () => {
 vi.mocked(listPhotos).mockResolvedValue([photo]);
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,blob:async()=>new Blob(["photo"],{type:"image/jpeg"})}));
 vi.mocked(imageForConversation).mockResolvedValue("data:image/jpeg;base64,saved");
 await begin();
 fireEvent.click(screen.getByRole("button",{name:"Cambiar actividad"}));
 await screen.findByRole("button",{name:"Analizar foto con IA"});
 fireEvent.change(screen.getByRole("textbox",{name:"Tu respuesta"}),{target:{value:"¿Qué ves en esta foto?"}});
 fireEvent.click(screen.getByRole("button",{name:"Enviar"}));
 await screen.findByText(answer.text);
 expect(sendMessage).toHaveBeenLastCalledWith("guide",expect.objectContaining({image:"data:image/jpeg;base64,saved",image_consent:true}),expect.any(AbortSignal));
 expect(speech.capture).not.toHaveBeenCalled();
 vi.unstubAllGlobals();
});
it("prioriza la cámara explícita sobre una foto activa", async () => {
 vi.mocked(listPhotos).mockResolvedValue([photo]);
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,blob:async()=>new Blob(["photo"],{type:"image/jpeg"})}));
 await begin("Empezar con Ayni");
 fireEvent.click(screen.getByRole("button",{name:"Cambiar actividad"}));
 await screen.findByRole("button",{name:"Analizar foto con IA"});
 act(()=>speech.receive?.("Mira mi cámara, ¿qué ves acá?"));
 await screen.findByText(answer.text);
 expect(speech.capture).toHaveBeenCalledOnce();
 expect(imageForConversation).not.toHaveBeenCalled();
 vi.unstubAllGlobals();
});
it("no usa la cámara cuando se pide una foto que no está abierta", async () => {
 await begin("Empezar con Ayni");
 act(()=>speech.receive?.("Mira la foto del recuerdo"));
 await screen.findByText(/Abre la foto del recuerdo/);
 expect(speech.capture).not.toHaveBeenCalled();
});
