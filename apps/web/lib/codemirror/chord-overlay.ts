import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { CHORD_RE, isDiatonic } from "@/lib/music/chords";

class ChordWidget extends WidgetType {
  constructor(
    readonly chord: string,
    readonly diatonic: boolean
  ) {
    super();
  }

  eq(other: ChordWidget) {
    return this.chord === other.chord && this.diatonic === other.diatonic;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = this.diatonic
      ? "cm-chord-badge cm-chord-diatonic"
      : "cm-chord-badge cm-chord-nondiatonic";
    span.textContent = this.chord;
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

function buildDecorations(view: EditorView, songKey?: string): DecorationSet {
  const decorations: Array<ReturnType<typeof Decoration.replace>> = [];
  const positions: Array<{ from: number; to: number }> = [];

  for (let i = 1; i <= view.state.doc.lines; i++) {
    const line = view.state.doc.line(i);
    let match;
    CHORD_RE.lastIndex = 0;

    while ((match = CHORD_RE.exec(line.text)) !== null) {
      const chord = match[1];
      const from = line.from + match.index;
      const to = from + match[0].length;

      const diatonic = songKey ? isDiatonic(chord, songKey) : true;

      positions.push({ from, to });
      decorations.push(
        Decoration.replace({
          widget: new ChordWidget(chord, diatonic),
        })
      );
    }
  }

  return Decoration.set(
    positions.map((pos, i) => decorations[i].range(pos.from, pos.to))
  );
}

/**
 * Create the chord overlay plugin. Pass songKey to color diatonic vs non-diatonic.
 */
export function createChordOverlayPlugin(songKey?: string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, songKey);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view, songKey);
        }
      }
    },
    { decorations: (v) => v.decorations }
  );
}
