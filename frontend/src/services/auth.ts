import axios from 'axios';
import type { User, AuthResponse, LoginCredentials, RegisterData } from '../types';

// Use relative /api in dev (proxied by Vite), allow override via VITE_API_URL in prod
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Token storage key (only access token in localStorage now)
const ACCESS_TOKEN_KEY = 'token';

// Configuration axios with credentials for httpOnly cookies
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true, // Important: send/receive httpOnly cookies
});

// Flag to prevent multiple refresh attempts simultaneously
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

// Subscribe to token refresh
function subscribeToRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

// Notify all subscribers when token is refreshed
function onRefreshed(token: string) {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
}

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur pour gérer les erreurs de réponse et le refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Si c'est une erreur 401 et qu'on n'a pas déjà réessayé
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Si on est déjà en train de rafraîchir, attendre
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeToRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        // Tenter de rafraîchir le token (le cookie httpOnly sera envoyé automatiquement)
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
          withCredentials: true, // Important: include httpOnly cookie
        });
        
        const { token: newAccessToken } = response.data;
        
        // Sauvegarder le nouveau access token et programmer le prochain refresh
        localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
        scheduleTokenRefresh(newAccessToken);
        
        // Notifier les requêtes en attente
        onRefreshed(newAccessToken);
        
        // Réessayer la requête originale
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token invalide ou expiré, déconnecter
        clearTokens();
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

// Helper to clear access token (httpOnly cookie is cleared server-side on logout)
function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem('tokenExpiresAt');
}

// Helper to decode JWT and get expiration time
function getTokenExpiration(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null; // Convert to milliseconds
  } catch {
    return null;
  }
}

// Proactive token refresh - refresh 5 minutes before expiration
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleTokenRefresh(token: string) {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  
  const expiresAt = getTokenExpiration(token);
  if (!expiresAt) return;
  
  // Save expiration for debugging
  localStorage.setItem('tokenExpiresAt', new Date(expiresAt).toISOString());
  
  // Refresh 5 minutes before expiration (or immediately if less than 5 min left)
  const refreshIn = Math.max(0, expiresAt - Date.now() - 5 * 60 * 1000);
  
  if (refreshIn > 0) {
    refreshTimer = setTimeout(async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
          withCredentials: true,
        });
        const { token: newToken } = response.data;
        localStorage.setItem(ACCESS_TOKEN_KEY, newToken);
        scheduleTokenRefresh(newToken); // Schedule next refresh
        console.log('[Auth] Token proactively refreshed');
      } catch (error) {
        console.warn('[Auth] Proactive refresh failed, will retry on next request');
      }
    }, refreshIn);
    console.log(`[Auth] Token refresh scheduled in ${Math.round(refreshIn / 60000)} minutes`);
  }
}

// Initialize refresh schedule on page load
const existingToken = localStorage.getItem(ACCESS_TOKEN_KEY);
if (existingToken) {
  scheduleTokenRefresh(existingToken);
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post('/auth/login', credentials);
    // Schedule proactive refresh
    if (response.data.token) {
      scheduleTokenRefresh(response.data.token);
    }
    return response.data;
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post('/auth/register', data);
    // Schedule proactive refresh
    if (response.data.token) {
      scheduleTokenRefresh(response.data.token);
    }
    return response.data;
  },

  async me(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      // Server will clear the httpOnly cookie
      await api.post('/auth/logout');
    } finally {
      // Always clear access token from localStorage
      clearTokens();
    }
  },
  
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await api.post('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  },
  
  // Manually clear tokens (used by AuthContext)
  clearTokens
};

export default api;
