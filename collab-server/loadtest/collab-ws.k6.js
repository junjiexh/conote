import ws from 'k6/ws';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const messageSync = 0;
const messageAwareness = 1;

const WS_BASE = (__ENV.WS_BASE || 'ws://localhost:8000/collab').replace(/\/$/, '');
const DOC_ID = __ENV.DOC_ID || '711f3de2-d229-4c95-b072-fb275ec17bb4';
const EDIT_INTERVAL_MS = parseInt(__ENV.EDIT_INTERVAL_MS || '1500', 10);
const SESSION_MS = parseInt(__ENV.SESSION_MS || '60000', 10);
const STAGES = __ENV.STAGES ? JSON.parse(__ENV.STAGES) : [
  { duration: '30s', target: 10 },
  { duration: '60s', target: 50 },
  { duration: '30s', target: 0 },
];

export const options = {
  stages: STAGES,
};

const connectionsOk = new Counter('connections_ok');
const connectionsFailed = new Counter('connections_failed');
const connectionsClosed = new Counter('connections_closed');
const editsSent = new Counter('edits_sent');
const messagesReceived = new Counter('messages_received');
const syncErrors = new Counter('sync_errors');

const sendBinary = (socket, u8) => {
  const payload = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  socket.send(payload);
};

const handleSyncMessage = (socket, doc, decoder) => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  try {
    syncProtocol.readSyncMessage(decoder, encoder, doc, null);
  } catch (err) {
    syncErrors.add(1);
  }
  if (encoding.length(encoder) > 1) {
    sendBinary(socket, encoding.toUint8Array(encoder));
  }
};

const handleAwarenessMessage = (socket, decoder, awareness) => {
  const update = decoding.readVarUint8Array(decoder);
  awarenessProtocol.applyAwarenessUpdate(awareness, update, socket);
};

const registerAwareness = (socket, awareness) => {
  const awarenessUpdateHandler = ({ added, updated, removed }) => {
    const changedClients = added.concat(updated, removed);
    if (!changedClients.length) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
    sendBinary(socket, encoding.toUint8Array(encoder));
  };
  awareness.on('update', awarenessUpdateHandler);
  awareness.setLocalState({
    user: `vu-${__VU}`,
    color: `hsl(${(__VU * 37) % 360}deg,70%,70%)`,
  });
};

const registerDocUpdate = (socket, doc) => {
  doc.on('update', (update, origin) => {
    if (!origin || origin.type !== 'local-edit') return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    sendBinary(socket, encoding.toUint8Array(encoder));
    editsSent.add(1);
  });
};

const scheduleEdits = (socket, doc) => {
  let seq = 0;
  const text = doc.getText('content');
  const sendEdit = () => {
    const id = `vu${__VU}-t${Date.now()}-${seq++}`;
    doc.transact(() => {
      const pos = Math.max(0, Math.min(text.length, Math.floor(Math.random() * (text.length + 1))));
      text.insert(pos, ` ${id}`);
    }, { type: 'local-edit', id });
  };
  socket.setInterval(() => {
    if (socket.readyState === 1) {
      sendEdit();
    }
  }, EDIT_INTERVAL_MS);
};

export default function () {
  const url = `${WS_BASE}/${DOC_ID}`;
  const res = ws.connect(url, {}, (socket) => {
    const doc = new Y.Doc({ gc: true });
    const awareness = new awarenessProtocol.Awareness(doc);

    registerAwareness(socket, awareness);
    registerDocUpdate(socket, doc);

    socket.on('message', (data) => {
      messagesReceived.add(1);
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const messageType = decoding.readVarUint(decoder);
      if (messageType === messageSync) {
        handleSyncMessage(socket, doc, decoder);
      } else if (messageType === messageAwareness) {
        handleAwarenessMessage(socket, decoder, awareness);
      }
    });

    socket.on('open', () => {
      connectionsOk.add(1);
      scheduleEdits(socket, doc);
      socket.setTimeout(() => socket.close(), SESSION_MS);
    });

    socket.on('error', () => {
      syncErrors.add(1);
    });

    socket.on('close', () => {
      connectionsClosed.add(1);
      awarenessProtocol.removeAwarenessStates(
        awareness,
        Array.from(awareness.getStates().keys()),
        socket,
      );
      doc.destroy();
    });
  });

  check(res, {
    'ws status 101': (r) => r && r.status === 101,
  }) || connectionsFailed.add(1);
}
