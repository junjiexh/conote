import { jest } from '@jest/globals';
import { GenericContainer } from 'testcontainers';
import Redis from 'ioredis';
import { Doc as YDoc, encodeStateAsUpdate, applyUpdate } from 'yjs';

import RedisStreamAdapter from '../lib/redisStream';
import { processDoc } from '../snapshotWorker';

jest.setTimeout(60000);

const createSnapshotBuffer = (builder) => {
  const doc = new YDoc();
  builder(doc);
  return Buffer.from(encodeStateAsUpdate(doc));
};

const snapshotToText = (snapshotBuffer, field = 'content') => {
  const doc = new YDoc();
  applyUpdate(doc, new Uint8Array(snapshotBuffer));
  return doc.getText(field).toString();
};

describe('snapshot worker integration (redis stream + queue)', () => {
  let container;
  let redisConfig;
  let redis;
  let adapter;
  let skipReason = null;

  const workerId = 'jest-worker';

  const snapshotStore = new Map();
  const stubSnapshotClient = {
    getSnapshot: ({ documentId }, cb) => {
      const snapshot = snapshotStore.get(documentId);
      cb(null, {
        hasSnapshot: Boolean(snapshot),
        snapshot: snapshot || null,
      });
    },
    saveSnapshot: ({ documentId, snapshot }, cb) => {
      snapshotStore.set(documentId, snapshot);
      cb(null, {});
    },
  };

  beforeAll(async () => {
    try {
      container = await new GenericContainer('redis:7-alpine')
        .withExposedPorts(6379)
        .start();
      redisConfig = {
        host: container.getHost(),
        port: container.getMappedPort(6379),
      };
    } catch (err) {
      skipReason = `container runtime unavailable: ${err.message}`;
      // eslint-disable-next-line no-console
      console.warn('[snapshot-worker] integration test skipped:', skipReason);
    }
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    if (skipReason) {
      return;
    }
    redis = new Redis(redisConfig);
    adapter = new RedisStreamAdapter({
      redis,
      namespace: 'snap-integ',
      serverId: workerId,
      maxLen: 1000,
      batchSize: 100,
      idleDelayMs: 10,
    });
    snapshotStore.clear();
  });

  afterEach(async () => {
    if (adapter?.stopAll) {
      adapter.stopAll();
    }
    if (redis) {
      await redis.flushall();
      await redis.quit();
    }
    redis = null;
    adapter = null;
  });

  test('rebuilds snapshot from existing snapshot plus stream updates', async () => {
    if (skipReason) {
      console.warn('[snapshot-worker] integration test skipped:', skipReason);
      return;
    }
    const docId = 'doc-snapshot-worker';

    // Seed an existing snapshot
    const baseSnapshot = createSnapshotBuffer((doc) => {
      doc.getText('content').insert(0, 'hello');
    });
    snapshotStore.set(docId, baseSnapshot);

    // Append updates to the redis stream
    const updateBuffer = createSnapshotBuffer((doc) => {
      doc.getText('content').insert(0, 'hello');
      doc.getText('content').insert(5, ' world');
    });
    await adapter.appendUpdate({
      docName: docId,
      update: updateBuffer,
    });

    await processDoc({
      docId,
      streamAdapter: adapter,
      redis,
      snapshotClient: stubSnapshotClient,
      workerId,
    });

    const finalSnapshot = snapshotStore.get(docId);
    expect(finalSnapshot).toBeDefined();
    expect(snapshotToText(finalSnapshot)).toBe('hello world');
  });
});
