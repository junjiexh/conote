import Redis from 'ioredis';
import { loadPackageDefinition, credentials } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { applyUpdate, Doc as YDoc } from 'yjs';
import { resolve as _resolve, dirname as pathDirname } from 'path';
import { fileURLToPath } from 'url';
import { getProtoPath } from 'google-proto-files';

import { claimSnapshotTask, completeSnapshotTask, postponeSnapshotTask, snapshotQueueDefaults, createWorkerId } from './lib/snapshotQueue.js';
import { getSnapshot, persistSnapshot } from './lib/snapshot.js';
import RedisStreamAdapter from './lib/redisStream.js';

const DEFAULT_PORT = parseInt(process.env.COLLAB_SERVER_PORT || process.env.PORT || '1234', 10);

// Path resolution
const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = pathDirname(currentFilename);
const PROTO_PATH = process.env.COLLAB_PROTO_PATH
  || _resolve(currentDirname, 'proto/collab/collab.proto');

// Backend API configuration
const GRPC_ADDRESS = process.env.COLLAB_GRPC_ADDRESS || 'localhost:9090';

// Redis configuration
const REDIS_URL = process.env.COLLAB_REDIS_URL || '';
const REDIS_NAMESPACE = process.env.COLLAB_REDIS_NAMESPACE || 'conote:collab';
const REDIS_STREAM_MAXLEN = parseInt(process.env.COLLAB_REDIS_STREAM_MAXLEN || '5000', 10);
const REDIS_STREAM_BATCH = parseInt(process.env.COLLAB_REDIS_STREAM_BATCH || '256', 10);

const PROCESSING_TTL_MS = parseInt(process.env.SNAPSHOT_PROCESSING_TTL_MS || snapshotQueueDefaults.processingTtlMs, 10);
const RETRY_DELAY_MS = parseInt(process.env.SNAPSHOT_RETRY_DELAY_MS || snapshotQueueDefaults.retryDelayMs, 10);
const POLL_INTERVAL_MS = parseInt(process.env.SNAPSHOT_WORKER_POLL_INTERVAL_MS || '500', 10);

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

  /** @type {import('./proto/collab').ProtoGrpcType} */
  const proto = (loadPackageDefinition(packageDefinition));
  const collabProto = proto.collab;

  return new collabProto.CollaborationSnapshotService(
    GRPC_ADDRESS,
    credentials.createInsecure(),
  );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const logPrefix = (workerId) => `[snapshot-worker ${workerId}]`;

/**
 * Read all updates for a doc from the redis stream starting at id 0-0.
 * @param {RedisStreamAdapter} adapter
 * @param {string} docId
 * @returns {Promise<Uint8Array[]>}
 */
export const readAllUpdates = async (adapter, docId) => {
  const entries = await adapter.range(docId, { afterId: '0-0', limit: REDIS_STREAM_MAXLEN });
  return entries
    .filter((entry) => entry?.payload)
    .map((entry) => new Uint8Array(entry.payload));
};

/**
 * Rebuild and persist snapshot for a doc.
 * @param {Object} params
 * @param {string} params.docId
 * @param {RedisStreamAdapter} params.streamAdapter
 * @param {import('ioredis')} params.redis
 * @param {Object} params.snapshotClient
 * @param {string} params.workerId
 */
export const processDoc = async ({ docId, streamAdapter, redis, snapshotClient, workerId }) => {
  const prefix = logPrefix(workerId);
  console.info(`${prefix} processing doc=${docId}`);

  const ydoc = new YDoc();

  // Load latest persisted snapshot
  const latest = await getSnapshot(docId, snapshotClient);
  if (latest?.hasSnapshot && latest.snapshot?.length) {
    try {
      applyUpdate(ydoc, new Uint8Array(latest.snapshot));
      console.info(`${prefix} applied existing snapshot doc=${docId} bytes=${latest.snapshot.length}`);
    } catch (err) {
      console.error(`${prefix} failed applying existing snapshot doc=${docId}`, err);
      throw err;
    }
  }

  // Apply all updates from stream
  let updates = [];
  try {
    updates = await readAllUpdates(streamAdapter, docId);
    console.info(`${prefix} loaded updates doc=${docId} count=${updates.length}`);
  } catch (err) {
    console.error(`${prefix} failed reading updates doc=${docId}`, err);
    throw err;
  }

  try {
    updates.forEach((update) => applyUpdate(ydoc, update));
  } catch (err) {
    console.error(`${prefix} failed applying updates doc=${docId}`, err);
    throw err;
  }

  // Persist merged snapshot
  await persistSnapshot(docId, ydoc, snapshotClient);
  console.info(`${prefix} persisted snapshot doc=${docId}`);
};

const main = async () => {
  const workerId = createWorkerId();
  const prefix = logPrefix(workerId);

  if (!REDIS_URL) {
    console.error(`${prefix} COLLAB_REDIS_URL is required for snapshot worker`);
    process.exit(1);
  }

  const redis = new Redis(REDIS_URL);
  redis.on('error', (err) => {
    console.error(`${prefix} redis error`, err);
  });

  const streamAdapter = new RedisStreamAdapter({
    redis,
    namespace: REDIS_NAMESPACE,
    maxLen: REDIS_STREAM_MAXLEN,
    batchSize: REDIS_STREAM_BATCH,
    serverId: `worker-${workerId}`,
  });

  const snapshotClient = initializeGrpcClient();

  console.log(`${prefix} started on port=${DEFAULT_PORT} redis=${REDIS_URL} grpc=${GRPC_ADDRESS}`);

  while (true) {
    try {
      const docId = await claimSnapshotTask({
        redis,
        now: Date.now(),
        processingTtlMs: PROCESSING_TTL_MS,
      });
      if (!docId) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      try {
        await processDoc({ docId, streamAdapter, redis, snapshotClient, workerId });
        await completeSnapshotTask({ redis, docId });
      } catch (err) {
        console.error(`${prefix} processing failed doc=${docId}`, err);
        await postponeSnapshotTask({ redis, docId, delayMs: RETRY_DELAY_MS });
      }
    } catch (err) {
      console.error(`${prefix} loop error`, err);
      await sleep(POLL_INTERVAL_MS);
    }
  }
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error('[snapshot-worker] fatal', err);
    process.exit(1);
  });
}

export default {
  main,
  processDoc,
  readAllUpdates,
};
