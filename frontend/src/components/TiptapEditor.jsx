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
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import "./TiptapEditor.css";

const EMPTY_DOCUMENT = "<p></p>";
const COLLAB_SERVER_URL =
  import.meta.env.VITE_COLLAB_URL || "ws://localhost:1234";

const ToolbarButton = ({ onClick, active, icon: Icon, title, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`p-2 rounded hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${active ? "bg-gray-300" : ""
      }`}
    title={title}
  >
    <Icon size={18} />
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
    <div className={`border rounded-lg overflow-hidden ${className || ""}`}>
      <div className="flex items-center gap-1 p-2 border-b bg-gray-50 flex-wrap">
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
        {canUseCollaboration && (
          <div className="ml-auto text-xs text-muted-foreground">
            {collabStatus === "connected"
              ? "Collaborative editing active"
              : "Connecting collaboration…"}
          </div>
        )}
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
