# Collaborative Editing Architecture

## Components

- **Frontend**: Initializes a Tiptap editor backed by a Y.js document. When a document ID is available it joins the corresponding Y room through the collaboration server. Title changes are persisted via the REST API, while the rich-text body is handled entirely by Y.js.
- **Collaboration server**: A Node.js + `y-websocket` bridge that validates every WebSocket connection (via `/sharing/document/{id}/check-access`), proxies all CRDT traffic, and now persists snapshots through gRPC. It no longer depends on manual saves from the UI.
- **Backend (Spring Boot)**: Owns document metadata and exposes a gRPC service (`CollaborationSnapshotService`) that stores serialized Y.js state blobs in PostgreSQL (`document_collab_snapshots`).

## Snapshot lifecycle

1. When the collaboration server spins up a Y document it calls `GetSnapshot(document_id)` over gRPC.
2. If the backend returns a snapshot, the server applies it with `Y.applyUpdate` before any client edits.
3. Every change schedules a flush (default every 2 seconds) that encodes the full state with `Y.encodeStateAsUpdate` and calls `SaveSnapshot`.
4. When the last client disconnects (or the doc is destroyed), the server forces another flush so PostgreSQL always holds the last good state.

No incremental update log is stored—PostgreSQL only keeps the latest snapshot per document. Because manual saves are gone, HTML content is no longer stored in the `documents` table; search is limited to titles until we add derived content indexing.

## Configuration

| Variable | Service | Default | Description |
| --- | --- | --- | --- |
| `VITE_COLLAB_URL` | frontend build | `ws://localhost:8000/collab` | WebSocket endpoint injected into the React app (proxied by Kong) |
| `COLLAB_SERVER_PORT` | collab-server | `1234` | WebSocket listener port |
| `COLLAB_GRPC_ADDRESS` | collab-server | `backend:9090` | Address of the backend gRPC snapshot service |
| `SNAPSHOT_FLUSH_INTERVAL` | collab-server | `2000` | (Optional) milliseconds between snapshot flushes |
| `GRPC_SERVER_PORT` | backend | `9090` | gRPC server port exposed by Spring Boot |

To run the stack locally:

```bash
docker compose up postgres backend collab-server kong frontend
# WebSockets => Kong:8000/collab -> collab-server, REST => Kong/backend, snapshots => backend:9090 (gRPC)
```

## Extending

- **Backups**: since the snapshot table keeps one row per document, periodic backups can simply dump the table.
- **Search**: to reintroduce full-text search, add a worker that converts snapshots to HTML (via `@tiptap/html`) and indexes them.
- **Conflict handling**: the gRPC service accepts whole-document snapshots, so scaling horizontally just requires every collab server to fetch the latest blob before writing.
