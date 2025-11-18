import React, { useEffect, useRef } from 'react';
import EditorJS from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import Paragraph from '@editorjs/paragraph';
import Quote from '@editorjs/quote';
import Code from '@editorjs/code';
import CheckList from '@editorjs/checklist';
import Table from '@editorjs/table';

const EditorJSComponent = ({ value, onChange, placeholder, className }) => {
  const editorRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Initialize Editor.js only once
    if (editorInstanceRef.current || isInitializedRef.current) {
      return;
    }

    isInitializedRef.current = true;

    // Parse initial value
    let initialData = null;
    if (value) {
      try {
        // If value is a string, try to parse it as JSON
        if (typeof value === 'string') {
          const trimmed = value.trim();
          // Check if it's valid JSON (starts with { and ends with })
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            initialData = JSON.parse(value);
          } else {
            // If it's HTML or plain text (legacy content), start fresh
            console.info('Legacy HTML/text content detected, starting with empty editor');
            initialData = null;
          }
        } else {
          initialData = value;
        }
      } catch (error) {
        console.info('Invalid JSON content, starting with empty editor');
        // If parsing fails, start with empty editor
        initialData = null;
      }
    }

    // Create Editor.js instance
    const editor = new EditorJS({
      holder: editorRef.current,
      placeholder: placeholder || 'Start typing or press Tab for commands...',
      tools: {
        header: {
          class: Header,
          config: {
            placeholder: 'Enter a header',
            levels: [1, 2, 3, 4, 5, 6],
            defaultLevel: 2
          }
        },
        paragraph: {
          class: Paragraph,
          inlineToolbar: true,
        },
        list: {
          class: List,
          inlineToolbar: true,
          config: {
            defaultStyle: 'unordered'
          }
        },
        checklist: {
          class: CheckList,
          inlineToolbar: true,
        },
        quote: {
          class: Quote,
          inlineToolbar: true,
          config: {
            quotePlaceholder: 'Enter a quote',
            captionPlaceholder: 'Quote\'s author',
          },
        },
        code: {
          class: Code,
          config: {
            placeholder: 'Enter code'
          }
        },
        table: {
          class: Table,
          inlineToolbar: true,
          config: {
            rows: 2,
            cols: 3,
          },
        },
      },
      data: initialData || undefined,
      onChange: async (api) => {
        // Get current content and notify parent
        try {
          const outputData = await api.saver.save();
          if (onChange) {
            onChange(JSON.stringify(outputData));
          }
        } catch (error) {
          console.error('Failed to save editor data:', error);
        }
      },
      minHeight: 200,
    });

    editorInstanceRef.current = editor;

    // Cleanup function
    return () => {
      if (editorInstanceRef.current && editorInstanceRef.current.destroy) {
        editorInstanceRef.current.destroy();
        editorInstanceRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, []); // Empty dependency array - only initialize once

  // Handle external value updates (when switching documents)
  useEffect(() => {
    if (!editorInstanceRef.current || !editorInstanceRef.current.isReady) {
      return;
    }

    const updateContent = async () => {
      try {
        let newData = null;
        if (value) {
          if (typeof value === 'string') {
            const trimmed = value.trim();
            // Check if it's valid JSON (starts with { and ends with })
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              try {
                newData = JSON.parse(value);
              } catch (e) {
                console.info('Failed to parse JSON, clearing editor');
                newData = null;
              }
            } else {
              // If it's HTML or plain text (legacy content), clear editor
              console.info('Legacy content detected, clearing editor');
              newData = null;
            }
          } else {
            newData = value;
          }
        }

        if (editorInstanceRef.current && editorInstanceRef.current.isReady) {
          await editorInstanceRef.current.isReady;
          if (newData) {
            await editorInstanceRef.current.render(newData);
          } else {
            await editorInstanceRef.current.clear();
          }
        }
      } catch (error) {
        console.info('Failed to update editor content, clearing:', error.message);
        // If there's any error, just clear the editor
        try {
          if (editorInstanceRef.current && editorInstanceRef.current.isReady) {
            await editorInstanceRef.current.clear();
          }
        } catch (clearError) {
          console.error('Failed to clear editor:', clearError);
        }
      }
    };

    updateContent();
  }, [value]);

  return (
    <div className={`editorjs-container ${className || ''}`}>
      <div
        ref={editorRef}
        className="prose max-w-none"
        style={{ minHeight: '200px' }}
      />
      <style>{`
        .editorjs-container {
          width: 100%;
          height: 100%;
          position: relative;
          overflow: visible;
        }

        .codex-editor {
          position: relative;
          z-index: 1;
        }

        .codex-editor__redactor {
          padding-bottom: 50px !important;
        }

        .ce-block__content,
        .ce-toolbar__content {
          max-width: 100%;
        }

        .ce-toolbar__plus {
          color: #000;
        }

        .ce-toolbar__settings-btn {
          color: #000;
        }

        .ce-toolbox {
          background: white;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .ce-popover {
          background: white;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .ce-popover__item-icon {
          background: #f7fafc;
          border-radius: 4px;
        }

        .ce-popover__item:hover {
          background: #f7fafc;
        }

        .ce-inline-toolbar {
          background: white;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .ce-conversion-toolbar {
          background: white;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .ce-settings {
          background: white;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
};

export default EditorJSComponent;
