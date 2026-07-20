import { useCallback, useMemo, useRef } from "react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";

const BuildFallbackText = (items = []) =>
  items.map((item) => `${item.Checked ? "[x]" : "[ ]"} ${item.Text}`.trim()).join("\n");

const ParseContentToBlocks = (content, fallbackText = "") => {
  if (!content) {
    return [{ type: "paragraph", content: fallbackText }];
  }
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    // Existing notes may still contain plain text.
  }
  return [{ type: "paragraph", content }];
};

export default function NotesRichEditor({ content, fallbackItems = [], onChange = () => {}, readOnly = false }) {
  const fallbackText = useMemo(() => BuildFallbackText(fallbackItems), [fallbackItems]);
  const initialBlocks = useMemo(() => ParseContentToBlocks(content, fallbackText), [content, fallbackText]);
  const initialSerialized = useMemo(() => JSON.stringify(initialBlocks), [initialBlocks]);
  const initialIsJson = useMemo(() => {
    try {
      return Array.isArray(JSON.parse(content || ""));
    } catch (error) {
      return false;
    }
  }, [content]);
  const editor = useCreateBlockNote({ initialContent: initialBlocks });
  const hasInitialized = useRef(false);

  const handleChange = useCallback(() => {
    if (readOnly) return;
    const serialized = JSON.stringify(editor.document);
    if (serialized === content) return;
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      if (!initialIsJson && serialized === initialSerialized) return;
    }
    onChange(serialized);
  }, [content, editor, initialIsJson, initialSerialized, onChange, readOnly]);

  return (
    <div className={`notes-rich-editor${readOnly ? " is-readonly" : ""}`}>
      <BlockNoteView editor={editor} editable={!readOnly} onChange={readOnly ? undefined : handleChange} />
    </div>
  );
}
