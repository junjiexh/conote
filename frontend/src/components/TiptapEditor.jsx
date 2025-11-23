import { useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  List,
  CheckSquare,
  Link as LinkIcon,
  Image as ImageIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import "./TiptapEditor.css";

const EMPTY_DOCUMENT = "<p></p>";
const COLLAB_SERVER_URL =
  import.meta.env.VITE_COLLAB_URL || "ws://localhost:8000/collab";

const ToolbarButton = ({ onClick, active, icon: Icon, title, disabled, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`p-1.5 rounded hover:bg-white hover:shadow-sm text-slate-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${active ? "bg-white shadow-sm" : ""
      }`}
    title={title}
  >
    {children || <Icon size={16} />}
  </button>
);

const TiptapEditor =
  ({
    value,
    onChange,
    className,
    placeholder,
    documentId,
  }) => {
    const [collabStatus, setCollabStatus] = useState("disconnected");
    const { user, token } = useAuth();
    const [ydoc, setYdoc] = useState(null);
    const [provider, setProvider] = useState(null);

    const canUseCollaboration = Boolean(COLLAB_SERVER_URL && documentId && token);

    // create a fresh doc and provider on mount, and clean up on unmount
    useEffect(() => {
      if (!canUseCollaboration) {
        return
      }
      const doc = new Y.Doc();
      const wsProvider = new WebsocketProvider(
        COLLAB_SERVER_URL,
        String(documentId),
        doc,
        {
          params: {
            token,
          },
        },
      );

      setYdoc(doc);
      setProvider(wsProvider);
      // set collab status on provider status chang
      if (!wsProvider) {
        setCollabStatus("disconnected");
        return undefined;
      }

      const handleStatus = ({ status }) => {
        setCollabStatus(status);
      };

      wsProvider.on("status", handleStatus);
      return () => {
        wsProvider.off("status", handleStatus);
        wsProvider.destroy();
        doc.destroy();
        setProvider(null);
        setYdoc(null);
      };
    }, [documentId, canUseCollaboration, token]);

    const collabReady =
      !canUseCollaboration || (ydoc !== null && provider !== null);

    if (!collabReady && canUseCollaboration) {
      // just a loading UI
      return (
        <div className={`border rounded-lg overflow-hidden ${className || ""}`}>
          <div className="p-4 text-sm text-muted-foreground">
            Setting up collaboration…
          </div>
        </div>
      );
    }

    // Once ready, mount the inner component which calls useEditor
    return (
      <TiptapEditorInner
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        canUseCollaboration={canUseCollaboration}
        ydoc={ydoc}
        provider={provider}
        user={user}
        collabStatus={collabStatus}
      />
    );
  }

// Separate component to use hooks after collaboration setup
const TiptapEditorInner = ({
  value,
  onChange,
  placeholder,
  className,
  canUseCollaboration,
  ydoc,
  provider,
  user,
  collabStatus,
}) => {
  const [isEmpty, setIsEmpty] = useState(true);

  // Swaps the built-in document store for a Yjs document
  // and configures the caret extension for remote cursors
  const collaborationExtensions =
    canUseCollaboration && ydoc && provider
      ? [
        Collaboration.configure({
          document: ydoc,
          field: "prosemirror",
        }),
        CollaborationCaret.configure({
          provider,
          user: {
            name: user?.username || user?.email || "Anonymous",
            color: user?.email
              ? `#${Math.abs(
                user.email
                  .split("")
                  .reduce((acc, c) => acc + c.charCodeAt(0), 0),
              )
                .toString(16)
                .padStart(6, "0")
                .slice(0, 6)}`
              : "#4f46e5",
          },
        }),
      ]
      : [];

  const starterKitOptions = {
    heading: { levels: [1, 2, 3] },
    orderedList: { keepMarks: true },
    bulletList: { keepMarks: true },
    underline: false,
    link: false,
  };

  if (canUseCollaboration) {
    starterKitOptions.history = false;
    starterKitOptions.undoRedo = false;
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure(starterKitOptions),
      Underline,
      Link.configure({
        autolink: true,
        openOnClick: false,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "text-blue-600 underline hover:text-blue-800",
        },
      }),
      ...collaborationExtensions, // apply extensions
    ],
    content:
      canUseCollaboration || !value
        ? undefined
        : value.trim()
          ? value
          : EMPTY_DOCUMENT,
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
    if (!editor || canUseCollaboration) return;
    const nextContent = value && value.trim() ? value : EMPTY_DOCUMENT;
    if (nextContent !== editor.getHTML()) {
      editor.commands.setContent(nextContent, false);
      setIsEmpty(editor.isEmpty);
    }
  }, [editor, value, canUseCollaboration]);

  useEffect(() => {
    if (!editor || !canUseCollaboration || !ydoc) return;
    const fragment = ydoc.getXmlFragment("prosemirror");
    if (fragment.length === 0) {
      const initialContent = value && value.trim() ? value : EMPTY_DOCUMENT;
      editor.commands.setContent(initialContent, false);
      setIsEmpty(editor.isEmpty);
    }
  }, [editor, value, canUseCollaboration, ydoc]);

  if (!editor) {
    return (
      <div className={`border rounded-lg overflow-hidden ${className || ""}`}>
        <div className="p-4 text-sm text-muted-foreground">Loading editor…</div>
      </div>
    );
  }

  return (
    <div className={`${className || ""}`}>
      {/* Floating/Sticky Toolbar */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm z-10 flex items-center gap-1 overflow-x-auto no-scrollbar pb-3 border-b border-slate-50">
        <div className="flex items-center gap-0.5 bg-slate-50 p-1 rounded-lg border border-slate-100">
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
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
            disabled={!editor.can().chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <span className="font-serif font-bold text-sm px-0.5">H1</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
            disabled={!editor.can().chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <span className="font-serif font-bold text-sm px-0.5">H2</span>
          </ToolbarButton>
        </div>
        <div className="w-px h-6 bg-slate-200 mx-2"></div>
        <div className="flex items-center gap-0.5 bg-slate-50 p-1 rounded-lg border border-slate-100">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            icon={List}
            title="Bullet List"
            disabled={!editor.can().chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            icon={CheckSquare}
            title="Ordered List"
            disabled={!editor.can().chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            onClick={() => {
              const url = window.prompt("Enter URL:");
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            active={editor.isActive("link")}
            icon={LinkIcon}
            title="Insert Link"
          />
          <ToolbarButton
            onClick={() => alert("Image upload not implemented")}
            icon={ImageIcon}
            title="Insert Image"
          />
        </div>
        <div className="flex-1"></div>
        <span className="text-xs text-slate-300 font-mono">Markdown Supported</span>
      </div>

      {/* Editor Content */}
      <div className="relative bg-white">
        {isEmpty && (
          <div className="absolute top-0 left-0 text-slate-300 pointer-events-none select-none text-lg font-serif">
            {placeholder}
          </div>
        )}
        <EditorContent
          editor={editor}
          className="min-h-[500px] outline-none text-lg leading-relaxed text-slate-600 font-serif"
        />
      </div>
    </div>
  );
};

export default TiptapEditor;
