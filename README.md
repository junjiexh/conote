# Conote

A note-taking application focus on multi-user collaboration and high performance

## Features

- Rich-text editor based on Tiptap.
- Collaborative experience based on Y.js.
- Offline-fist support, auto merge the confliect after reconnection.

## Architecture

### Collaboration Server

```mermaid
graph LR
    ClientA[Client A] -- WebSocket --> Server1
    ClientB[Client B] -- WebSocket --> Server2
    
    subgraph "Redis (Central Store)"
        Stream[Redis Stream\n(y:room:demo:index)]
    end

    Server1 -- XADD (Push Update) --> Stream
    Stream -- XREAD (Poll Update) --> Server1
    Stream -- XREAD (Poll Update) --> Server2

    Server1 -- app.publish --> ClientA
    Server2 -- app.publish --> ClientB
```


### Client



## Security

- 

## Perfomance