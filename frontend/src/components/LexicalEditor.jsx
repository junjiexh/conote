import React, { useEffect, useCallback, useMemo } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND
} from 'lexical';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { TRANSFORMERS } from '@lexical/markdown';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  Undo,
  Redo
} from 'lucide-react';

// Toolbar Component
function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = React.useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    code: false
  });

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setActiveFormats({
        bold: selection.hasFormat('bold'),
        italic: selection.hasFormat('italic'),
        underline: selection.hasFormat('underline'),
        strikethrough: selection.hasFormat('strikethrough'),
        code: selection.hasFormat('code')
      });
    }
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  const formatText = (format) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const ToolbarButton = ({ onClick, active, icon: Icon, title }) => (
    <button
      onClick={onClick}
      className={`p-2 rounded hover:bg-gray-200 transition-colors ${
        active ? 'bg-gray-300' : ''
      }`}
      title={title}
      type="button"
    >
      <Icon size={18} />
    </button>
  );

  return (
    <div className="flex items-center gap-1 p-2 border-b bg-gray-50 flex-wrap">
      <ToolbarButton
        onClick={() => editor.dispatchCommand(UNDO_COMMAND)}
        icon={Undo}
        title="Undo"
      />
      <ToolbarButton
        onClick={() => editor.dispatchCommand(REDO_COMMAND)}
        icon={Redo}
        title="Redo"
      />
      <div className="w-px h-6 bg-gray-300 mx-1" />
      <ToolbarButton
        onClick={() => formatText('bold')}
        active={activeFormats.bold}
        icon={Bold}
        title="Bold"
      />
      <ToolbarButton
        onClick={() => formatText('italic')}
        active={activeFormats.italic}
        icon={Italic}
        title="Italic"
      />
      <ToolbarButton
        onClick={() => formatText('underline')}
        active={activeFormats.underline}
        icon={Underline}
        title="Underline"
      />
      <ToolbarButton
        onClick={() => formatText('strikethrough')}
        active={activeFormats.strikethrough}
        icon={Strikethrough}
        title="Strikethrough"
      />
      <ToolbarButton
        onClick={() => formatText('code')}
        active={activeFormats.code}
        icon={Code}
        title="Code"
      />
    </div>
  );
}

// Plugin to update editor content when value prop changes
function UpdatePlugin({ value }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!value) {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
      });
      return;
    }

    editor.update(() => {
      const root = $getRoot();

      // Generate HTML from current state to compare
      const currentHtml = $generateHtmlFromNodes(editor, null);

      // Only update if content is different
      if (currentHtml !== value) {
        root.clear();

        // Parse HTML and create nodes
        const parser = new DOMParser();
        const dom = parser.parseFromString(value, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);

        // Append nodes to root
        nodes.forEach(node => root.append(node));
      }
    });
  }, [editor, value]);

  return null;
}

const LexicalEditor = ({ value, onChange, placeholder, className }) => {
  const initialConfig = useMemo(() => ({
    namespace: 'ConoteEditor',
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
      AutoLinkNode
    ],
    theme: {
      paragraph: 'mb-2',
      heading: {
        h1: 'text-3xl font-bold mb-3',
        h2: 'text-2xl font-bold mb-2',
        h3: 'text-xl font-bold mb-2'
      },
      list: {
        ul: 'list-disc list-inside ml-4 mb-2',
        ol: 'list-decimal list-inside ml-4 mb-2',
        listitem: 'ml-2'
      },
      quote: 'border-l-4 border-gray-400 pl-4 italic my-2',
      code: 'bg-gray-100 px-1 py-0.5 rounded font-mono text-sm',
      codeblock: 'bg-gray-100 p-4 rounded font-mono text-sm mb-2 overflow-x-auto',
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
        strikethrough: 'line-through',
        code: 'bg-gray-100 px-1 py-0.5 rounded font-mono text-sm'
      },
      link: 'text-blue-600 underline hover:text-blue-800'
    },
    onError: (error) => {
      console.error('Lexical error:', error);
    },
  }), []);

  const handleChange = (editorState, editor) => {
    editorState.read(() => {
      // Generate HTML from editor state
      const htmlString = $generateHtmlFromNodes(editor, null);
      onChange(htmlString);
    });
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={`border rounded-lg overflow-hidden ${className || ''}`}>
        <ToolbarPlugin />
        <div className="relative bg-background">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="outline-none min-h-[200px] p-4"
                style={{ minHeight: 'inherit' }}
              />
            }
            placeholder={
              <div className="absolute top-4 left-4 text-gray-400 pointer-events-none select-none">
                {placeholder || 'Start typing...'}
              </div>
            }
            ErrorBoundary={() => <div className="p-4 text-red-600">Error loading editor</div>}
          />
        </div>
        <OnChangePlugin onChange={handleChange} />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <UpdatePlugin value={value} />
      </div>
    </LexicalComposer>
  );
};

export default LexicalEditor;
