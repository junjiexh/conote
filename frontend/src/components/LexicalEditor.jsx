import React, { useEffect } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';

// Plugin to update editor content when value prop changes
function UpdatePlugin({ value }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.update(() => {
      const root = $getRoot();
      const currentText = root.getTextContent();

      // Only update if the content is different
      if (currentText !== value) {
        root.clear();
        if (value) {
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode(value);
          paragraph.append(textNode);
          root.append(paragraph);
        }
      }
    });
  }, [editor, value]);

  return null;
}

const LexicalEditor = ({ value, onChange, placeholder, className }) => {
  const initialConfig = {
    namespace: 'ConoteEditor',
    theme: {
      paragraph: 'mb-1',
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
      },
    },
    onError: (error) => {
      console.error('Lexical error:', error);
    },
  };

  const handleChange = (editorState) => {
    editorState.read(() => {
      const root = $getRoot();
      const text = root.getTextContent();
      onChange(text);
    });
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={`relative ${className || ''}`}>
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              className="outline-none h-full w-full p-2"
              style={{ minHeight: 'inherit' }}
            />
          }
          placeholder={
            <div className="absolute top-2 left-2 text-muted-foreground pointer-events-none">
              {placeholder || 'Start typing...'}
            </div>
          }
          ErrorBoundary={() => <div>Error loading editor</div>}
        />
        <OnChangePlugin onChange={handleChange} />
        <HistoryPlugin />
        <UpdatePlugin value={value} />
      </div>
    </LexicalComposer>
  );
};

export default LexicalEditor;
