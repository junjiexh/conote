import { EventEmitter } from 'events';
import Redis from 'ioredis-mock';

import RedisStreamAdapter from '../lib/redisStream';
import RedisSync from '../lib/redisSync';

const waitForExpect = async (assertFn, timeout = 200, interval = 20) => {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      assertFn();
      return;
    } catch (error) {
      if (Date.now() - start > timeout) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
};

const cleanupStack = [];
const trackedRedis = new Set();

const registerCleanup = (fn) => {
  cleanupStack.push(fn);
};

const registerRedis = (redis) => {
  if (trackedRedis.has(redis)) {
    return;
  }
  trackedRedis.add(redis);
  registerCleanup(async () => {
    await redis.quit();
    trackedRedis.delete(redis);
  });
};

afterEach(async () => {
  while (cleanupStack.length) {
    const cleanup = cleanupStack.pop();
    try {
      // eslint-disable-next-line no-await-in-loop
      await cleanup();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('cleanup failed', err);
    }
  }
});

const createServer = (redis, serverId, namespace = 'collab-sync') => {
  const emitter = new EventEmitter();
  const adapter = new RedisStreamAdapter({
    redis,
    namespace,
    serverId,
    idleDelayMs: 5,
    batchSize: 50,
  });
  const sync = new RedisSync({
    adapter,
    eventsEmitter: emitter,
    serverId,
  });
  registerCleanup(() => {
    sync.shutdown();
  });
  registerRedis(redis);
  return { emitter, adapter, sync, redis };
};

describe('RedisSync', () => {
  test('replays updates across servers', async () => {
    const redis = new Redis();
    const serverA = createServer(redis, 'server-a', 'sync-a');
    const serverB = createServer(redis, 'server-b', 'sync-a');

    await serverA.sync.bindDoc('doc-1');
    await serverB.sync.bindDoc('doc-1');

    const deliverSpyA = jest.fn();
    const deliverSpyB = jest.fn();
    serverA.emitter.on('doc:deliver', deliverSpyA);
    serverB.emitter.on('doc:deliver', deliverSpyB);

    const update = Buffer.from('hello');
    serverA.emitter.emit('doc:publish', { docName: 'doc-1', update });

    await waitForExpect(() => {
      expect(deliverSpyB).toHaveBeenCalled();
    });
    expect(deliverSpyA).toHaveBeenCalled();
    const payloadB = deliverSpyB.mock.calls[0][0];
    expect(Buffer.from(payloadB.update).toString()).toBe('hello');

  });

  test('late subscriber receives backlog during bindDoc', async () => {
    const redis = new Redis();
    const serverA = createServer(redis, 'server-a', 'sync-b');
    await serverA.sync.bindDoc('doc-2');

    serverA.emitter.emit('doc:publish', {
      docName: 'doc-2',
      update: Buffer.from('first'),
    });

    const serverC = createServer(redis, 'server-c', 'sync-b');
    const deliverSpyC = jest.fn();
    serverC.emitter.on('doc:deliver', deliverSpyC);
    await serverC.sync.bindDoc('doc-2');

    await waitForExpect(() => {
      expect(deliverSpyC).toHaveBeenCalled();
    });
    const payload = deliverSpyC.mock.calls[0][0];
    expect(Buffer.from(payload.update).toString()).toBe('first');

  });

  test('bindDoc catches updates published while replaying snapshot gap', async () => {
    const redis = new Redis();
    const serverA = createServer(redis, 'server-a', 'sync-c');
    await serverA.sync.bindDoc('doc-race');
    serverA.emitter.emit('doc:publish', {
      docName: 'doc-race',
      update: Buffer.from('before'),
    });

    const serverC = createServer(redis, 'server-c', 'sync-c');
    const deliverSpy = jest.fn();
    serverC.emitter.on('doc:deliver', deliverSpy);

    const originalRange = serverC.adapter.range.bind(serverC.adapter);
    let publishedDuringReplay = false;
    serverC.adapter.range = async (...args) => {
      const entries = await originalRange(...args);
      if (!publishedDuringReplay) {
        publishedDuringReplay = true;
        serverA.emitter.emit('doc:publish', {
          docName: 'doc-race',
          update: Buffer.from('during'),
        });
      }
      return entries;
    };

    await serverC.sync.bindDoc('doc-race');

    await waitForExpect(() => {
      const states = deliverSpy.mock.calls.map((call) => call[0].update.toString());
      expect(states).toContain('before');
      expect(states).toContain('during');
    });

  });
});
