import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { GenericContainer } from 'testcontainers';

import RedisStreamAdapter from '../lib/redisStream';
import RedisSync from '../lib/redisSync';

jest.setTimeout(60000);

const waitForExpect = async (assertFn, timeout = 5000, interval = 50) => {
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

describe('RedisSync integration (real Redis)', () => {
  let container;
  let redisConfig;
  const cleanup = [];

  const track = (fn) => cleanup.push(fn);

  beforeAll(async () => {
    container = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();
    redisConfig = {
      host: container.getHost(),
      port: container.getMappedPort(6379),
    };
  });

  afterAll(async () => {
    if (container) {
      await container.stop();
    }
  });

  afterEach(async () => {
    while (cleanup.length) {
      const fn = cleanup.pop();
      try {
        // eslint-disable-next-line no-await-in-loop
        await fn();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('integration cleanup failed', err);
      }
    }
  });

  const createServer = async (serverId, namespace = 'collab-integ') => {
    const emitter = new EventEmitter();
    const redis = new Redis(redisConfig);
    const adapter = new RedisStreamAdapter({
      redis,
      namespace,
      serverId,
      idleDelayMs: 10,
      batchSize: 100,
    });
    const sync = new RedisSync({
      adapter,
      eventsEmitter: emitter,
      serverId,
    });
    track(async () => {
      sync.shutdown();
      await redis.quit();
    });
    return { emitter, adapter, sync, redis };
  };

  test('replays backlog updates for late subscribers using real redis', async () => {
    const serverA = await createServer('server-a', 'integ-replay');
    await serverA.sync.bindDoc('doc-int');
    serverA.emitter.emit('doc:publish', {
      docName: 'doc-int',
      update: Buffer.from('first'),
    });

    const serverB = await createServer('server-b', 'integ-replay');
    const deliverSpy = jest.fn();
    serverB.emitter.on('doc:deliver', deliverSpy);

    await serverB.sync.bindDoc('doc-int');

    await waitForExpect(() => {
      const payload = deliverSpy.mock.calls[0][0];
      expect(Buffer.from(payload.update).toString()).toBe('first');
    });
  });

  test('bindDoc processes updates published mid-replay', async () => {
    const serverA = await createServer('server-a', 'integ-gap');
    await serverA.sync.bindDoc('doc-gap');
    await serverA.sync.handlePublish({
      docName: 'doc-gap',
      update: Buffer.from('before'),
    });

    const serverC = await createServer('server-c', 'integ-gap');
    const deliverSpy = jest.fn();
    serverC.emitter.on('doc:deliver', deliverSpy);

    const originalRange = serverC.adapter.range.bind(serverC.adapter);
    let publishedDuringReplay = false;
    serverC.adapter.range = async (...args) => {
      const entries = await originalRange(...args);
      if (!publishedDuringReplay) {
        publishedDuringReplay = true;
        await serverA.sync.handlePublish({
          docName: 'doc-gap',
          update: Buffer.from('during'),
        });
      }
      return entries;
    };

    await serverC.sync.bindDoc('doc-gap');

    await waitForExpect(() => {
      const updates = deliverSpy.mock.calls.map(([payload]) => Buffer.from(payload.update).toString());
      expect(updates).toContain('before');
      expect(updates).toContain('during');
    });
  });
});
