# Collab-server

## proto

This server use grpc to communicate with other service, don't forget to execute
`npm run proto:gen` after every change to proto files(the typical location is in HOME/proto/collab/*.proto)

## env

SNAPSHOT_FLUSH_INTERVAL = save snapshot after each edit

## Snapshot worker

A background worker rebuilds and persists snapshots from a Redis ZSET queue (deduped/throttled). Ensure `COLLAB_REDIS_URL` is configured.

Run:

```bash
node snapshotWorker.js
```

Key environment variables:
- `COLLAB_REDIS_URL` – Redis connection string (required)
- `COLLAB_GRPC_ADDRESS` – gRPC snapshot service address (default `localhost:9090`)
- `COLLAB_REDIS_NAMESPACE` – Redis key namespace (default `conote:collab`)
- `COLLAB_SNAPSHOT_QUEUE_KEY` – ZSET key (default `${namespace}:snapshot:queue`)
- `SNAPSHOT_THROTTLE_MS` – enqueue throttle window (default `SNAPSHOT_FLUSH_INTERVAL` or `2000`)
- `SNAPSHOT_PROCESSING_TTL_MS` – per-doc processing window while a worker runs (default `60000`)
- `SNAPSHOT_RETRY_DELAY_MS` – retry delay after failures (default `5000`)
- `SNAPSHOT_WORKER_POLL_INTERVAL_MS` – idle poll interval (default `500`)
