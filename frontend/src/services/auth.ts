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
        
        // Sauvegarder le nouveau access token
        localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
        
        // Notifier les requêtes en attente
        onRefreshed(newAccessToken);
        
        // Réessayer la requête originale
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token invalide ou expiré, déconnecter
        clearTokens();
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
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post('/auth/login', credentials);
    // Access token stored in localStorage, refresh token is in httpOnly cookie
    return response.data;
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post('/auth/register', data);
    // Access token stored in localStorage, refresh token is in httpOnly cookie
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
