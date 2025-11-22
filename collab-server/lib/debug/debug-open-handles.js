// debug-open-handles.js
import why from 'why-is-node-running';

try {
  why();
} catch (err) {
  console.error("why-is-node-running failed:", err);
}
