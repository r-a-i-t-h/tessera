import type { ComponentFn } from "@r-a-i-t-h/tessera-renderer";
import { openDaysTable } from "./open-days.js";
import { aboutRenderer, eventList, infoCard, now, pageNav } from "./pure.js";
import { randomCells } from "./random-cells.js";
import { registerCardElement } from "./rt-card.js";
import {
  agendaList,
  articleByline,
  attendeeList,
  datedList,
  peopleGrid,
  profileFacts,
  profileKicker,
  profilePhoto,
} from "./willow.js";

/**
 * Shared component catalogue. Every site may name these. A site does not
 * ship its own implementations.
 */
export function registerExtras(define: (name: string, fn: ComponentFn) => unknown): void {
  registerCardElement();
  define("now", now);
  define("pageNav", pageNav);
  define("eventList", eventList);
  define("aboutRenderer", aboutRenderer);
  define("infoCard", infoCard);
  define("randomCells", randomCells);
  define("openDaysTable", openDaysTable);
  define("datedList", datedList);
  define("peopleGrid", peopleGrid);
  define("articleByline", articleByline);
  define("profileKicker", profileKicker);
  define("profilePhoto", profilePhoto);
  define("profileFacts", profileFacts);
  define("agendaList", agendaList);
  define("attendeeList", attendeeList);
}
