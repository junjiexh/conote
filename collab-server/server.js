import { createServer } from 'http';
import { resolve as _resolve, dirname } from 'path';
import { WebSocketServer } from 'ws';
import * as yws from './lib/yws';
const { setupWSConnection, setPersistence } = yws;
import { encodeStateAsUpdate, applyUpdate } from 'yjs';
import { loadPackageDefinition, credentials } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { getProtoPath } from 'google-proto-files';

/**
 * @typedef {import('./proto/collab').ProtoGrpcType} ProtoGrpcType
 * @typedef {import('./proto/collab/GetSnapshotRequest').GetSnapshotRequest} GetSnapshotRequest
 */

const DEFAULT_PORT = parseInt(process.env.COLLAB_SERVER_PORT || process.env.PORT || '1234', 10);
const HOST = process.env.HOST || '0.0.0.0';
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000/api';
const GRPC_ADDRESS = process.env.COLLAB_GRPC_ADDRESS || 'localhost:9090';
const SNAPSHOT_FLUSH_INTERVAL = parseInt(process.env.SNAPSHOT_FLUSH_INTERVAL || '2000', 10);
const PROTO_PATH = process.env.COLLAB_PROTO_PATH
  || _resolve(__dirname, 'proto/collab/collab.proto');

const packageDefinition = loadSync(PROTO_PATH, {
  includeDirs: [dirname(PROTO_PATH), getProtoPath('..')],
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

/** @type {ProtoGrpcType} */
const proto = (loadPackageDefinition(packageDefinition));
const collabProto = proto.collab;
const snapshotClient = new collabProto.CollaborationSnapshotService(
  GRPC_ADDRESS,
  credentials.createInsecure(),
);

const persistState = new Map();

const encodeDocumentState = (ydoc) => {
  const update = encodeStateAsUpdate(ydoc);
  return Buffer.from(update);
};

const saveSnapshot = (documentId, ydoc) => {
  if (!documentId) {
    console.warn('[collab] skip saveSnapshot: empty documentId');
    return Promise.resolve();
  }
  const payload = encodeDocumentState(ydoc);
  console.info(`[collab] saveSnapshot -> id=${documentId} bytes=${payload.length}`);
  return new Promise((resolve, reject) => {
    snapshotClient.saveSnapshot(
      { documentId: documentId, snapshot: payload },
      (err) => {
        if (err) {
          console.error(`[collab] saveSnapshot failed ${documentId}`, err);
          reject(err);
        } else {
          console.info(`[collab] saveSnapshot <- ok id=${documentId}`);
          resolve();
        }
      },
    );
  });
};

const getSnapshot = (documentId) => {
  if (!documentId) {
    console.warn('[collab] skip getSnapshot: empty documentId');
    return Promise.resolve(null);
  }
  console.info(`[collab] getSnapshot -> id=${documentId}`);
  return new Promise((resolve, reject) => {
    snapshotClient.getSnapshot({ documentId: documentId }, (err, res) => {
      if (err) {
        console.error(`[collab] getSnapshot failed ${documentId}`, err);
        reject(err);
      } else {
        console.info(
          `[collab] getSnapshot <- id=${documentId} hasSnapshot=${res?.hasSnapshot} bytes=${res?.snapshot?.length || 0
          }`,
        );
        resolve(res);
      }
    });
  });
};

const scheduleSave = (documentId, ydoc) => {
  let state = persistState.get(documentId);
  if (!state) {
    state = { timeout: null };
    persistState.set(documentId, state);
  }
  if (state.timeout) {
    return;
  }
  state.timeout = setTimeout(async () => {
    try {
      await saveSnapshot(documentId, ydoc);
    } catch (error) {
      console.error(`Failed to persist snapshot for ${documentId}`, error);
    } finally {
      state.timeout = null;
    }
  }, SNAPSHOT_FLUSH_INTERVAL);
};

setPersistence({
  bindState: async (docName, ydoc) => {
    if (!docName) {
      console.warn('[collab] bindState invoked with empty docName');
      return;
    }
    try {
      const response = await getSnapshot(docName);
      if (response && response.hasSnapshot && response.snapshot && response.snapshot.length) {
        applyUpdate(ydoc, new Uint8Array(response.snapshot));
      }
    } catch (error) {
      console.error(`Failed to load snapshot for ${docName}`, error);
    }

    ydoc.on('update', () => scheduleSave(docName, ydoc));
    ydoc.on('destroy', () => {
      const state = persistState.get(docName);
      if (state?.timeout) {
        clearTimeout(state.timeout);
        state.timeout = null;
      }
      saveSnapshot(docName, ydoc)
        .catch((error) => {
          console.error(`Failed to persist snapshot during destroy for ${docName}`, error);
        })
        .finally(() => {
          persistState.delete(docName);
        });
    });
  },
  writeState: async (docName, ydoc) => {
    if (!docName) {
      console.warn('[collab] writeState invoked with empty docName');
      return;
    }
    try {
      await saveSnapshot(docName, ydoc);
    } catch (error) {
      console.error(`Failed to flush snapshot for ${docName}`, error);
    } finally {
      const state = persistState.get(docName);
      if (state?.timeout) {
        clearTimeout(state.timeout);
      }
      persistState.delete(docName);
    }
  },
});

const healthResponse = JSON.stringify({ status: 'ok' });

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(healthResponse);
    return;
  }
  res.writeHead(200);
  res.end('Conote collaboration server');
});

const wss = new WebSocketServer({ noServer: true });

const authenticateRequest = async (documentId, token) => {
  if (!token) {
    throw new Error('Missing bearer token');
  }
  const response = await fetch(`${BACKEND_API_URL}/sharing/document/${documentId}/check-access`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Access denied (${response.status})`);
  }
};

const extractConnectionParams = (req) => {
  const requestUrl = new URL(req.url, 'http://localhost');
  const pathSegments = requestUrl.pathname.split('/').filter(Boolean);
  return {
    documentId: pathSegments[0]?.trim(),
    token: requestUrl.searchParams.get('token'),
  };
};

server.on('upgrade', async (request, socket, head) => {
  try {
    const { documentId, token } = extractConnectionParams(request);
    if (!documentId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    await authenticateRequest(documentId, token);
    wss.handleUpgrade(request, socket, head, (ws) => {
      const cleanup = () => {
        ws.removeAllListeners();
      };
      ws.on('close', cleanup);
      setupWSConnection(ws, request, { docName: documentId });
    });
  } catch (error) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
  }
});

server.listen(DEFAULT_PORT, HOST, () => {
  console.log(`Collaboration server listening on ${HOST}:${DEFAULT_PORT}`);
  console.log(`Forwarding access checks to ${BACKEND_API_URL}`);
  console.log(`Using collaboration snapshot service at ${GRPC_ADDRESS}`);
});
