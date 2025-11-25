import { encodeStateAsUpdate } from 'yjs';
import { enqueueSnapshotTask, snapshotQueueDefaults } from './snapshotQueue.js';

/**
 * Encode a Y.Doc's current state as an update buffer
 * @param {import('yjs').Doc} ydoc - The Y.Doc to encode
 * @returns {Buffer} Encoded state as a Buffer
 */
export const encodeDocumentState = (ydoc) => {
    const update = encodeStateAsUpdate(ydoc);
    return Buffer.from(update);
};

/**
 * Persist a document snapshot to the backend via gRPC.
 * Intended for background worker usage.
 * @param {string} documentId - The document identifier
 * @param {import('yjs').Doc} ydoc - The Y.Doc to save
 * @param {Object} snapshotClient - gRPC snapshot service client
 * @returns {Promise<void>}
 */
export const persistSnapshot = (documentId, ydoc, snapshotClient) => {
    if (!documentId) {
        console.warn('[collab] skip persistSnapshot: empty documentId');
        return Promise.resolve();
    }
    const payload = encodeDocumentState(ydoc);
    console.info(`[collab] persistSnapshot -> id=${documentId} bytes=${payload.length}`);
    return new Promise((resolve, reject) => {
        snapshotClient.saveSnapshot(
            { documentId: documentId, snapshot: payload },
            (err) => {
                if (err) {
                    console.error(`[collab] persistSnapshot failed ${documentId}`, err);
                    reject(err);
                } else {
                    console.info(`[collab] persistSnapshot <- ok id=${documentId}`);
                    resolve();
                }
            },
        );
    });
};

/**
 * Enqueue a snapshot rebuild task for a document.
 * Actual persistence will be performed by a background worker.
 * @param {string} documentId
 * @param {Object} options
 * @param {import('ioredis')} options.redis
 * @param {string} [options.queueKey]
 * @param {number} [options.delayMs]
 * @returns {Promise<boolean>} true if a new task was enqueued, false if already pending
 */
export const saveSnapshot = (documentId, {
    redis,
    queueKey = snapshotQueueDefaults.queueKey,
    delayMs = snapshotQueueDefaults.throttleMs,
} = {}) => enqueueSnapshotTask({
    redis,
    docId: documentId,
    queueKey,
    delayMs,
});

/**
 * Get a document snapshot from the backend via gRPC
 * @param {string} documentId - The document identifier
 * @param {Object} snapshotClient - gRPC snapshot service client
 * @returns {Promise<{hasSnapshot: boolean, snapshot: Buffer}|null>}
 */
export const getSnapshot = (documentId, snapshotClient) => {
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

/**
 * Schedule a debounced save for a document
 * Queue a snapshot task for a document (debounce now handled by ZSET dedupe/throttle).
 * @param {string} documentId - The document identifier
 * @param {Object} options
 * @param {import('ioredis')} options.redis
 * @param {string} [options.queueKey]
 * @param {number} [options.delayMs]
 */
export const scheduleSave = (documentId, {
    redis,
    queueKey = snapshotQueueDefaults.queueKey,
    delayMs = snapshotQueueDefaults.throttleMs,
} = {}) => saveSnapshot(documentId, { redis, queueKey, delayMs });
