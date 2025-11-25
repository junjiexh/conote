import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';
import { Doc, encodeStateAsUpdate } from 'yjs';

import { setupWSConnection, docs, events, serverId } from '../lib/yws/index.js';

const createMockConnection = (label) => {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    label,
    readyState: 1,
    binaryType: null,
    send: jest.fn(),
    close: jest.fn(),
    ping: jest.fn(),
  });
};

const shutdownDocState = () => {
  docs.forEach((doc) => {
    doc.destroy();
  });
  docs.clear();
};

describe('yws pubsub hooks', () => {
  let activeConns = [];

  const trackConn = (conn) => {
    activeConns.push(conn);
    return conn;
  };

  afterEach(() => {
    activeConns.forEach((conn) => conn.emit('close'));
    activeConns = [];
    shutdownDocState();
  });

  test('emits doc:publish when a connection updates a doc instead of broadcasting locally', () => {
    const docName = 'doc-publish';
    const request = { url: `/${docName}` };
    const connA = trackConn(createMockConnection('A'));
    const connB = trackConn(createMockConnection('B'));

    setupWSConnection(connA, request, { docName });
    setupWSConnection(connB, request, { docName });

    const doc = docs.get(docName);
    const publishSpy = jest.fn();
    events.once('doc:publish', publishSpy);

    connA.send.mockClear();
    connB.send.mockClear();

    doc.transact(() => {
      doc.getText('content').insert(0, 'local');
    }, connA);

    expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
      docName,
      serverId,
      update: expect.any(Uint8Array),
    }));
  });

  test('doc:deliver rebroadcasts to connections without re-publishing', () => {
    const docName = 'doc-deliver';
    const request = { url: `/${docName}` };
    const connA = trackConn(createMockConnection('A'));
    const connB = trackConn(createMockConnection('B'));

    setupWSConnection(connA, request, { docName });
    setupWSConnection(connB, request, { docName });

    const publishSpy = jest.fn();
    events.on('doc:publish', publishSpy);

    connA.send.mockClear();
    connB.send.mockClear();

    const remoteDoc = new Doc();
    remoteDoc.getText('content').insert(0, 'remote');
    const remoteUpdate = encodeStateAsUpdate(remoteDoc);

    events.emit('doc:deliver', {
      docName,
      update: remoteUpdate,
      serverId: 'other-server',
    });

    expect(connA.send).toHaveBeenCalled();
    expect(connB.send).toHaveBeenCalled();
    const doc = docs.get(docName);
    expect(doc.getText('content').toString()).toEqual('remote');
    expect(publishSpy).not.toHaveBeenCalled();
    events.off('doc:publish', publishSpy);
  });
});
