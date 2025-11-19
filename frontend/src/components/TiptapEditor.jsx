import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Undo,
  Redo,
  Link as LinkIcon,
} from "lucide-react";

const EMPTY_DOCUMENT = "<p></p>";

const ToolbarButton = ({ onClick, active, icon: Icon, title, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`p-2 rounded hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      active ? "bg-gray-300" : ""
    }`}
    title={title}
  >
    <Icon size={18} />
  </button>
);

const TiptapEditor = ({
  value,
  onChange,
  placeholder = "Start typing...",
  className,
}) => {
  const [isEmpty, setIsEmpty] = useState(true);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        orderedList: { keepMarks: true },
        bulletList: { keepMarks: true },
      }),
      Underline,
      Link.configure({
        autolink: true,
        openOnClick: false,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "text-blue-600 underline hover:text-blue-800",
        },
      }),
    ],
    content: value && value.trim() ? value : EMPTY_DOCUMENT,
    autofocus: false,
    onCreate: ({ editor }) => {
      setIsEmpty(editor.isEmpty);
    },
    onUpdate: ({ editor }) => {
      setIsEmpty(editor.isEmpty);
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    const nextContent = value && value.trim() ? value : EMPTY_DOCUMENT;
    if (nextContent !== editor.getHTML()) {
      editor.commands.setContent(nextContent, false);
      setIsEmpty(editor.isEmpty);
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className={`border rounded-lg overflow-hidden ${className || ""}`}>
        <div className="p-4 text-sm text-muted-foreground">Loading editor…</div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${className || ""}`}>
      <div className="flex items-center gap-1 p-2 border-b bg-gray-50 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          icon={Undo}
          title="Undo"
          disabled={!editor.can().chain().focus().undo().run()}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          icon={Redo}
          title="Redo"
          disabled={!editor.can().chain().focus().redo().run()}
        />
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          icon={Bold}
          title="Bold"
          disabled={!editor.can().chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          icon={Italic}
          title="Italic"
          disabled={!editor.can().chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          icon={UnderlineIcon}
          title="Underline"
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          icon={Strikethrough}
          title="Strikethrough"
          disabled={!editor.can().chain().focus().toggleStrike().run()}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          icon={Code}
          title="Code"
          disabled={!editor.can().chain().focus().toggleCode().run()}
        />
      </div>

      <div className="relative bg-background">
        {isEmpty && (
          <div className="absolute top-4 left-4 text-gray-400 pointer-events-none select-none">
            {placeholder}
          </div>
        )}
        <EditorContent
          editor={editor}
          className="min-h-[200px] p-4 outline-none leading-relaxed"
        />
      </div>
    </div>
  );
};

export default TiptapEditor;
