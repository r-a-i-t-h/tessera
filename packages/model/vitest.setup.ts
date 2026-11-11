import { Window } from "happy-dom";

if (typeof globalThis.DOMParser === "undefined") {
  globalThis.DOMParser = new Window().DOMParser;
}
