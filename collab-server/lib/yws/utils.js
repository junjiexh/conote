import { hostname } from 'os'
import { encodeStateAsUpdate, applyUpdate, Doc } from 'yjs'
import { writeUpdate, readSyncMessage, writeSyncStep1 } from 'y-protocols/sync'
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'

import { createEncoder, writeVarUint, toUint8Array, writeVarUint8Array, length } from 'lib0/encoding'
import { createDecoder, readVarUint, readVarUint8Array } from 'lib0/decoding'
import { setIfUndefined } from 'lib0/map'

import debounce from 'lodash.debounce'

import bus from './events.js'
import { callbackHandler } from './callback.js'
import { isCallbackSet } from './callback.js'

const serverId = process.env.COLLAB_SERVER_ID || `${hostname()}-${process.pid}`
const _serverId = serverId
export { _serverId as serverId }

const CALLBACK_DEBOUNCE_WAIT = parseInt(process.env.CALLBACK_DEBOUNCE_WAIT) || 2000
const CALLBACK_DEBOUNCE_MAXWAIT = parseInt(process.env.CALLBACK_DEBOUNCE_MAXWAIT) || 10000

const wsReadyStateConnecting = 0
const wsReadyStateOpen = 1
const wsReadyStateClosing = 2 // eslint-disable-line
const wsReadyStateClosed = 3 // eslint-disable-line

// disable gc when using snapshots!
const gcEnabled = process.env.GC !== 'false' && process.env.GC !== '0'
const persistenceDir = process.env.YPERSISTENCE
/**
 * @type {{bindState: function(string,WSSharedDoc):void, writeState:function(string,WSSharedDoc):Promise<any>, provider: any}|null}
 */
let persistence = null
if (typeof persistenceDir === 'string') {
  console.info('Persisting documents to "' + persistenceDir + '"')
  // @ts-ignore
  const LeveldbPersistence = require('y-leveldb').LeveldbPersistence
  const ldb = new LeveldbPersistence(persistenceDir)
  persistence = {
    provider: ldb,
    bindState: async (docName, ydoc) => {
      const persistedYdoc = await ldb.getYDoc(docName)
      const newUpdates = encodeStateAsUpdate(ydoc)
      ldb.storeUpdate(docName, newUpdates)
      applyUpdate(ydoc, encodeStateAsUpdate(persistedYdoc))
      ydoc.on('update', update => {
        ldb.storeUpdate(docName, update)
      })
    },
    writeState: async (docName, ydoc) => { }
  }
}

/**
 * @param {{bindState: function(string,WSSharedDoc):void,
 * writeState:function(string,WSSharedDoc):Promise<any>,provider:any}|null} persistence_
 */
export function setPersistence(persistence_) {
  persistence = persistence_
}

/**
 * @return {null|{bindState: function(string,WSSharedDoc):void,
  * writeState:function(string,WSSharedDoc):Promise<any>}|null} used persistence layer
  */
export function getPersistence() { return persistence }

/**
 * @type {Map<string,WSSharedDoc>}
 */
const docs = new Map()
// exporting docs so that others can use it
const _docs = docs
export { _docs as docs }

const messageSync = 0
const messageAwareness = 1
// const messageAuth = 2

const REMOTE_ORIGIN = Symbol('redis-deliver')
const _REMOTE_ORIGIN = REMOTE_ORIGIN
export { _REMOTE_ORIGIN as REMOTE_ORIGIN }

const encodeSyncUpdateMessage = update => {
  const encoder = createEncoder()
  writeVarUint(encoder, messageSync)
  writeUpdate(encoder, update)
  return toUint8Array(encoder)
}

const broadcastEncodedMessage = (doc, message) => {
  doc.conns.forEach((_, conn) => send(doc, conn, message))
}

/**
 * @param {Uint8Array} update
 * @param {any} origin
 * @param {WSSharedDoc} doc
 */
const updateHandler = (update, origin, doc) => {
  const message = encodeSyncUpdateMessage(update)
  broadcastEncodedMessage(doc, message) // broadcast anyway
  if (origin === REMOTE_ORIGIN) { // remote delivery, skip publish doc:publish to avoid rebroadcast
    console.log(`[yws] updateHandler: remote delivery, skip publish doc:publish to avoid rebroadcast doc=${doc.name}`)
    return
  }
  console.log(`[yws] updateHandler: publish doc:publish doc=${doc.name}`)
  bus.emit('doc:publish', {
    docName: doc.name,
    update,
    message,
    serverId
  })
}

class WSSharedDoc extends Doc {
  /**
   * @param {string} name
   */
  constructor(name) {
    super({ gc: gcEnabled })
    this.name = name
    /**
     * Maps from conn to set of controlled user ids. Delete all user ids from awareness when this conn is closed
     * @type {Map<Object, Set<number>>}
     */
    this.conns = new Map()
    /**
     * @type {awarenessProtocol.Awareness}
     */
    this.awareness = new Awareness(this)
    this.awareness.setLocalState(null)
    /**
     * @param {{ added: Array<number>, updated: Array<number>, removed: Array<number> }} changes
     * @param {Object | null} conn Origin is the connection that made the change
     */
    const awarenessChangeHandler = ({ added, updated, removed }, conn) => {
      const changedClients = added.concat(updated, removed)
      if (conn !== null) {
        const connControlledIDs = /** @type {Set<number>} */ (this.conns.get(conn))
        if (connControlledIDs !== undefined) {
          added.forEach(clientID => { connControlledIDs.add(clientID) })
          removed.forEach(clientID => { connControlledIDs.delete(clientID) })
        }
      }
      // broadcast awareness update
      const encoder = createEncoder()
      writeVarUint(encoder, messageAwareness)
      writeVarUint8Array(encoder, encodeAwarenessUpdate(this.awareness, changedClients))
      const buff = toUint8Array(encoder)
      this.conns.forEach((_, c) => {
        send(this, c, buff)
      })
    }
    this.awareness.on('update', awarenessChangeHandler)
    this.on('update', updateHandler)
    if (isCallbackSet) {
      this.on('update', debounce(
        callbackHandler,
        CALLBACK_DEBOUNCE_WAIT,
        { maxWait: CALLBACK_DEBOUNCE_MAXWAIT }
      ))
    }
  }
}

/**
 * Gets a Y.Doc by name, whether in memory or on disk
 *
 * @param {string} docname - the name of the Y.Doc to find or create
 * @param {boolean} gc - whether to allow gc on the doc (applies only when created)
 * @return {WSSharedDoc}
 */
const getYDoc = (docname, gc = true) => setIfUndefined(docs, docname, () => {
  const doc = new WSSharedDoc(docname)
  doc.gc = gc
  if (persistence !== null) {
    persistence.bindState(docname, doc)
  }
  docs.set(docname, doc)
  return doc
})

const _getYDoc = getYDoc
export { _getYDoc as getYDoc }

/**
 * Handler for doc:deliver event, we do actual broardcast here.
 * It is possible that the update is send to the origin client, but that is okay, yjs handle this.
 * 
 * @param {{ docName: string, update: Uint8Array, serverId?: string }} payload
 */
const handleDeliverEvent = payload => {
  const { docName, update, serverId: sourceId } = payload || {}
  console.log('[yws] handleDeliverEvent', {
    docName,
    updateSize: update?.length,
    sourceId,
    localServerId: serverId
  })

  if (!docName || !update) {
    console.warn('[yws] handleDeliverEvent missing docName or update')
    return
  }
  const doc = docs.get(docName)
  if (!doc) {
    console.log('[yws] handleDeliverEvent ignored: doc not found in memory', docName)
    return
  }
  try {
    applyUpdate(doc, update, REMOTE_ORIGIN)
    console.log('[yws] handleDeliverEvent applied update', docName)
  } catch (err) {
    console.error(`Failed to apply remote update for ${docName}`, err)
  }
}

bus.on('doc:deliver', handleDeliverEvent)

/**
 * @param {any} conn
 * @param {WSSharedDoc} doc
 * @param {Uint8Array} message
 */
const messageListener = (conn, doc, message) => {
  try {
    const encoder = createEncoder()
    const decoder = createDecoder(message)
    const messageType = readVarUint(decoder)
    switch (messageType) {
      case messageSync:
        writeVarUint(encoder, messageSync)
        // It handles two main types of sync
        // 1. sync step1: request state vector to calculate missing updates
        // 2. sync step2: send update to server, so server will trigger the update event
        readSyncMessage(decoder, encoder, doc, conn)

        // only step1 contains reply message
        if (length(encoder) > 1) {
          send(doc, conn, toUint8Array(encoder))
        }
        break
      case messageAwareness: {
        applyAwarenessUpdate(doc.awareness, readVarUint8Array(decoder), conn)
        break
      }
    }
  } catch (err) {
    console.error(err)
    doc.emit('error', [err])
  }
}

/**
 * @param {WSSharedDoc} doc
 * @param {any} conn
 */
const closeConn = (doc, conn) => {
  if (doc.conns.has(conn)) {
    /**
     * @type {Set<number>}
     */
    // @ts-ignore
    const controlledIds = doc.conns.get(conn)
    doc.conns.delete(conn)
    removeAwarenessStates(doc.awareness, Array.from(controlledIds), null)
    if (doc.conns.size === 0 && persistence !== null) {
      // if persisted, we store state and destroy ydocument
      persistence.writeState(doc.name, doc).then(() => {
        doc.destroy()
      })
      docs.delete(doc.name)
    }
  }
  conn.close()
}

/**
 * @param {WSSharedDoc} doc
 * @param {any} conn
 * @param {Uint8Array} m
 */
const send = (doc, conn, m) => {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    closeConn(doc, conn)
  }
  try {
    conn.send(m, /** @param {any} err */ err => { err != null && closeConn(doc, conn) })
  } catch (e) {
    closeConn(doc, conn)
  }
}

const pingTimeout = 30000

/**
 * Entry point called when a frontend connects vis ws
 * 1. Initialize the shared document
 * 2. Set up the connection
 * 3. Heartbeat
 * 4. Listen to messages
 * 
 * @param {any} conn
 * @param {any} req
 * @param {any} opts
 */
export function setupWSConnection(conn, req, { docName = req.url.slice(1).split('?')[0], gc = true } = {}) {
  conn.binaryType = 'arraybuffer'
  // get doc, initialize if it does not exist yet
  const doc = getYDoc(docName, gc)
  doc.conns.set(conn, new Set())
  // listen and reply to events
  conn.on('message', /** @param {ArrayBuffer} message */ message => messageListener(conn, doc, new Uint8Array(message)))

  // Check if connection is still alive
  let pongReceived = true
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        closeConn(doc, conn)
      }
      clearInterval(pingInterval)
    } else if (doc.conns.has(conn)) {
      pongReceived = false
      try {
        conn.ping()
      } catch (e) {
        closeConn(doc, conn)
        clearInterval(pingInterval)
      }
    }
  }, pingTimeout)
  conn.on('close', () => {
    closeConn(doc, conn)
    clearInterval(pingInterval)
  })
  conn.on('pong', () => {
    pongReceived = true
  })
  // put the following in a variables in a block so the interval handlers don't keep in in
  // scope
  {
    // send sync step 1
    const encoder = createEncoder()
    writeVarUint(encoder, messageSync)
    writeSyncStep1(encoder, doc)
    send(doc, conn, toUint8Array(encoder))
    const awarenessStates = doc.awareness.getStates()
    if (awarenessStates.size > 0) {
      const encoder = createEncoder()
      writeVarUint(encoder, messageAwareness)
      writeVarUint8Array(encoder, encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())))
      send(doc, conn, toUint8Array(encoder))
    }
  }
}
