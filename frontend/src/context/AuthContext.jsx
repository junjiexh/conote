import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

// Utility function to decode JWT token
const decodeToken = (token) => {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load user data from token on mount
  useEffect(() => {
    if (!token) {
      return;
    }
    const decoded = decodeToken(token);
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (decoded?.exp && decoded.exp < nowInSeconds && refreshToken) {
      // Access token expired, try refresh
      refreshSession();
      return;
    }
    if (decoded) {
      setUser({
        id: decoded.userId || decoded.user_id || decoded.sub,
        email: decoded.sub,
        username: decoded.sub?.split('@')[0] || 'User',
      });
    }
  }, [token, refreshToken]);

  const persistTokens = (nextToken, nextRefreshToken) => {
    if (nextToken) {
      localStorage.setItem('token', nextToken);
      setToken(nextToken);
    }
    if (nextRefreshToken) {
      localStorage.setItem('refreshToken', nextRefreshToken);
      setRefreshToken(nextRefreshToken);
    }
    const decoded = decodeToken(nextToken);
    if (decoded) {
      setUser({
        id: decoded.userId || decoded.user_id || decoded.sub,
        email: decoded.sub,
        username: decoded.sub?.split('@')[0] || 'User',
      });
    }
  };

  const refreshSession = async () => {
    if (!refreshToken) {
      logout();
      return false;
    }
    try {
      const response = await authAPI.refresh(refreshToken);
      const { token: newToken, refreshToken: newRefreshToken } = response.data || {};
      persistTokens(newToken, newRefreshToken || refreshToken);
      return true;
    } catch {
      logout();
      return false;
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.login(email, password);
      const { token: accessToken, refreshToken: nextRefreshToken } = response.data;
      persistTokens(accessToken, nextRefreshToken);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.register(email, password);
      const { token: accessToken, refreshToken: nextRefreshToken } = response.data;
      persistTokens(accessToken, nextRefreshToken);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  const isAuthenticated = () => {
    return !!token;
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        login,
        register,
        logout,
        refreshSession,
        isAuthenticated,
        loading,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
