import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, AuthResponse, LoginCredentials, RegisterData } from '../types';
import { authService } from '../services/auth';
import { handleApiError } from '../lib/apiErrors';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà connecté au chargement
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const userData = await authService.me();
      setUser(userData);
    } catch (error) {
      // Token invalide ou expiré - clearTokens géré par l'intercepteur
      authService.clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response: AuthResponse = await authService.login(credentials);
      
      localStorage.setItem('token', response.token);
      setUser(response.user);
      
      toast.success(`Bienvenue, ${response.user.username} !`);
      return true;
    } catch (error: unknown) {
      handleApiError(error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response: AuthResponse = await authService.register(data);
      
      localStorage.setItem('token', response.token);
      setUser(response.user);
      
      toast.success(`Compte créé ! Bienvenue, ${response.user.username} !`);
      return true;
    } catch (error: unknown) {
      handleApiError(error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.clearTokens();
    setUser(null);
    toast.success('Déconnexion réussie');
  };

  const refreshUser = async () => {
    try {
      const userData = await authService.me();
      setUser(userData);
    } catch (error) {
      // Si la récupération échoue, déconnecter l'utilisateur
      authService.clearTokens();
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
