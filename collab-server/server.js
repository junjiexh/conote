const http = require('http');
const { WebSocketServer } = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');

const DEFAULT_PORT = parseInt(process.env.COLLAB_SERVER_PORT || process.env.PORT || '1234', 10);
const HOST = process.env.HOST || '0.0.0.0';
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000/api';

const healthResponse = JSON.stringify({ status: 'ok' });

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(healthResponse);
    return;
  }
  res.writeHead(200);
  res.end('Conote collaboration server');
});

const wss = new WebSocketServer({ noServer: true });

const authenticateRequest = async (documentId, token) => {
  if (!token) {
    throw new Error('Missing bearer token');
  }
  const response = await fetch(`${BACKEND_API_URL}/sharing/document/${documentId}/check-access`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Access denied (${response.status})`);
  }
};

const extractConnectionParams = (req) => {
  const requestUrl = new URL(req.url, 'http://localhost');
  const pathSegments = requestUrl.pathname.split('/').filter(Boolean);
  return {
    documentId: pathSegments[0],
    token: requestUrl.searchParams.get('token'),
  };
};

server.on('upgrade', async (request, socket, head) => {
  try {
    const { documentId, token } = extractConnectionParams(request);
    if (!documentId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    await authenticateRequest(documentId, token);
    wss.handleUpgrade(request, socket, head, (ws) => {
      const cleanup = () => {
        ws.removeAllListeners();
      };
      ws.on('close', cleanup);
      setupWSConnection(ws, request, { docName: documentId });
    });
  } catch (error) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
  }
});

server.listen(DEFAULT_PORT, HOST, () => {
  console.log(`Collaboration server listening on ${HOST}:${DEFAULT_PORT}`);
  console.log(`Forwarding access checks to ${BACKEND_API_URL}`);
});
