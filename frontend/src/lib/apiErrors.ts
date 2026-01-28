/**
 * API Error handling utilities
 * Provides consistent error parsing and user-friendly messages
 */
import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

// Standard API error response structure
interface ApiErrorResponse {
  error?: string;
  message?: string;
  details?: Array<{ message: string; path?: string[] }>;
}

// User-friendly error messages for common HTTP status codes
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Requête invalide. Vérifiez les données saisies.',
  401: 'Session expirée. Veuillez vous reconnecter.',
  403: 'Accès non autorisé.',
  404: 'Ressource non trouvée.',
  409: 'Cette ressource existe déjà.',
  422: 'Données invalides.',
  429: 'Trop de requêtes. Veuillez patienter.',
  500: 'Erreur serveur. Veuillez réessayer plus tard.',
  502: 'Service temporairement indisponible.',
  503: 'Service en maintenance.',
};

// Common error message patterns to translate
const ERROR_TRANSLATIONS: Record<string, string> = {
  'Network Error': 'Erreur de connexion. Vérifiez votre connexion internet.',
  'timeout of': 'La requête a expiré. Veuillez réessayer.',
  'Invalid token': 'Session invalide. Veuillez vous reconnecter.',
  'Token expired': 'Session expirée. Veuillez vous reconnecter.',
  'Refresh token invalide': 'Session expirée. Veuillez vous reconnecter.',
  'Refresh token expiré': 'Session expirée. Veuillez vous reconnecter.',
  'User not found': 'Utilisateur non trouvé.',
  'Email ou mot de passe incorrect': 'Email ou mot de passe incorrect.',
  'Un utilisateur avec cet': 'Un compte avec ces informations existe déjà.',
};

/**
 * Extract a user-friendly error message from an API error
 */
export function getErrorMessage(error: unknown): string {
  // Handle Axios errors
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    
    // Try to get message from response body
    const responseData = axiosError.response?.data;
    if (responseData) {
      // Check for specific error field
      if (responseData.error) {
        return translateError(responseData.error);
      }
      if (responseData.message) {
        return translateError(responseData.message);
      }
      // Check for validation details
      if (responseData.details && responseData.details.length > 0) {
        return responseData.details.map(d => d.message).join('. ');
      }
    }
    
    // Fallback to HTTP status message
    const status = axiosError.response?.status;
    if (status && STATUS_MESSAGES[status]) {
      return STATUS_MESSAGES[status];
    }
    
    // Network/timeout errors
    if (axiosError.message) {
      return translateError(axiosError.message);
    }
  }
  
  // Handle standard Error objects
  if (error instanceof Error) {
    return translateError(error.message);
  }
  
  // Fallback for unknown errors
  return 'Une erreur inattendue est survenue.';
}

/**
 * Translate common error messages to French
 */
function translateError(message: string): string {
  // Check for exact matches
  if (ERROR_TRANSLATIONS[message]) {
    return ERROR_TRANSLATIONS[message];
  }
  
  // Check for partial matches
  for (const [pattern, translation] of Object.entries(ERROR_TRANSLATIONS)) {
    if (message.includes(pattern)) {
      return translation;
    }
  }
  
  return message;
}

/**
 * Handle an API error and show a toast notification
 * @returns The error message for potential further use
 */
export function handleApiError(error: unknown, customMessage?: string): string {
  const message = customMessage || getErrorMessage(error);
  toast.error(message);
  
  // Log for debugging in development
  if (import.meta.env.DEV) {
    console.error('[API Error]', error);
  }
  
  return message;
}

/**
 * Check if an error is a network/connection error
 */
export function isNetworkError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return !error.response && (
      error.message === 'Network Error' ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ERR_NETWORK'
    );
  }
  return false;
}

/**
 * Check if an error is an authentication error (401/403)
 */
export function isAuthError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return error.response?.status === 401 || error.response?.status === 403;
  }
  return false;
}

/**
 * Check if an error is a rate limit error (429)
 */
export function isRateLimitError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return error.response?.status === 429;
  }
  return false;
}

/**
 * Check if an error is a validation error (400/422)
 */
export function isValidationError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return error.response?.status === 400 || error.response?.status === 422;
  }
  return false;
}
