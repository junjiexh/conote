const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { setupWSConnection, setPersistence } = require('y-websocket/bin/utils');
const Y = require('yjs');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const googleProtoFiles = require('google-proto-files');

const DEFAULT_PORT = parseInt(process.env.COLLAB_SERVER_PORT || process.env.PORT || '1234', 10);
const HOST = process.env.HOST || '0.0.0.0';
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000/api';
const GRPC_ADDRESS = process.env.COLLAB_GRPC_ADDRESS || 'localhost:9090';
const SNAPSHOT_FLUSH_INTERVAL = parseInt(process.env.SNAPSHOT_FLUSH_INTERVAL || '2000', 10);
const PROTO_PATH = process.env.COLLAB_PROTO_PATH
  || path.resolve(__dirname, 'proto/collab/collab.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  includeDirs: [path.dirname(PROTO_PATH), googleProtoFiles.getProtoPath('..')],
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const collabProto = grpc.loadPackageDefinition(packageDefinition).collab;
const snapshotClient = new collabProto.CollaborationSnapshotService(
  GRPC_ADDRESS,
  grpc.credentials.createInsecure(),
);

const persistState = new Map();

const encodeDocumentState = (ydoc) => {
  const update = Y.encodeStateAsUpdate(ydoc);
  return Buffer.from(update);
};

const saveSnapshot = (documentId, ydoc) => {
  const payload = encodeDocumentState(ydoc);
  return new Promise((resolve, reject) => {
    snapshotClient.saveSnapshot(
      { document_id: documentId, snapshot: payload },
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      },
    );
  });
};

const getSnapshot = (documentId) =>
  new Promise((resolve, reject) => {
    snapshotClient.getSnapshot({ document_id: documentId }, (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });

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
    try {
      const response = await getSnapshot(docName);
      if (response && response.has_snapshot && response.snapshot && response.snapshot.length) {
        Y.applyUpdate(ydoc, new Uint8Array(response.snapshot));
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

const server = http.createServer((req, res) => {
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
    documentId: pathSegments[0],
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
