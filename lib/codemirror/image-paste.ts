import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

const IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

function isImageFile(file: File): boolean {
  return IMAGE_MIME_TYPES.includes(file.type);
}

const PLACEHOLDER = "![Uploading...]()";

/**
 * CodeMirror extension that intercepts paste and drop events containing
 * image files. Inserts a placeholder, calls `onUpload`, then replaces
 * the placeholder with the final `![image](url)` markdown.
 */
export function imagePasteExtension(
  onUpload: (file: File) => Promise<string>
): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const items = event.clipboardData?.items;
      if (!items) return false;

      for (const item of items) {
        if (isImageFile(item as unknown as File) || item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;

          event.preventDefault();
          handleImageInsert(view, file, onUpload);
          return true;
        }
      }
      return false;
    },

    drop(event, view) {
      const files = event.dataTransfer?.files;
      if (!files) return false;

      for (const file of files) {
        if (isImageFile(file)) {
          event.preventDefault();
          handleImageInsert(view, file, onUpload);
          return true;
        }
      }
      return false;
    },
  });
}

function handleImageInsert(
  view: EditorView,
  file: File,
  onUpload: (file: File) => Promise<string>
) {
  const pos = view.state.selection.main.head;

  // Defer the dispatch so it runs after CodeMirror finishes processing the
  // current DOM event. Dispatching synchronously inside CM's paste/drop
  // handler triggers a measurement cycle before tiles are ready, causing
  // "No tile at position" errors.
  requestAnimationFrame(() => {
    // Re-check position is still valid after the frame
    const clampedPos = Math.min(pos, view.state.doc.length);

    view.dispatch({
      changes: { from: clampedPos, insert: PLACEHOLDER },
    });

    onUpload(file)
      .then((url) => {
        const doc = view.state.doc.toString();
        const placeholderIdx = doc.indexOf(PLACEHOLDER);
        if (placeholderIdx === -1) return;

        const name = file.name.replace(/\.[^.]+$/, "") || "image";
        view.dispatch({
          changes: {
            from: placeholderIdx,
            to: placeholderIdx + PLACEHOLDER.length,
            insert: `![${name}](${url})`,
          },
        });
      })
      .catch(() => {
        // Remove placeholder on failure
        const doc = view.state.doc.toString();
        const placeholderIdx = doc.indexOf(PLACEHOLDER);
        if (placeholderIdx === -1) return;

        view.dispatch({
          changes: {
            from: placeholderIdx,
            to: placeholderIdx + PLACEHOLDER.length,
            insert: "",
          },
        });
      });
  });
}
