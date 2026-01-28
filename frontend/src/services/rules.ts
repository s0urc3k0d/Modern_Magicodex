import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_BASE_URL, timeout: 10000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type DeckRules = {
  formats: string[];
  singletonFormats: string[];
  mainboardMinimums: Record<string, number>;
  sideboardLimits: Record<string, number>;
  banlists: Record<string, string[]>;
};

export const rulesService = {
  async getRules(): Promise<DeckRules> {
    const res = await api.get('/rules');
    return res.data;
  },
};
