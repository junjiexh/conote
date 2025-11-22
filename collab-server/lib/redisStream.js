const { EventEmitter } = require('events');

const DEFAULT_NAMESPACE = process.env.COLLAB_REDIS_NAMESPACE || 'conote:collab';
const DEFAULT_MAX_LEN = parseInt(process.env.COLLAB_REDIS_STREAM_MAXLEN || '5000', 10);
const DEFAULT_IDLE_DELAY_MS = parseInt(process.env.COLLAB_REDIS_IDLE_DELAY || '25', 10);
const DEFAULT_BATCH_SIZE = parseInt(process.env.COLLAB_REDIS_STREAM_BATCH || '128', 10);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class RedisStreamAdapter extends EventEmitter {
  /**
   * @param {Object} options
   * @param {import('ioredis')} options.redis
   * @param {string} [options.namespace]
   * @param {number} [options.maxLen]
   * @param {number} [options.idleDelayMs]
   * @param {number} [options.batchSize]
   * @param {string} [options.serverId]
   */
  constructor({
    redis,
    namespace = DEFAULT_NAMESPACE,
    maxLen = DEFAULT_MAX_LEN,
    idleDelayMs = DEFAULT_IDLE_DELAY_MS,
    batchSize = DEFAULT_BATCH_SIZE,
    serverId = '',
  }) {
    super();
    if (!redis) {
      throw new Error('Redis client is required');
    }
    this.redis = redis;
    this.namespace = namespace;
    this.maxLen = maxLen;
    this.idleDelayMs = idleDelayMs;
    this.batchSize = batchSize;
    this.serverId = serverId;

    /** @type {Set<Function>} */
    this.stoppers = new Set();
  }

  streamKey(docName) {
    return `${this.namespace}:doc:${docName}`;
  }

  /**
   * Append an update to the Redis Stream.
   * @param {{ docName: string, update: Uint8Array, serverId?: string }} payload
   * @returns {Promise<string>} redis stream id
   */
  async appendUpdate({ docName, update, serverId = this.serverId }) {
    if (!docName) {
      throw new Error('docName is required');
    }
    if (!update) {
      throw new Error('update payload is required');
    }
    const buffer = Buffer.isBuffer(update) ? update : Buffer.from(update);
    const key = this.streamKey(docName);
    return this.redis.xadd(
      key,
      'MAXLEN',
      '~',
      this.maxLen,
      '*',
      'payload',
      buffer.toString('base64'),
      'serverId',
      serverId || '',
      'ts',
      Date.now().toString(),
    );
  }

  /**
   * Fetch entries newer than the supplied cursor.
   * @param {string} docName
   * @param {{ afterId?: string, limit?: number }} opts
   */
  async range(docName, { afterId = '0-0', limit = 200 } = {}) {
    const key = this.streamKey(docName);
    const start = afterId === '0-0' ? '-' : `(${afterId}`;
    const rawEntries = await this.redis.xrange(key, start, '+', 'COUNT', limit);
    return rawEntries.map((entry) => RedisStreamAdapter.decodeEntry(entry));
  }

  /**
   * Start a polling consumer that invokes onMessage for new entries.
   * @param {string} docName
   * @param {{ fromId?: string, onMessage: function }} opts
   * @returns {() => void} stop handle
   */
  subscribe(docName, { fromId = '$', onMessage }) {
    if (typeof onMessage !== 'function') {
      throw new Error('onMessage callback is required');
    }
    const key = this.streamKey(docName);
    let lastId = fromId;
    let active = true;
    const runner = async () => {
      if (lastId === '$') {
        const latest = await this.redis.xrevrange(key, '+', '-', 'COUNT', 1);
        lastId = latest.length ? latest[0][0] : '0-0';
      }
      while (active) {
        try {
          const start = lastId === '0-0' ? '-' : `(${lastId}`;
          const entries = await this.redis.xrange(key, start, '+', 'COUNT', this.batchSize);
          if (!entries.length) {
            await sleep(this.idleDelayMs);
            continue;
          }
          for (const entry of entries) {
            const decoded = RedisStreamAdapter.decodeEntry(entry);
            lastId = decoded.id;
            if (decoded.serverId && decoded.serverId === this.serverId) {
              continue;
            }
            await onMessage(decoded);
          }
        } catch (err) {
          this.emit('error', err);
          await sleep(this.idleDelayMs);
        }
      }
    };
    runner();
    const stop = () => {
      active = false;
    };
    this.stoppers.add(stop);
    return stop;
  }

  stopAll() {
    this.stoppers.forEach((stop) => {
      try {
        stop();
      } catch (err) {
        this.emit('error', err);
      }
    });
    this.stoppers.clear();
  }

  static decodeEntry([id, fields]) {
    const data = {};
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = fields[i + 1];
    }
    return {
      id,
      payload: data.payload ? Buffer.from(data.payload, 'base64') : null,
      serverId: data.serverId || '',
      ts: data.ts ? Number(data.ts) : undefined,
    };
  }
}

module.exports = RedisStreamAdapter;
