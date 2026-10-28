const FRAME_COLOR_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FRAME_COLOR_FUNC = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%/\s]+\s*\)$/i;
const TOKEN_HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export type StyleColorFieldMode = "token" | "frame";

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

/** #rrggbb for a hidden type=color input, when the token can be resolved to RGB. */
export function hexForColorPicker(value: string, mode: StyleColorFieldMode): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (mode === "token" && !styleTokenColorValid(trimmed)) return null;
  if (mode === "frame" && !frameColorTokenValid(trimmed)) return null;
  const channels = parseCssColorChannels(trimmed);
  if (!channels) return null;
  return `#${byteHex(channels.r)}${byteHex(channels.g)}${byteHex(channels.b)}`;
}

export function swatchPresentation(value: string, mode: StyleColorFieldMode): StyleSwatchPresentation {
  return mode === "frame" ? swatchForFrameColor(value) : swatchForStyleToken(value);
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

export function styleColorPickerIcon(): string {
  return `<svg class="style-color-picker-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M17.66 7.93 12 2.27 6.34 7.93c-3.12 3.12-3.12 8.19 0 11.31A7.98 7.98 0 0 0 12 21.58c2.05 0 4.1-.78 5.66-2.34 3.12-3.12 3.12-8.19 0-11.31zM12 19.59c-1.6 0-3.11-.62-4.24-1.76C6.62 16.7 6 15.19 6 13.59s.62-3.11 1.76-4.24L12 5.1l4.24 4.25c2.34 2.34 2.34 6.15 0 8.49A5.97 5.97 0 0 1 12 19.59z"/>
    <circle fill="currentColor" cx="8.5" cy="11.5" r="1.25"/>
    <circle fill="currentColor" cx="12" cy="9" r="1.25"/>
    <circle fill="currentColor" cx="15.5" cy="12" r="1.25"/>
  </svg>`;
}

export function applyStyleSwatch(el: HTMLElement, presentation: StyleSwatchPresentation): void {
  el.style.background = presentation.background;
  el.style.color = presentation.text;
}

export function bindStyleColorFields(root: ParentNode): void {
  for (const control of root.querySelectorAll<HTMLElement>("[data-style-color-control]")) {
    const mode = control.dataset.styleColorMode === "frame" ? "frame" : "token";
    const swatch = control.querySelector<HTMLElement>("[data-style-color-swatch]");
    const textInput = control.querySelector<HTMLInputElement>("input.style-color-value-input");
    const picker = control.querySelector<HTMLInputElement>('input[type="color"].style-color-picker');
    const pickerBtn = control.querySelector<HTMLButtonElement>(".style-color-picker-btn");
    if (!swatch || !textInput || !picker) continue;

    const syncPickerFromText = () => {
      const hex = hexForColorPicker(textInput.value, mode);
      if (hex) picker.value = hex;
    };

    const paint = () => {
      applyStyleSwatch(swatch, swatchPresentation(textInput.value, mode));
      syncPickerFromText();
    };

    paint();
    textInput.addEventListener("input", paint);
    textInput.addEventListener("change", paint);

    picker.addEventListener("input", () => {
      textInput.value = picker.value.toLowerCase();
      paint();
      textInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    picker.addEventListener("change", () => {
      textInput.value = picker.value.toLowerCase();
      paint();
      textInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    pickerBtn?.addEventListener("click", () => {
      syncPickerFromText();
      picker.click();
    });
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

function byteHex(value: number): string {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
}
