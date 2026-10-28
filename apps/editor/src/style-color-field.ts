const FRAME_COLOR_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FRAME_COLOR_FUNC = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%/\s]+\s*\)$/i;
const TOKEN_HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export type StyleSwatchPresentation = {
  background: string;
  label: string;
  text: "#000000" | "#ffffff";
};

export function frameColorTokenValid(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (lower.includes("url(") || /[;{}]/.test(trimmed)) return false;
  if (FRAME_COLOR_HEX.test(trimmed)) return true;
  return FRAME_COLOR_FUNC.test(trimmed);
}

export function styleTokenColorValid(value: string): boolean {
  return TOKEN_HEX.test(value.trim());
}

/** Text on a swatch: black on light fills, white on dark. */
export function contrastingTextColor(r: number, g: number, b: number, alpha = 1): "#000000" | "#ffffff" {
  const blend = (channel: number) => Math.round(channel * alpha + 255 * (1 - alpha));
  const brightness = (blend(r) * 299 + blend(g) * 587 + blend(b) * 114) / 1000;
  return brightness > 186 ? "#000000" : "#ffffff";
}

export function parseCssColorChannels(css: string): { r: number; g: number; b: number; a: number } | null {
  const trimmed = css.trim();
  if (!trimmed) return null;
  const hex = parseHexChannels(trimmed);
  if (hex) return hex;
  if (typeof document === "undefined") return null;
  const probe = document.createElement("span");
  probe.style.color = trimmed;
  if (!probe.style.color) return null;
  document.documentElement.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const match = computed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

export function swatchForStyleToken(value: string): StyleSwatchPresentation {
  const trimmed = value.trim();
  if (!styleTokenColorValid(trimmed)) {
    return { background: "#e8e8e8", label: trimmed || "—", text: "#000000" };
  }
  const channels = parseCssColorChannels(trimmed);
  const text = channels ? contrastingTextColor(channels.r, channels.g, channels.b, channels.a) : "#000000";
  return { background: trimmed, label: trimmed.toLowerCase(), text };
}

export function swatchForFrameColor(value: string): StyleSwatchPresentation {
  const trimmed = value.trim();
  if (!trimmed) {
    return { background: "#e8e8e8", label: "Default", text: "#000000" };
  }
  if (!frameColorTokenValid(trimmed)) {
    return { background: "#e8e8e8", label: trimmed, text: "#000000" };
  }
  const channels = parseCssColorChannels(trimmed);
  const text = channels ? contrastingTextColor(channels.r, channels.g, channels.b, channels.a) : "#000000";
  return { background: trimmed, label: trimmed, text };
}

export function applyStyleSwatch(el: HTMLElement, presentation: StyleSwatchPresentation): void {
  el.style.background = presentation.background;
  el.style.color = presentation.text;
  const label = el.querySelector<HTMLElement>("[data-style-color-label]");
  if (label) label.textContent = presentation.label;
}

export function bindStyleColorFields(root: ParentNode): void {
  for (const swatch of root.querySelectorAll<HTMLElement>("[data-style-color-swatch]")) {
    const colorInput = swatch.querySelector<HTMLInputElement>('input[type="color"].style-color');
    const textInput = swatch.querySelector<HTMLInputElement>("input.style-frame-color-input");
    const paint = () => {
      if (colorInput) applyStyleSwatch(swatch, swatchForStyleToken(colorInput.value));
      else if (textInput) applyStyleSwatch(swatch, swatchForFrameColor(textInput.value));
    };
    paint();
    colorInput?.addEventListener("input", paint);
    colorInput?.addEventListener("change", paint);
    textInput?.addEventListener("input", paint);
    textInput?.addEventListener("change", paint);
  }
}

function parseHexChannels(value: string): { r: number; g: number; b: number; a: number } | null {
  if (!TOKEN_HEX.test(value) && !FRAME_COLOR_HEX.test(value)) return null;
  let hex = value.slice(1);
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = parseInt(hex.slice(6, 8), 16) / 255;
    return { r, g, b, a };
  }
  if (hex.length !== 6) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: 1,
  };
}
