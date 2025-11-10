# Issues

- [x] Unexpected behavior when try to save empty editor body.
- [ ] Improve ui. Use claude theme
- [ ] Support rich-text
    - Tiptap (modern, headless, based on Prosemirror), Quill.js, or Lexical, compare them and make decisions
- [ ] Real time collaboration
    - Y.js or Automerge
- [ ] Offline-First Support
    - Use Service Workers to cache the application shell (the HTML, CSS, JS) and IndexedDB (or a wrapper like localForage) to store the actual note data.
- [ ] Optimistic UI Updates: When a user renames a note, it should rename instantly in the UI, even before the backend confirms the change.
- [ ] Drag-and-Drop Functionality
    - Cannot move documents now
- [ ] Auto-saving
- [ ] Version history
