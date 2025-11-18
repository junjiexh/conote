import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add JWT token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

// Authentication API
export const authAPI = {
  register: (email, password) =>
    api.post("/auth/register", { email, password }),
  login: (email, password) => api.post("/auth/login", { email, password }),
};

// Document API
export const documentAPI = {
  getAll: () => api.get("/documents"),
  getById: (id) => api.get(`/documents/${id}`),
  create: (title, parentId = null) =>
    api.post("/documents", { title, parentId }),
  update: (id, title, content) =>
    api.put(`/documents/${id}`, { title, content }),
  move: (id, newParentId) =>
    api.patch(`/documents/${id}/move`, { newParentId }),
  delete: (id) => api.delete(`/documents/${id}`),
  search: (query, page = 0, size = 20) =>
    api.post("/documents/search", { query, page, size }),
};

// Sharing API
export const sharingAPI = {
  shareDocument: (documentId, email, permissionLevel) =>
    api.post("/sharing/share", { documentId, email, permissionLevel }),
  revokePermission: (documentId, userId) =>
    api.delete("/sharing/revoke", { data: { documentId, userId } }),
  getCollaborators: (documentId) =>
    api.get(`/sharing/document/${documentId}/collaborators`),
  getPermissions: (documentId) =>
    api.get(`/sharing/document/${documentId}/permissions`),
  checkAccess: (documentId) =>
    api.get(`/sharing/document/${documentId}/check-access`),
};

export default api;
