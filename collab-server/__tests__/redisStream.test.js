import { describe, test, expect } from '@jest/globals';
import Redis from 'ioredis-mock';

import RedisStreamAdapter from '../lib/redisStream.js';

const waitFor = (ms = 25) => new Promise((resolve) => setTimeout(resolve, ms));

describe('RedisStreamAdapter', () => {
  test('appendUpdate followed by range returns ordered payloads', async () => {
    const redis = new Redis();
    const adapter = new RedisStreamAdapter({ redis, namespace: 'test', serverId: 'server-a' });

    const ids = [];
    ids.push(await adapter.appendUpdate({ docName: 'doc1', update: Buffer.from('first') }));
    ids.push(await adapter.appendUpdate({ docName: 'doc1', update: Buffer.from('second') }));

    const entries = await adapter.range('doc1');
    expect(entries.map((e) => e.id)).toEqual(ids);
    expect(entries.map((e) => e.payload.toString())).toEqual(['first', 'second']);

    await redis.quit();
  });

  test('subscribe skips local serverId entries and emits remote ones', async () => {
    const redis = new Redis();
    const adapter = new RedisStreamAdapter({
      redis,
      namespace: 'test',
      serverId: 'server-a',
      blockMs: 5,
      idleDelayMs: 5,
    });

    const received = [];
    const stop = adapter.subscribe('doc2', {
      fromId: '0-0',
      onMessage: async (entry) => {
        received.push(entry.payload.toString());
        if (received.length >= 1) {
          stop();
        }
      },
    });

    await adapter.appendUpdate({
      docName: 'doc2',
      update: Buffer.from('local-only'),
      serverId: 'server-a',
    });
    await adapter.appendUpdate({
      docName: 'doc2',
      update: Buffer.from('deliver-me'),
      serverId: 'server-b',
    });

    await waitFor(50);
    expect(received).toEqual(['deliver-me']);
    adapter.stopAll();
    await redis.quit();
  });

  test('consumer continues after transient redis error', async () => {
    const redis = new Redis();
    const adapter = new RedisStreamAdapter({
      redis,
      namespace: 'test',
      serverId: 'server-a',
      blockMs: 5,
      idleDelayMs: 5,
    });
    adapter.on('error', (err) => {
      // ignore expected error
    });

    let failNext = true;
    const realXrange = redis.xrange.bind(redis);
    redis.xrange = async (...args) => {
      if (failNext) {
        failNext = false;
        throw new Error('boom');
      }
      return realXrange(...args);
    };

    const entries = [];
    const stop = adapter.subscribe('doc3', {
      fromId: '0-0',
      onMessage: async (entry) => {
        entries.push(entry.payload.toString());
        stop();
      },
    });

    await waitFor(30);
    await adapter.appendUpdate({
      docName: 'doc3',
      update: Buffer.from('after-error'),
      serverId: 'server-b',
    });

    await waitFor(50);
    expect(entries).toEqual(['after-error']);
    adapter.stopAll();
    await redis.quit();
  });
});
