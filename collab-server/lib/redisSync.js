import { EventEmitter } from 'events';
import RedisStreamAdapter from './redisStream.js';

const toUint8Array = (input) => {
  if (!input) {
    return null;
  }
  if (input instanceof Uint8Array) {
    return input;
  }
  if (Buffer.isBuffer(input)) {
    return new Uint8Array(input);
  }
  return new Uint8Array(Buffer.from(input));
};

class RedisSync extends EventEmitter {
  /**
   * @param {Object} options
   * @param {RedisStreamAdapter} options.adapter
   * @param {import('events')} options.eventsEmitter
   * @param {string} options.serverId
   */
  constructor({ adapter, eventsEmitter, serverId }) {
    super();
    if (!adapter) {
      throw new Error('RedisStreamAdapter is required');
    }
    if (!eventsEmitter) {
      throw new Error('events emitter is required');
    }
    this.adapter = adapter;
    this.events = eventsEmitter;
    this.serverId = serverId;
    this.docStates = new Map();

    this.handlePublish = this.handlePublish.bind(this);
    this.events.on('doc:publish', this.handlePublish);
  }

  async handlePublish(payload) {
    const { docName, update } = payload || {};
    if (!docName || !update) {
      return;
    }
    try {
      const id = await this.adapter.appendUpdate({
        docName,
        update: toUint8Array(update),
        serverId: this.serverId,
      });
      const state = this.docStates.get(docName);
      if (state) {
        state.lastId = id;
      }
    } catch (err) {
      this.emit('error', err);
    } finally {
      this.events.emit('doc:deliver', {
        docName,
        update: toUint8Array(update),
      });
    }
  }

  /**
   * Binds a document to the sync instance
   * replay the doc in the backlog if any and start the consumer of new doc updates
   * 
   * @param {string} docName 
   * @returns 
   */
  async bindDoc(docName) {
    if (!docName) {
      return;
    }
    let state = this.docStates.get(docName);
    if (!state) {
      state = { lastId: '0-0', stop: null };
      this.docStates.set(docName, state);
    }
    await this.replayDoc(docName, state);
    if (!state.stop) {
      state.stop = this.adapter.subscribe(docName, {
        fromId: state.lastId || '0-0',
        onMessage: async (entry) => {
          state.lastId = entry.id;
          this.emitDeliver(docName, entry);
        },
      });
    }
  }

  /**
   * Replay the doc in the backlog if any
   * 
   * @param {string} docName 
   * @param {Object} state 
   */
  async replayDoc(docName, state) {
    try {
      const entries = await this.adapter.range(docName, {
        afterId: state.lastId || '0-0',
      });
      entries.forEach((entry) => {
        state.lastId = entry.id;
        this.emitDeliver(docName, entry);
      });
    } catch (err) {
      this.emit('error', err);
    }
  }

  /**
   * Emit the doc update to the events emitter
   * 
   * @param {string} docName 
   * @param {Object} entry 
   */
  emitDeliver(docName, entry) {
    if (!entry || !entry.payload) {
      return;
    }
    this.events.emit('doc:deliver', {
      docName,
      update: toUint8Array(entry.payload),
      serverId: entry.serverId,
    });
  }

  shutdown() {
    this.events.off('doc:publish', this.handlePublish);
    this.docStates.forEach((state) => {
      if (state.stop) {
        state.stop();
      }
    });
    this.docStates.clear();
    if (typeof this.adapter.stopAll === 'function') {
      this.adapter.stopAll();
    }
  }
}

RedisSync.create = ({ redis, eventsEmitter, serverId, namespace }) => {
  const adapter = new RedisStreamAdapter({
    redis,
    serverId,
    namespace,
  });
  return new RedisSync({ adapter, eventsEmitter, serverId });
};

export default RedisSync;
