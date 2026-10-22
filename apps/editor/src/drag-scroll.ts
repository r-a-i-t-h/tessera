/** Pixels from the scroller edge that trigger push-scroll while dragging. */
const EDGE = 56;
const MAX_SPEED = 18;
const MIN_SPEED = 4;

export type DragScroll = {
  update(clientY: number): void;
  stop(): void;
};

/**
 * Scrolls `.editor-scroll` when the pointer sits near its top or bottom edge.
 * Uses rAF so motion continues even when browsers throttle `dragover`.
 */
export function startDragScroll(from: Element): DragScroll {
  return startDragScrollTarget(() => from.closest(".editor-scroll"));
}

/** Edge-scroll the pane under the pointer (nav build) or fall back to the main editor scroller. */
export function startDragScrollNavBuild(from: Element): DragScroll {
  return startDragScrollTarget((clientY) => {
    const layout = from.closest(".editor-nav-build-layout");
    if (layout) {
      for (const pane of layout.querySelectorAll<HTMLElement>(".editor-nav-build-scroll")) {
        const rect = pane.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) return pane;
      }
    }
    return from.closest(".editor-scroll");
  });
}

function startDragScrollTarget(
  resolveScroller: ((clientY: number) => Element | null) | (() => Element | null),
): DragScroll {
  let scroller: HTMLElement | null = null;
  let raf = 0;
  let direction = 0;
  let speed = 0;

  const tick = () => {
    if (!(scroller instanceof HTMLElement) || !direction) {
      raf = 0;
      return;
    }
    scroller.scrollTop += direction * speed;
    raf = requestAnimationFrame(tick);
  };

  const stopTick = () => {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  return {
    update(clientY: number) {
      const next =
        resolveScroller.length >= 1
          ? (resolveScroller as (clientY: number) => Element | null)(clientY)
          : (resolveScroller as () => Element | null)();
      scroller = next instanceof HTMLElement ? next : null;
      if (!scroller) return;
      const rect = scroller.getBoundingClientRect();
      const topDist = clientY - rect.top;
      const bottomDist = rect.bottom - clientY;
      if (topDist >= 0 && topDist < EDGE) {
        direction = -1;
        speed = scrollSpeed(topDist);
      } else if (bottomDist >= 0 && bottomDist < EDGE) {
        direction = 1;
        speed = scrollSpeed(bottomDist);
      } else {
        direction = 0;
        speed = 0;
        stopTick();
        return;
      }
      if (!raf) raf = requestAnimationFrame(tick);
    },
    stop() {
      direction = 0;
      speed = 0;
      stopTick();
    },
  };
}

function scrollSpeed(distanceFromEdge: number): number {
  const t = 1 - Math.max(0, Math.min(EDGE, distanceFromEdge)) / EDGE;
  return Math.max(MIN_SPEED, Math.round(MAX_SPEED * t));
}
