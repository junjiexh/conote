import { randomUUID } from 'crypto';

const DEFAULT_NAMESPACE = process.env.COLLAB_REDIS_NAMESPACE || 'conote:collab';
const DEFAULT_QUEUE_KEY = process.env.COLLAB_SNAPSHOT_QUEUE_KEY || `${DEFAULT_NAMESPACE}:snapshot:queue`;
const DEFAULT_THROTTLE_MS = parseInt(process.env.SNAPSHOT_THROTTLE_MS || process.env.SNAPSHOT_FLUSH_INTERVAL || '2000', 10);
const DEFAULT_PROCESSING_TTL_MS = parseInt(process.env.SNAPSHOT_PROCESSING_TTL_MS || '60000', 10);
const DEFAULT_RETRY_DELAY_MS = parseInt(process.env.SNAPSHOT_RETRY_DELAY_MS || '5000', 10);

const claimScript = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local inflightScore = tonumber(ARGV[2])
local tasks = redis.call('ZRANGEBYSCORE', key, '-inf', now, 'LIMIT', 0, 1)
if (tasks == nil or #tasks == 0) then
  return nil
end
local docId = tasks[1]
redis.call('ZADD', key, 'XX', inflightScore, docId)
return docId
`;

/**
 * Enqueue a document for snapshot rebuild using a ZSET.
 * Uses NX to dedupe to avoid unbounded growth from hot documents.
 * @param {Object} params
 * @param {import('ioredis')} params.redis
 * @param {string} params.docId
 * @param {string} [params.queueKey]
 * @param {number} [params.delayMs]
 * @returns {Promise<boolean>} true if enqueued, false if already present
 */
export const enqueueSnapshotTask = async ({
  redis,
  docId,
  queueKey = DEFAULT_QUEUE_KEY,
  delayMs = DEFAULT_THROTTLE_MS,
}) => {
  if (!redis || !docId) {
    return false;
  }
  const score = Date.now() + Math.max(0, delayMs);
  const added = await redis.zadd(queueKey, 'NX', score, docId);
  return added === 1;
};

/**
 * Claim one ready task by bumping its score into a future window.
 * Keeps the member until processing completes.
 * @param {Object} params
 * @param {import('ioredis')} params.redis
 * @param {string} [params.queueKey]
 * @param {number} [params.now]
 * @param {number} [params.processingTtlMs]
 * @returns {Promise<string|null>} docId or null if none ready
 */
export const claimSnapshotTask = async ({
  redis,
  queueKey = DEFAULT_QUEUE_KEY,
  now = Date.now(),
  processingTtlMs = DEFAULT_PROCESSING_TTL_MS,
}) => {
  if (!redis) {
    return null;
  }
  const inflightScore = now + Math.max(0, processingTtlMs);
  const result = await redis.eval(claimScript, 1, queueKey, now, inflightScore);
  if (!result) {
    return null;
  }
  if (Array.isArray(result)) {
    return result[0] || null;
  }
  return typeof result === 'string' ? result : null;
};

/**
 * Remove a task after successful processing.
 * @param {Object} params
 * @param {import('ioredis')} params.redis
 * @param {string} params.docId
 * @param {string} [params.queueKey]
 * @returns {Promise<number>} removed count
 */
export const completeSnapshotTask = async ({
  redis,
  docId,
  queueKey = DEFAULT_QUEUE_KEY,
}) => {
  if (!redis || !docId) {
    return 0;
  }
  return redis.zrem(queueKey, docId);
};

/**
 * Reschedule a task after failure by pushing its score into the future.
 * @param {Object} params
 * @param {import('ioredis')} params.redis
 * @param {string} params.docId
 * @param {string} [params.queueKey]
 * @param {number} [params.delayMs]
 * @returns {Promise<number>} updated count
 */
export const postponeSnapshotTask = async ({
  redis,
  docId,
  queueKey = DEFAULT_QUEUE_KEY,
  delayMs = DEFAULT_RETRY_DELAY_MS,
}) => {
  if (!redis || !docId) {
    return 0;
  }
  const newScore = Date.now() + Math.max(0, delayMs);
  return redis.zadd(queueKey, 'XX', newScore, docId);
};

/**
 * Generate a worker id for logging.
 * @returns {string}
 */
export const createWorkerId = () => randomUUID();

export const snapshotQueueDefaults = {
  queueKey: DEFAULT_QUEUE_KEY,
  throttleMs: DEFAULT_THROTTLE_MS,
  processingTtlMs: DEFAULT_PROCESSING_TTL_MS,
  retryDelayMs: DEFAULT_RETRY_DELAY_MS,
};

