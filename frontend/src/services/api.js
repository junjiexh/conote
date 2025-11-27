import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Raw client without interceptors (for refresh token calls)
const bareApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise = null;

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
  async (error) => {
    const originalRequest = error.config;
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(error);
      }

      if (!refreshPromise) {
        refreshPromise = bareApi
          .post("/auth/refresh", { refreshToken })
          .then((res) => {
            const { token: newToken, refreshToken: newRefreshToken } = res.data;
            if (newToken) {
              localStorage.setItem("token", newToken);
            }
            if (newRefreshToken) {
              localStorage.setItem("refreshToken", newRefreshToken);
            }
            return { newToken, newRefreshToken };
          })
          .catch((refreshError) => {
            localStorage.removeItem("token");
            localStorage.removeItem("refreshToken");
            window.location.href = "/login";
            throw refreshError;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        const { newToken } = await refreshPromise;
        originalRequest._retry = true;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (err) {
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  },
);

// Authentication API
export const authAPI = {
  register: (email, password) =>
    api.post("/auth/register", { email, password }),
  login: (email, password) => api.post("/auth/login", { email, password }),
  refresh: (refreshToken) => bareApi.post("/auth/refresh", { refreshToken }),
};

// Document API
export const documentAPI = {
  getAll: () => api.get("/documents"),
  getById: (id) => api.get(`/documents/${id}`),
  create: (title, parentId = null) =>
    api.post("/documents", { title, parentId }),
  update: (id, payload = {}) => api.put(`/documents/${id}`, payload),
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
