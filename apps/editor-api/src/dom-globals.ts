/**
 * Publish and dist build dataset `text` fields through {@link sanitizeRichHtml}, which uses `DOMParser`.
 * Node has no DOM globals; load happy-dom once before any model code runs on the server.
 */
import { Window } from "happy-dom";

if (typeof globalThis.DOMParser === "undefined") {
  globalThis.DOMParser = new Window().DOMParser;
}
