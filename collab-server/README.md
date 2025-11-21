# Collab-server

## proto

This server use grpc to communicate with other service, don't forget to execute
`npm run proto:gen` after every change to proto files(the typical location is in HOME/proto/collab/*.proto)

## env

SNAPSHOT_FLUSH_INTERVAL = save snapshot after each edit