import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionGuide } from "./SessionGuide";
import { listMemories, getMemory } from "../api/memories";
import { listPhotos } from "../api/photos";
import { generateSession, getRecordedReaction, getSession, listSessions, getMessages, sendMessage, imageForConversation, recordReaction } from "../api/sessions";
import type { FaceCue } from "./sessionSignals";
const speech = vi.hoisted(() => ({ receive: undefined as ((text: string) => void) | undefined, cancel: vi.fn(), enabled: false }));
vi.mock("../api/memories", () => ({ listMemories: vi.fn(), getMemory: vi.fn() }));
vi.mock("../api/photos", () => ({ listPhotos: vi.fn() }));
vi.mock("../api/sessions", () => ({ generateSession: vi.fn(), getRecordedReaction: vi.fn(), getSession: vi.fn(), listSessions: vi.fn(), getMessages: vi.fn(), sendMessage: vi.fn(), imageForConversation: vi.fn(), recordReaction: vi.fn() }));
vi.mock("./useSessionDictation", () => ({ useSessionDictation: (receive: (text: string) => void, enabled: boolean) => { speech.receive=receive; speech.enabled=enabled; return { state:"idle", error:"", cancel:speech.cancel, retry:vi.fn() }; } }));
vi.mock("./SessionCamera", () => ({ SessionCamera: ({ onCue, onAnalyzeFrame }: { onCue:(cue:FaceCue)=>void; onAnalyzeFrame?:(image:string)=>void }) => <><button onClick={() => onCue("away")}>Simular salida de cuadro</button><button onClick={() => onAnalyzeFrame?.("data:image/jpeg;base64,test")}>Conversar sobre esta imagen</button></> }));
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
it("informa un error de Groq y reintenta con el mismo identificador",async()=>{
 await begin();
 vi.mocked(sendMessage).mockRejectedValueOnce(new Error("Groq no está disponible"));
 fireEvent.change(screen.getByRole("textbox",{name:"Tu respuesta"}),{target:{value:"Me gustaban los helados"}});
 fireEvent.click(screen.getByRole("button",{name:"Enviar"}));
 await screen.findByText("Groq no está disponible");
 const failed=vi.mocked(sendMessage).mock.calls.at(-1)![1];
 fireEvent.click(screen.getByRole("button",{name:"Reintentar con IA"}));
 await screen.findByText(answer.text);
 expect(sendMessage).toHaveBeenLastCalledWith("guide",failed,expect.any(AbortSignal));
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
