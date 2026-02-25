/**
 * CodeMirror keybinding for Cmd+R rhyme popup.
 * Extracts the last word of the current line and triggers a callback.
 * The actual rhyme lookup is async, handled by the parent component.
 */
import { keymap } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

/** Create a keymap extension for Cmd+R rhyme lookup */
export function createRhymeKeybinding(
  onRequestRhymes: (word: string, x: number, y: number, view: EditorView) => void
) {
  return keymap.of([
    {
      key: "Mod-r",
      run: (view) => {
        const { state } = view;
        const cursor = state.selection.main.head;
        const line = state.doc.lineAt(cursor);
        const text = line.text.trim();

        if (!text) return false;

        // Extract last word
        const words = text.split(/\s+/);
        const lastWord = words[words.length - 1].replace(/[^a-zA-Z]/g, "");

        if (!lastWord) return false;

        const coords = view.coordsAtPos(cursor);
        if (coords) {
          onRequestRhymes(lastWord, coords.left, coords.bottom + 4, view);
        }

        return true;
      },
    },
  ]);
}
