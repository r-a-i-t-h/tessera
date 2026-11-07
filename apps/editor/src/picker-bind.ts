/** Prevent stacking duplicate library/page picker listeners when a form body is repainted. */
export function bindPickerClicks(form: HTMLFormElement, listener: (event: Event) => void): void {
  if (form.dataset.editorPickersBound === "true") return;
  form.dataset.editorPickersBound = "true";
  form.addEventListener("click", listener);
}
