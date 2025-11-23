import { encodeStateAsUpdate } from 'yjs';

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
 * Save a document snapshot to the backend via gRPC
 * @param {string} documentId - The document identifier
 * @param {import('yjs').Doc} ydoc - The Y.Doc to save
 * @param {Object} snapshotClient - gRPC snapshot service client
 * @returns {Promise<void>}
 */
export const saveSnapshot = (documentId, ydoc, snapshotClient) => {
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
 * @param {string} documentId - The document identifier
 * @param {import('yjs').Doc} ydoc - The Y.Doc to save
 * @param {Object} snapshotClient - gRPC snapshot service client
 * @param {Map} persistState - Map to track pending saves
 * @param {number} flushInterval - Debounce interval in milliseconds
 */
export const scheduleSave = (documentId, ydoc, snapshotClient, persistState, flushInterval) => {
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
            await saveSnapshot(documentId, ydoc, snapshotClient);
        } catch (error) {
            console.error(`Failed to persist snapshot for ${documentId}`, error);
        } finally {
            state.timeout = null;
        }
    }, flushInterval);
};
