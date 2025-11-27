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

## Load test (k6)

1. Install bundle tool: `npm install --prefix collab-server --save-dev esbuild` (updates lockfile).
2. Bundle the script (marks k6 imports external):  
   `npm run loadtest:bundle --prefix collab-server`  
   or  
   `npx esbuild loadtest/collab-ws.k6.js --bundle --platform=neutral --format=esm --target=es2020 --external:k6 --external:k6/ws --external:k6/metrics --outfile=loadtest/dist/collab-ws.bundle.js`.
3. Run with k6 (Kong endpoint, single doc):  
   `k6 run loadtest/dist/collab-ws.bundle.js --env WS_BASE=ws://localhost:8000/collab --env DOC_ID=711f3de2-d229-4c95-b072-fb275ec17bb4 --env STAGES='[{"duration":"30s","target":50},{"duration":"2m","target":50},{"duration":"30s","target":0}]' --env EDIT_INTERVAL_MS=1500 --env SESSION_MS=60000`.
   - `target` in stages == concurrent editors for the hot document.
   - Adjust `DOC_ID` for other documents; token check should be disabled for the test as agreed.
