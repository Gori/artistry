import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { countLineSyllables } from "@/lib/lyrics/analytics";

const SECTION_RE = /^\[([^\]]+)\]\s*$/;

class SyllableWidget extends WidgetType {
  constructor(readonly count: number) {
    super();
  }

  eq(other: SyllableWidget) {
    return this.count === other.count;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-syllable-count";
    span.textContent = String(this.count);
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const widgets: Array<ReturnType<typeof Decoration.widget>> = [];
  const positions: number[] = [];

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const text = line.text.trim();

      // Skip empty lines and section markers
      if (!text || SECTION_RE.test(text)) {
        pos = line.to + 1;
        continue;
      }

      // Skip chord-only lines
      if (/^\{[^}]+\}(\s*\{[^}]+\})*$/.test(text)) {
        pos = line.to + 1;
        continue;
      }

      const count = countLineSyllables(text);
      if (count > 0) {
        positions.push(line.to);
        widgets.push(
          Decoration.widget({
            widget: new SyllableWidget(count),
            side: 1,
          })
        );
      }

      pos = line.to + 1;
    }
  }

  return Decoration.set(
    positions.map((pos, i) => widgets[i].range(pos)),
    true
  );
}

export const syllableCounterPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
