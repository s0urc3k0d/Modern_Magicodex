import axios from 'axios';
import type { ListType, UserListItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Configuration axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const collectionService = {
  async getCollection(
    page = 1,
    limit = 20,
    search?: string,
    filters?: {
      setId?: string;
      colors?: string[];
      rarity?: string;
      hasCard?: boolean;
      extras?: boolean;
      typeContains?: string;
      text?: string;
      textMode?: 'and' | 'or';
      minEur?: number;
      maxEur?: number;
      sort?: 'releasedAt' | 'name' | 'collectorNumber' | 'price';
      order?: 'asc' | 'desc';
    }
  ) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (search) params.append('search', search);
    if (filters?.setId) params.append('setId', filters.setId);
    if (filters?.colors && filters.colors.length) params.append('colors', filters.colors.join(','));
    if (filters?.rarity) params.append('rarity', filters.rarity);
  if (typeof filters?.hasCard === 'boolean') params.append('hasCard', String(filters.hasCard));
  if (typeof filters?.extras === 'boolean') params.append('extras', String(filters.extras));
  if (filters?.typeContains) params.append('typeContains', filters.typeContains);
  if (filters?.text) params.append('text', filters.text);
  if (filters?.textMode) params.append('textMode', filters.textMode);
  if (typeof filters?.minEur === 'number') params.append('minEur', String(filters.minEur));
  if (typeof filters?.maxEur === 'number') params.append('maxEur', String(filters.maxEur));
  if (filters?.sort) params.append('sort', filters.sort);
  if (filters?.order) params.append('order', filters.order);

    const response = await api.get(`/collection?${params}`);
    return response.data;
  },

  async getCollectionStats(groupBy = 'set', extras?: boolean) {
    const params = new URLSearchParams({ groupBy });
    if (typeof extras === 'boolean') params.append('extras', String(extras));
    const response = await api.get(`/collection/stats?${params}`);
    return response.data;
  },

  async addCard(cardId: string, quantity: number, isFoil = false, language = 'fr') {
    const response = await api.post('/collection/cards', {
      cardId,
      quantity: isFoil ? 0 : quantity,
      quantityFoil: isFoil ? quantity : 0,
      language,
    });
    return response.data;
  },

  async addCardWithDetails(cardId: string, data: { quantity: number; quantityFoil: number; language: string; condition?: string }) {
    const response = await api.post('/collection/cards', {
      cardId,
      quantity: data.quantity,
      quantityFoil: data.quantityFoil,
      language: data.language,
      condition: data.condition || 'NM',
    });
    return response.data;
  },

  async addCardsBulk(items: Array<{ cardId: string; quantity: number; quantityFoil?: number; language?: string }>, mode: 'increment' | 'set' = 'increment') {
    const response = await api.post('/collection/cards/bulk', {
      items: items.map(i => ({
        cardId: i.cardId,
        quantity: i.quantity,
        quantityFoil: i.quantityFoil ?? 0,
        language: i.language ?? 'en'
      })),
      mode
    });
    return response.data as { success: boolean; summary: any };
  },

  async updateCard(cardId: string, quantity: number, quantityFoil?: number, language = 'fr') {
    const data: any = {};
    
    if (quantity !== undefined) {
      data.quantity = quantity;
    }
    
    if (quantityFoil !== undefined) {
      data.quantityFoil = quantityFoil;
    }
    
    const response = await api.put(`/collection/cards/${cardId}?language=${encodeURIComponent(language)}`, data);
    return response.data;
  },

  async removeCard(cardId: string, language = 'fr') {
    const response = await api.delete(`/collection/cards/${cardId}?language=${encodeURIComponent(language)}`);
    return response.data;
  },

  // importCollection intentionally not implemented (no backend endpoint)

  async getMissingFromSet(setId: string, extras?: boolean) {
    const params = new URLSearchParams();
    if (typeof extras === 'boolean') params.append('extras', String(extras));
    const q = params.toString();
    const response = await api.get(`/collection/sets/${setId}/missing${q ? `?${q}` : ''}`);
    return response.data;
  },

  async getUserCardsByIds(cardIds: string[]) {
    if (!cardIds || cardIds.length === 0) return [] as Array<{ cardId: string; quantity: number; quantityFoil: number }>;
    const params = new URLSearchParams({ ids: cardIds.join(',') });
    const response = await api.get(`/collection/cards?${params}`);
    return response.data as Array<{ cardId: string; quantity: number; quantityFoil: number }>;
  },

  // Wishlist & Trade list methods
  async getListItems() {
    const response = await api.get('/collection/lists');
    return response.data as UserListItem[];
  },

  async upsertListItem(cardId: string, type: ListType, quantity = 1, notes?: string) {
    const response = await api.post('/collection/lists', { cardId, type, quantity, notes });
    return response.data as UserListItem;
  },

  async deleteListItem(id: string) {
    const response = await api.delete(`/collection/lists/${id}`);
    return response.data as { success: boolean };
  },
};

export const setsService = {
  async getSets(page = 1, limit = 20, search?: string) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) params.append('search', search);
    const response = await api.get(`/sets?${params}`);
    return response.data as { sets: any[]; pagination: { totalPages: number } };
  },

  async getSet(setId: string) {
    const response = await api.get(`/sets/${setId}`);
    return response.data as any;
  },

  async getSetCards(setId: string, page = 1, limit = 100, extras?: boolean) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (typeof extras === 'boolean') params.append('extras', String(extras));
    const response = await api.get(`/sets/${setId}/cards?${params}`);
    return response.data as { set: any; cards: any[]; pagination: { page: number; totalPages: number } };
  },
};

export const cardsService = {
  async getCards(
    page = 1,
    limit = 20,
    search?: string,
    filters?: { setId?: string; colors?: string[]; rarity?: string; type?: string; cmc?: number }
  ) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (search) {
      params.append('search', search);
    }
    
    if (filters) {
      if (filters.setId) params.append('setId', filters.setId);
      if (filters.colors && filters.colors.length) params.append('colors', filters.colors.join(','));
      if (filters.rarity) params.append('rarity', filters.rarity);
      if (filters.type) params.append('type', filters.type);
      if (typeof filters.cmc === 'number') params.append('cmc', String(filters.cmc));
    }

    const response = await api.get(`/cards?${params}`);
    return response.data;
  },

  async getCard(cardId: string) {
    const response = await api.get(`/cards/${cardId}`);
    return response.data;
  },

  async getCardsFts(query: string, limit = 50) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const response = await api.get(`/cards/fts?${params}`);
    return response.data as { cards: any[] };
  },

  async getCardsFtsAdvanced(query: string, opts?: { limit?: number; colors?: string[]; rarity?: string; typeContains?: string; priceMin?: number; priceMax?: number }) {
    const params = new URLSearchParams({ q: query });
    params.append('limit', String(opts?.limit ?? 50));
    if (opts?.colors?.length) params.append('colors', opts.colors.join(','));
    if (opts?.rarity) params.append('rarity', opts.rarity);
    if (opts?.typeContains) params.append('typeContains', opts.typeContains);
    if (typeof opts?.priceMin === 'number') params.append('priceMin', String(opts.priceMin));
    if (typeof opts?.priceMax === 'number') params.append('priceMax', String(opts.priceMax));
    const response = await api.get(`/cards/fts?${params}`);
    return response.data as { cards: any[] };
  },

  async identifyByBottom(collector: string, opts?: { year?: number; rarity?: string; lang?: string }) {
    const params = new URLSearchParams({ collector });
    if (opts?.year) params.append('year', String(opts.year));
    if (opts?.rarity) params.append('rarity', opts.rarity);
    if (opts?.lang) params.append('lang', opts.lang);
    const response = await api.get(`/cards/identify?${params}`);
    return response.data as { cards: any[]; count: number };
  },
};
