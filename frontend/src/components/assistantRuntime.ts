import type { PageControl, PageDecision, PageScreen } from "../api/assistant";

const ids = new WeakMap<Element, string>();
const secret = /password|credit.?card|card.?number|cvc|cvv|contrase[nñ]a|tarjeta|verification.?code|token/i;
const restricted = /eliminar|borrar|pagar|contratar|comprar|cancelar.*(?:plan|suscripci)|cerrar sesi[oó]n|enviar invitaci[oó]n|consentimiento|acepto|autorizo|subir|adjuntar|seleccionar.*(?:foto|archivo)/i;
const compact = (text: string) => text.replace(/\s+/g, " ").trim();

function visible(element: HTMLElement): boolean {
  return element.getClientRects().length > 0 && !element.closest('[hidden], [inert], [aria-hidden="true"]') && getComputedStyle(element).visibility !== "hidden";
}

function label(element: HTMLElement): string {
  const labelled = element.getAttribute("aria-labelledby")?.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? "").join(" ");
  const field = element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement;
  return compact(element.getAttribute("aria-label") || labelled || (field && Array.from(element.labels ?? []).map(item => item.textContent).join(" ")) || element.innerText || element.textContent || element.getAttribute("title") || element.getAttribute("placeholder") || "").slice(0, 160);
}

function describe(element: HTMLElement): PageControl | null {
  if (!visible(element) || element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") return null;
  if (element instanceof HTMLAnchorElement && !["https:", "http:"].includes(element.protocol)) return null;
  const name = label(element);
  if (!name || secret.test(`${name} ${element.getAttribute("name")} ${element.getAttribute("autocomplete")} ${element.getAttribute("type")}`)) return null;
  const input = element instanceof HTMLInputElement;
  if (input && element.type === "hidden") return null;
  const select = element instanceof HTMLSelectElement;
  const editable = element instanceof HTMLTextAreaElement || (input && !["checkbox", "radio", "file", "button", "submit", "reset", "image"].includes(element.type));
  if (editable && element.readOnly) return null;
  let id = ids.get(element);
  if (!id) { id = crypto.randomUUID(); ids.set(element, id); }
  const section = element.closest("form, fieldset, article, li, section");
  const heading = compact(section?.querySelector("legend, h1, h2, h3, h4")?.textContent ?? "").slice(0, 80);
  const context = heading && !name.includes(heading) ? `${heading} / ${name}` : name;
  return {
    id, label: context.slice(0, 250), kind: select ? "select" : editable ? "fill" : "click",
    value: editable || select ? element.value.slice(0, 2000) : input && ["checkbox", "radio"].includes(element.type) ? String(element.checked) : "",
    options: select ? Array.from(element.options).filter(option => !option.disabled).map(option => ({ value: option.value.slice(0, 250), label: option.text.slice(0, 250) })).slice(0, 100) : [],
    confirmation: restricted.test(context) || element.hasAttribute("data-assistant-confirm") || element.closest("[data-assistant-confirm]") !== null || (input && element.type === "file") || element.matches('a[target="_blank"]'),
  };
}

export interface CapturedScreen { screen: PageScreen; targets: Map<string, { element: HTMLElement; control: PageControl }> }

export function captureScreen(): CapturedScreen {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], dialog[open]')).filter(visible);
  const root = dialogs.at(-1) ?? document.querySelector<HTMLElement>(".app-shell");
  const targets: CapturedScreen["targets"] = new Map();
  const text: string[] = [];
  if (root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || !visible(parent) || parent.closest("script, style, input, textarea, [data-assistant-private], [data-ayni-assistant]")) continue;
      const value = compact(node.textContent ?? "");
      if (value) text.push(value);
    }
    for (const element of root.querySelectorAll<HTMLElement>('button, a[href], input, textarea, select, [role="button"]')) {
      if (element.closest("[data-assistant-private], [data-ayni-assistant]")) continue;
      const control = describe(element);
      if (control) targets.set(control.id, { element, control });
      if (targets.size >= 100) break;
    }
  }
  return { screen: {
    page: document.querySelector<HTMLElement>("[data-view]")?.dataset.view ?? "app",
    text: text.join("\n").slice(0, 14000), controls: Array.from(targets.values()).map(item => item.control), completed_controls: [],
  }, targets };
}

export function performAction(decision: PageDecision, snapshot: CapturedScreen, confirmed = false): string {
  if (decision.action === "scroll") {
    if (!["up", "down"].includes(decision.value)) throw new Error("Dirección desconocida.");
    window.scrollBy({ top: window.innerHeight * (decision.value === "up" ? -0.8 : 0.8), behavior: "smooth" });
    return "Se desplazó la página.";
  }
  if (decision.action === "wait") return "Se esperó a que terminara la carga.";
  const target = snapshot.targets.get(decision.target);
  const current = target && describe(target.element);
  const latest = target && captureScreen().targets.get(decision.target);
  if (!target || !latest || !target.element.isConnected || !current || current.label !== target.control.label || current.kind !== decision.action) {
    throw new Error("La pantalla cambió. Vuelve a pedir la acción para usar sus controles actuales.");
  }
  const element = target.element;
  if (current.confirmation && !confirmed) throw new Error("Confirma esta acción antes de continuar.");
  element.scrollIntoView({ block: "nearest" });
  if (decision.action === "click") {
    element.click();
    return `Se activó «${current.label}». Comprueba el resultado en pantalla.`;
  }
  if (decision.action === "select") {
    if (!(element instanceof HTMLSelectElement) || !current.options.some(option => option.value === decision.value)) throw new Error("Esa opción ya no está disponible.");
    element.value = decision.value;
  } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (!setter) throw new Error("Este campo necesita edición manual.");
    setter.call(element, decision.value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.blur();
  return `Se completó «${current.label}» con el valor «${decision.value}».`;
}

/** Da tiempo al render; el siguiente turno comprueba si la página sigue cargando. */
export async function settleScreen(signal: AbortSignal): Promise<void> {
  await new Promise<void>(resolve => {
    const done = () => { window.clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
    const timer = window.setTimeout(done, 900);
    signal.addEventListener("abort", done, { once: true });
    if (signal.aborted) done();
  });
}
