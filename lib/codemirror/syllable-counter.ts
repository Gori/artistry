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

  for (let i = 1; i <= view.state.doc.lines; i++) {
    const line = view.state.doc.line(i);
    const text = line.text.trim();

    // Skip empty lines and section markers
    if (!text || SECTION_RE.test(text)) continue;

    // Skip chord-only lines
    if (/^\{[^}]+\}(\s*\{[^}]+\})*$/.test(text)) continue;

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
  }

  return Decoration.set(
    positions.map((pos, i) => widgets[i].range(pos))
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
