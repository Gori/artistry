import {
  EditorView,
  WidgetType,
  Decoration,
} from "@codemirror/view";
import {
  StateField,
  StateEffect,
  type Extension,
} from "@codemirror/state";
import { marked } from "marked";
import type { LyricsAction } from "@/lib/ai";

// Configure marked for inline rendering (no wrapping <p> for single blocks)
marked.setOptions({ breaks: true });

// ---------------------------------------------------------------------------
// State effects — dispatch these from React to drive the widget
// ---------------------------------------------------------------------------

export interface AIBlockData {
  /** Widget anchor position in the document */
  pos: number;
  content: string;
  loading: boolean;
  action: LyricsAction;
  /** The text the AI is operating on (selection or full lyrics) */
  targetText: string;
  /** Start of the replacement range (selection start, or 0) */
  selFrom: number;
  /** End of the replacement range (selection end, or doc length) */
  selTo: number;
  /** Whether the user had an active text selection */
  hasSelection: boolean;
}

/** Set up (or fully replace) the AI block */
export const setAIBlock = StateEffect.define<AIBlockData>();

/** Update just the content / loading flag (positions stay mapped) */
export const updateAIContent = StateEffect.define<{
  content: string;
  loading: boolean;
}>();

/** Remove the AI block */
export const clearAIBlock = StateEffect.define<void>();

// ---------------------------------------------------------------------------
// Callbacks — provided via a mutable ref so the widget always calls the
// latest React functions without needing to rebuild the extension.
// ---------------------------------------------------------------------------

export interface AIWidgetCallbacks {
  /** Insert text at a position (e.g. "Add another verse") */
  onAcceptText: (text: string, insertPos: number) => void;
  /** Replace a range with new text (e.g. pick an alternative) */
  onReplaceLine: (from: number, to: number, text: string) => void;
  /** Dismiss the AI block */
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

const ACTION_HEADERS: Record<LyricsAction, string> = {
  alternatives: "5 Alternatives",
  "add-verse": "New Verse",
  "explain-theme": "Theme Analysis",
  "find-synonyms": "Synonyms",
  "find-rhymes": "Rhyming Words",
  "overall-impression": "Overall Impression",
  "check-grammar": "Grammar Check",
};

/** Truncate long text for the context quote */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "\u2026";
}

class AIBlockWidget extends WidgetType {
  constructor(
    readonly data: AIBlockData,
    readonly callbacksRef: { current: AIWidgetCallbacks }
  ) {
    super();
  }

  eq(other: AIBlockWidget) {
    return (
      this.data.content === other.data.content &&
      this.data.loading === other.data.loading &&
      this.data.action === other.data.action
    );
  }

  toDOM() {
    return this.buildDOM();
  }

  updateDOM(dom: HTMLElement) {
    const contentEl = dom.querySelector(".cm-ai-content") as HTMLElement | null;
    const loadingEl = dom.querySelector(".cm-ai-loading") as HTMLElement | null;
    const actionsEl = dom.querySelector(".cm-ai-actions") as HTMLElement | null;
    if (!contentEl) return false;

    // Update content
    if (
      this.data.action === "alternatives" &&
      this.data.content &&
      !this.data.loading
    ) {
      this.renderAlternatives(contentEl);
    } else {
      contentEl.innerHTML = this.data.content
        ? (marked.parse(this.data.content) as string)
        : "";
    }

    // Toggle loading / actions visibility
    if (loadingEl) loadingEl.style.display = this.data.loading ? "" : "none";
    if (actionsEl) {
      actionsEl.style.display = this.data.loading ? "none" : "";
      if (!this.data.loading) this.buildActions(actionsEl);
    }

    return true;
  }

  /** Don't let CodeMirror handle pointer/key events inside the widget */
  ignoreEvent() {
    return true;
  }

  // ---- DOM builders -------------------------------------------------------

  /** Whether to show a context quote of the target text */
  private get showContext(): boolean {
    // Show context when there's a selection (but not for whole-doc actions)
    if (!this.data.hasSelection) return false;
    // Skip for actions that operate on the full lyrics regardless
    if (this.data.action === "add-verse") return false;
    return true;
  }

  private buildDOM(): HTMLElement {
    const container = document.createElement("div");
    container.className = "cm-ai-block";

    // Header row
    const header = document.createElement("div");
    header.className = "cm-ai-header";

    const title = document.createElement("span");
    title.textContent = ACTION_HEADERS[this.data.action];
    header.appendChild(title);

    const dismissX = document.createElement("button");
    dismissX.className = "cm-ai-dismiss-x";
    dismissX.textContent = "\u00d7";
    dismissX.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.callbacksRef.current.onDismiss();
    };
    header.appendChild(dismissX);
    container.appendChild(header);

    // Context quote (only for selection-based actions)
    if (this.showContext) {
      const ctx = document.createElement("div");
      ctx.className = "cm-ai-context";
      ctx.textContent = `\u201c${truncate(this.data.targetText, 200)}\u201d`;
      container.appendChild(ctx);
    }

    // Content area
    const content = document.createElement("div");
    content.className = "cm-ai-content";
    if (
      this.data.action === "alternatives" &&
      this.data.content &&
      !this.data.loading
    ) {
      this.renderAlternatives(content);
    } else {
      content.innerHTML = this.data.content
        ? (marked.parse(this.data.content) as string)
        : "";
    }
    container.appendChild(content);

    // Loading indicator
    const loading = document.createElement("div");
    loading.className = "cm-ai-loading";
    loading.style.display = this.data.loading ? "" : "none";
    loading.innerHTML =
      '<span class="cm-ai-spinner"></span> Generating\u2026';
    container.appendChild(loading);

    // Action buttons
    const actions = document.createElement("div");
    actions.className = "cm-ai-actions";
    actions.style.display = this.data.loading ? "none" : "";
    if (!this.data.loading) this.buildActions(actions);
    container.appendChild(actions);

    return container;
  }

  private renderAlternatives(container: HTMLElement) {
    container.innerHTML = "";
    const lines = this.data.content
      .split("\n")
      .filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const btn = document.createElement("button");
      btn.className = "cm-ai-alternative";
      btn.textContent = line;

      const cleanText = line.replace(/^\d+[.)]\s*/, "").trim();
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.callbacksRef.current.onReplaceLine(
          this.data.selFrom,
          this.data.selTo,
          cleanText
        );
      };
      container.appendChild(btn);
    }
  }

  private buildActions(container: HTMLElement) {
    container.innerHTML = "";

    if (this.data.action === "add-verse" && this.data.content) {
      const acceptBtn = document.createElement("button");
      acceptBtn.className = "cm-ai-btn cm-ai-btn-accept";
      acceptBtn.textContent = "Insert verse";
      acceptBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Insert at end of the target range
        this.callbacksRef.current.onAcceptText(
          "\n\n" + this.data.content,
          this.data.selTo
        );
      };
      container.appendChild(acceptBtn);
    }

    const dismissBtn = document.createElement("button");
    dismissBtn.className = "cm-ai-btn cm-ai-btn-dismiss";
    dismissBtn.textContent = "Dismiss";
    dismissBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.callbacksRef.current.onDismiss();
    };
    container.appendChild(dismissBtn);
  }
}

// ---------------------------------------------------------------------------
// Extension factory
// ---------------------------------------------------------------------------

/**
 * Creates a CodeMirror extension that renders an inline AI result block.
 *
 * Pass a mutable ref so callbacks always point at the latest React functions.
 */
export function createAIExtension(
  callbacksRef: { current: AIWidgetCallbacks }
): Extension {
  const field = StateField.define<AIBlockData | null>({
    create: () => null,

    update(value, tr) {
      for (const effect of tr.effects) {
        if (effect.is(setAIBlock)) return effect.value;
        if (effect.is(updateAIContent)) {
          if (!value) return value;
          return {
            ...value,
            content: effect.value.content,
            loading: effect.value.loading,
          };
        }
        if (effect.is(clearAIBlock)) return null;
      }

      // Keep positions mapped through document changes
      if (value && tr.docChanged) {
        return {
          ...value,
          pos: tr.changes.mapPos(value.pos),
          selFrom: tr.changes.mapPos(value.selFrom),
          selTo: tr.changes.mapPos(value.selTo, 1),
        };
      }

      return value;
    },

    provide: (f) =>
      EditorView.decorations.from(f, (data) => {
        if (!data) return Decoration.none;
        const widget = new AIBlockWidget(data, callbacksRef);
        return Decoration.set([
          Decoration.widget({
            widget,
            block: true,
            side: 1,
          }).range(data.pos),
        ]);
      }),
  });

  return field;
}
