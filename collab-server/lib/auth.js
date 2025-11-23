/**
 * Authenticate a document access request with the backend API
 * @param {string} documentId - The document identifier
 * @param {string} token - Bearer token for authentication
 * @param {string} backendUrl - Backend API base URL
 * @returns {Promise<void>}
 * @throws {Error} If authentication fails
 */
export const authenticateRequest = async (documentId, token, backendUrl) => {
    if (!token) {
        throw new Error('Missing bearer token');
    }
    const response = await fetch(`${backendUrl}/sharing/document/${documentId}/check-access`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Access denied (${response.status})`);
    }
};

/**
 * Extract connection parameters from WebSocket upgrade request
 * @param {import('http').IncomingMessage} req - HTTP request
 * @returns {{documentId: string, token: string}} Connection parameters
 */
export const extractConnectionParams = (req) => {
    const requestUrl = new URL(req.url, 'http://localhost');
    const pathSegments = requestUrl.pathname.split('/').filter(Boolean);
    return {
        documentId: pathSegments[0]?.trim(),
        token: requestUrl.searchParams.get('token'),
    };
};
