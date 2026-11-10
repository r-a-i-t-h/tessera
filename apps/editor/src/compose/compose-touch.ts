/** Touch-only compose layout: coarse pointer and narrow width (see mobile plan). */

export const COMPOSE_TOUCH_MQ = "(pointer: coarse) and (max-width: 800px)";

export function wireComposeTouchLayout(form: HTMLFormElement): () => void {
  const layout = form.querySelector<HTMLElement>(".editor-compose-layout");
  if (!layout || typeof window === "undefined") return () => undefined;

  const mq = window.matchMedia(COMPOSE_TOUCH_MQ);
  const apply = () => {
    layout.classList.toggle("editor-compose--touch", mq.matches);
  };
  apply();
  mq.addEventListener("change", apply);
  return () => mq.removeEventListener("change", apply);
}
