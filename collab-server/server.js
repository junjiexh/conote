// ============================================================================
// IMPORTS
// ============================================================================
// Node.js built-ins
import { createServer } from 'http';
import { resolve as _resolve, dirname as pathDirname } from 'path';
import { fileURLToPath } from 'url';

// Third-party dependencies
import { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import { applyUpdate } from 'yjs';
import { loadPackageDefinition, credentials } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { getProtoPath } from 'google-proto-files';

// Local modules
import * as yws from './lib/yws/index.js';
import RedisStreamAdapter from './lib/redisStream.js';
import RedisSync from './lib/redisSync.js';
import { saveSnapshot, getSnapshot, scheduleSave } from './lib/snapshot.js';
import { authenticateRequest, extractConnectionParams } from './lib/auth.js';

const { setupWSConnection, setPersistence, events: yEvents, serverId: yServerId } = yws;

/**
 * @typedef {import('./proto/collab').ProtoGrpcType} ProtoGrpcType
 * @typedef {import('./proto/collab/GetSnapshotRequest').GetSnapshotRequest} GetSnapshotRequest
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
// Server configuration
const DEFAULT_PORT = parseInt(process.env.COLLAB_SERVER_PORT || process.env.PORT || '1234', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Backend API configuration
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000/api';

// gRPC configuration
const GRPC_ADDRESS = process.env.COLLAB_GRPC_ADDRESS || 'localhost:9090';

// Snapshot persistence configuration
const SNAPSHOT_FLUSH_INTERVAL = parseInt(process.env.SNAPSHOT_FLUSH_INTERVAL || '2000', 10);

// Redis configuration for multi-instance sync
const REDIS_URL = process.env.COLLAB_REDIS_URL || '';

// Path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = pathDirname(__filename);
const PROTO_PATH = process.env.COLLAB_PROTO_PATH
  || _resolve(__dirname, 'proto/collab/collab.proto');

// ============================================================================
// GRPC CLIENT INITIALIZATION
// ============================================================================
/**
 * Initialize the gRPC client for snapshot operations
 * @returns {Object} gRPC snapshot service client
 */
const initializeGrpcClient = () => {
  const packageDefinition = loadSync(PROTO_PATH, {
    includeDirs: [pathDirname(PROTO_PATH), getProtoPath('..')],
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  /** @type {ProtoGrpcType} */
  const proto = (loadPackageDefinition(packageDefinition));
  const collabProto = proto.collab;

  return new collabProto.CollaborationSnapshotService(
    GRPC_ADDRESS,
    credentials.createInsecure(),
  );
};

const snapshotClient = initializeGrpcClient();

// ============================================================================
// REDIS SYNC INITIALIZATION
// ============================================================================
// State for tracking pending snapshot saves
const persistState = new Map();

// Redis client and sync instances
let redisClient = null;
let redisSync = null;
let localDeliverCleanup = null;

/**
 * Initialize Redis-based cross-instance synchronization
 * Falls back to local-only mode if REDIS_URL is not configured
 */
const initRedisSync = () => {
  if (!REDIS_URL) {
    console.warn('[collab] COLLAB_REDIS_URL not set; running without cross-instance sync.');

    // Local fallback: directly deliver published updates
    const handler = (payload) => {
      if (!payload?.docName || !payload?.update) {
        return;
      }
      yEvents.emit('doc:deliver', {
        docName: payload.docName,
        update: payload.update,
      });
    };

    yEvents.on('doc:publish', handler);
    localDeliverCleanup = () => yEvents.off('doc:publish', handler);

    redisSync = {
      bindDoc: async () => { },
      shutdown: () => localDeliverCleanup?.(),
    };
    return;
  }

  // Initialize Redis client and sync adapter
  redisClient = new Redis(REDIS_URL);
  redisClient.on('error', (err) => {
    console.error('[collab] redis error', err);
  });

  const adapter = new RedisStreamAdapter({
    redis: redisClient,
    serverId: yServerId,
  });

  redisSync = new RedisSync({
    adapter,
    eventsEmitter: yEvents,
    serverId: yServerId,
  });
};

initRedisSync();

/**
 * Ensure a document is hydrated with updates from Redis
 * @param {string} docName - Document identifier
 */
const ensureDocHydrated = async (docName) => {
  if (!docName || !redisSync?.bindDoc) {
    return;
  }
  try {
    await redisSync.bindDoc(docName);
  } catch (err) {
    console.error(`[collab] redis sync bind failed ${docName}`, err);
  }
};

/**
 * Shutdown Redis sync and cleanup resources
 */
let isShuttingDown = false;

/**
 * Gracefully shutdown the server and cleanup all resources
 */
const shutdown = async () => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  console.log('[collab] Shutting down...');

  // 1. Stop accepting new connections
  server.close(() => {
    console.log('[collab] HTTP server closed');
  });

  // 2. Cleanup Redis sync
  if (redisSync?.shutdown) {
    redisSync.shutdown();
  }
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (err) {
      console.error('[collab] Redis quit failed', err);
    }
    redisClient = null;
  }

  // 3. Close gRPC client
  if (snapshotClient) {
    await snapshotClient.close();
  }

  console.log('[collab] shutdown completed')
  process.exit(0);
};

// Register shutdown handlers
process.on('SIGINT', () => {
  server.emit('close');
});
process.on('SIGTERM', () => {
  server.emit('close');
});

// ============================================================================
// Y.JS PERSISTENCE SETUP
// ============================================================================
setPersistence({
  /**
   * Bind persistence to a Y.Doc - load initial state and setup auto-save
   * @param {string} docName - Document identifier
   * @param {import('yjs').Doc} ydoc - Y.Doc instance
   */
  bindState: async (docName, ydoc) => {
    if (!docName) {
      console.warn('[collab] bindState invoked with empty docName');
      return;
    }

    // Load initial snapshot from backend
    try {
      const response = await getSnapshot(docName, snapshotClient);
      if (response && response.hasSnapshot && response.snapshot && response.snapshot.length) {
        applyUpdate(ydoc, new Uint8Array(response.snapshot));
      }
    } catch (error) {
      console.error(`Failed to load snapshot for ${docName}`, error);
    }

    // Setup auto-save on document updates
    ydoc.on('update', () => scheduleSave(
      docName,
      ydoc,
      snapshotClient,
      persistState,
      SNAPSHOT_FLUSH_INTERVAL
    ));

    // Handle document destruction
    ydoc.on('destroy', () => {
      const state = persistState.get(docName);
      if (state?.timeout) {
        clearTimeout(state.timeout);
        state.timeout = null;
      }
      saveSnapshot(docName, ydoc, snapshotClient)
        .catch((error) => {
          console.error(`Failed to persist snapshot during destroy for ${docName}`, error);
        })
        .finally(() => {
          persistState.delete(docName);
        });
    });
  },

  /**
   * Write document state to persistence (flush)
   * @param {string} docName - Document identifier
   * @param {import('yjs').Doc} ydoc - Y.Doc instance
   */
  writeState: async (docName, ydoc) => {
    if (!docName) {
      console.warn('[collab] writeState invoked with empty docName');
      return;
    }
    try {
      await saveSnapshot(docName, ydoc, snapshotClient);
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

// ============================================================================
// HTTP & WEBSOCKET SERVER SETUP
// ============================================================================
const healthResponse = JSON.stringify({ status: 'ok' });

// HTTP server for health checks and WebSocket upgrades
const server = createServer((req, res) => {
  console.log(`[collab] Incoming Upgrade Request URL: ${request.url}`);

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(healthResponse);
    return;
  }
  res.writeHead(200);
  res.end('Conote collaboration server');
});

server.on('close', shutdown);

// WebSocket server for Y.js collaboration
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrade requests
server.on('upgrade', async (request, socket, head) => {
  try {
    // Extract and validate connection parameters
    const { documentId, token } = extractConnectionParams(request);
    if (!documentId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    // Ensure document is hydrated from Redis
    await ensureDocHydrated(documentId);

    // Authenticate the request
    await authenticateRequest(documentId, token, BACKEND_API_URL);

    // Upgrade to WebSocket and setup Y.js connection
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

// Start the server
server.listen(DEFAULT_PORT, HOST, () => {
  console.log(`Collaboration server listening on ${HOST}:${DEFAULT_PORT}`);
  console.log(`Forwarding access checks to ${BACKEND_API_URL}`);
  console.log(`Using collaboration snapshot service at ${GRPC_ADDRESS}`);
  if (REDIS_URL) {
    console.log(`[collab] Redis stream sync enabled (${REDIS_URL})`);
  } else {
    console.log('[collab] Redis sync disabled; running single-instance mode');
  }
});
