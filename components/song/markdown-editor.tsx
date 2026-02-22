"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import CodeMirror, { EditorView, type ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import {
  Decoration,
  type DecorationSet,
  ViewPlugin,
  type ViewUpdate,
  MatchDecorator,
  WidgetType,
} from "@codemirror/view";
import { type Extension, StateField } from "@codemirror/state";

const SECTION_COLORS: Record<string, string> = {
  verse: "var(--section-verse)",
  chorus: "var(--section-chorus)",
  bridge: "var(--section-bridge)",
  "pre-chorus": "var(--section-pre-chorus)",
  "pre chorus": "var(--section-pre-chorus)",
  intro: "var(--section-intro)",
  outro: "var(--section-outro)",
  hook: "var(--section-hook)",
  instrumental: "var(--section-instrumental)",
  interlude: "var(--section-interlude)",
};

function getSectionColor(name: string): string {
  const normalized = name.toLowerCase().replace(/\s*\d+\s*$/, "").trim();
  return SECTION_COLORS[normalized] ?? "var(--section-instrumental)";
}

const highlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "700", fontSize: "1.4em" },
  { tag: tags.heading2, fontWeight: "700", fontSize: "1.2em" },
  { tag: tags.heading3, fontWeight: "600", fontSize: "1.1em" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.monospace, fontFamily: "'PT Root UI', monospace", fontSize: "0.9em", background: "var(--muted)", padding: "1px 4px", borderRadius: "3px" },
  { tag: tags.link, textDecoration: "underline", color: "var(--link)" },
  { tag: tags.url, color: "var(--link)" },
  { tag: tags.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
]);

// ---------------------------------------------------------------------------
// Image preview widget — renders <img> below ![alt](url) lines
// ---------------------------------------------------------------------------

class ImageWidget extends WidgetType {
  constructor(readonly url: string, readonly alt: string) {
    super();
  }

  eq(other: ImageWidget) {
    return this.url === other.url;
  }

  toDOM() {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-image-widget";

    const img = document.createElement("img");
    img.src = this.url;
    img.alt = this.alt;
    img.loading = "lazy";
    img.onload = () => wrapper.classList.add("cm-image-loaded");
    img.onerror = () => wrapper.classList.add("cm-image-error");

    wrapper.appendChild(img);
    return wrapper;
  }

  ignoreEvent() {
    return true;
  }
}

const IMAGE_RE = /!\[([^\]]*)\]\((\S+)\)/g;

function buildImageDecorations(doc: { lines: number; line(n: number): { text: string; to: number } }): DecorationSet {
  const ranges: Array<ReturnType<typeof Decoration.widget>> = [];
  const positions: number[] = [];

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    let match;
    IMAGE_RE.lastIndex = 0;
    while ((match = IMAGE_RE.exec(line.text)) !== null) {
      const url = match[2];
      const alt = match[1] || "image";
      if (!url || url === "()") continue;

      positions.push(line.to);
      ranges.push(
        Decoration.widget({
          widget: new ImageWidget(url, alt),
          block: true,
          side: 1,
        })
      );
    }
  }

  return Decoration.set(positions.map((pos, i) => ranges[i].range(pos)));
}

const imagePreviewPlugin = StateField.define<DecorationSet>({
  create(state) {
    return buildImageDecorations(state.doc);
  },
  update(decos, tr) {
    if (tr.docChanged) {
      return buildImageDecorations(tr.state.doc);
    }
    return decos;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

const sectionDecorator = new MatchDecorator({
  regexp: /^\[([^\]]+)\].*$/gm,
  decoration: (match) => {
    const name = match[1];
    const color = getSectionColor(name);
    return Decoration.mark({
      attributes: {
        style: `color: ${color}; font-weight: 600;`,
        class: "cm-section-marker",
      },
    });
  },
});

const sectionPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = sectionDecorator.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = sectionDecorator.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations }
);

const baseTheme = EditorView.theme({
  "&": { background: "transparent" },
  ".cm-content": { caretColor: "var(--foreground)" },
  ".cm-cursor": { borderLeftColor: "var(--foreground)" },
});

// ---------------------------------------------------------------------------
// Context menu info passed to the parent
// ---------------------------------------------------------------------------

export interface EditorContextMenuInfo {
  lineNumber: number;
  lineText: string;
  lineFrom: number;
  lineTo: number;
  /** Currently selected text (empty string if no selection) */
  selectedText: string;
  selectionFrom: number;
  selectionTo: number;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  additionalExtensions,
  onEditorContextMenu,
  onView,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Extra CM extensions (e.g. AI widget) — should be stable / memoized */
  additionalExtensions?: Extension[];
  /** Called on right-click with line info + coordinates */
  onEditorContextMenu?: (info: EditorContextMenuInfo) => void;
  /** Called when the EditorView is created (or null on unmount) */
  onView?: (view: EditorView | null) => void;
}) {
  const handleChange = useCallback(
    (val: string) => {
      onChange(val);
    },
    [onChange]
  );

  // Keep a stable ref for the context-menu handler so the extension doesn't
  // need to be recreated when the callback identity changes.
  const ctxMenuRef = useRef(onEditorContextMenu);
  ctxMenuRef.current = onEditorContextMenu;

  const contextMenuHandler = useMemo(
    () =>
      EditorView.domEventHandlers({
        contextmenu: (event, view) => {
          const handler = ctxMenuRef.current;
          if (!handler) return false;

          const pos = view.posAtCoords({
            x: event.clientX,
            y: event.clientY,
          });
          if (pos === null) return false;

          event.preventDefault();
          const line = view.state.doc.lineAt(pos);
          const { from: selFrom, to: selTo } = view.state.selection.main;
          const selectedText =
            selFrom !== selTo ? view.state.sliceDoc(selFrom, selTo) : "";
          handler({
            lineNumber: line.number - 1, // 0-indexed
            lineText: line.text,
            lineFrom: line.from,
            lineTo: line.to,
            selectedText,
            selectionFrom: selFrom,
            selectionTo: selTo,
            x: event.clientX,
            y: event.clientY,
          });
          return true;
        },
      }),
    []
  );

  // Capture view reference via a lightweight ViewPlugin
  const viewRef = useRef<EditorView | null>(null);
  const onViewRef = useRef(onView);
  onViewRef.current = onView;

  const viewCapture = useMemo(
    () =>
      ViewPlugin.define((view) => {
        viewRef.current = view;
        onViewRef.current?.(view);
        return {
          destroy() {
            viewRef.current = null;
            onViewRef.current?.(null);
          },
        };
      }),
    []
  );

  // Tear down on unmount
  useEffect(() => {
    return () => {
      onViewRef.current?.(null);
    };
  }, []);

  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(highlightStyle),
      sectionPlugin,
      imagePreviewPlugin,
      baseTheme,
      EditorView.lineWrapping,
      contextMenuHandler,
      viewCapture,
      ...(additionalExtensions ?? []),
    ],
    [additionalExtensions, contextMenuHandler, viewCapture]
  );

  const basicSetup: ReactCodeMirrorProps["basicSetup"] = useMemo(
    () => ({
      lineNumbers: false,
      foldGutter: false,
      highlightActiveLine: false,
      highlightActiveLineGutter: false,
      indentOnInput: false,
      bracketMatching: false,
      closeBrackets: false,
    }),
    []
  );

  return (
    <CodeMirror
      value={value}
      onChange={handleChange}
      extensions={extensions}
      basicSetup={basicSetup}
      placeholder={placeholder}
      className="flex-1 overflow-hidden"
      theme="none"
    />
  );
}
