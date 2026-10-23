import { autocompletion } from "@codemirror/autocomplete";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { css, cssCompletionSource } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { readCodeWrap } from "./code-wrap.js";

export type MaximizedCodeLanguage = "css" | "javascript";

export type MaximizedCodeEditorHandle = {
  focus: () => void;
  destroy: () => void;
};

const SOURCE_HIDDEN = "maximized-code-editor-source-hidden";

/** Read the primary code field from a maximized overlay form. */
export function readFormText(form: HTMLFormElement): string {
  const field = form.elements.namedItem("text");
  return field instanceof HTMLTextAreaElement ? field.value : "";
}

export function mountMaximizedCodeEditor(
  textarea: HTMLTextAreaElement,
  language: MaximizedCodeLanguage,
): MaximizedCodeEditorHandle {
  const host = document.createElement("div");
  host.className = "maximized-code-editor";

  const parent = textarea.parentElement ?? document.body;
  parent.insertBefore(host, textarea);

  textarea.classList.add(SOURCE_HIDDEN);
  textarea.hidden = true;

  const syncToTextarea = (state: EditorState) => {
    textarea.value = state.doc.toString();
  };

  const languageExtensions =
    language === "css"
      ? [css(), autocompletion({ override: [cssCompletionSource], activateOnTyping: true })]
      : [javascript(), autocompletion({ activateOnTyping: true })];

  const state = EditorState.create({
    doc: textarea.value,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      bracketMatching(),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([...defaultKeymap, indentWithTab]),
      ...(readCodeWrap() ? [EditorView.lineWrapping] : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) syncToTextarea(update.state);
      }),
      ...languageExtensions,
    ],
  });

  const view = new EditorView({ state, parent: host });

  return {
    focus: () => {
      view.focus();
    },
    destroy: () => {
      syncToTextarea(view.state);
      view.destroy();
      host.remove();
      textarea.classList.remove(SOURCE_HIDDEN);
      textarea.hidden = false;
    },
  };
}
