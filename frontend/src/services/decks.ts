import axios from 'axios';

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

export const decksService = {
  async getDecks(page = 1, limit = 20) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await api.get(`/decks?${params}`);
    return response.data;
  },

  async getDeck(deckId: string) {
    const response = await api.get(`/decks/${deckId}`);
    return response.data;
  },

  async createDeck(deckData: {
    name: string;
    description?: string;
    format: string;
    archetype?: string;
    isPublic?: boolean;
  }) {
    const response = await api.post('/decks', deckData);
    return response.data;
  },

  async updateDeck(deckId: string, deckData: any) {
    const response = await api.put(`/decks/${deckId}`, deckData);
    return response.data;
  },

  async deleteDeck(deckId: string) {
    const response = await api.delete(`/decks/${deckId}`);
    return response.data;
  },

  async addCardToDeck(deckId: string, cardData: {
    cardId: string;
    quantity: number;
    board?: 'main' | 'side' | 'maybe';
  }) {
    const response = await api.post(`/decks/${deckId}/cards`, cardData);
    return response.data;
  },

  async updateDeckCard(deckId: string, cardId: string, board: 'main' | 'side' | 'maybe', cardData: {
    quantity: number;
  }) {
    const response = await api.put(`/decks/${deckId}/cards/${cardId}/${board}`, cardData);
    return response.data;
  },

  async removeDeckCard(deckId: string, cardId: string, board: 'main' | 'side' | 'maybe') {
    const response = await api.delete(`/decks/${deckId}/cards/${cardId}/${board}`);
    return response.data;
  },

  async validateDeck(deckId: string) {
    const response = await api.get(`/decks/${deckId}/validate`);
    return response.data as {
      deckId: string; format: string; mainCount: number; sideCount: number; valid: boolean; issues: string[];
    };
  },

  async bulkUpsertDeckCards(deckId: string, operations: Array<{ cardId: string; quantity: number; board: 'main'|'side'|'maybe' }>) {
    const response = await api.post(`/decks/${deckId}/cards/bulk`, { operations });
    return response.data as { updated: number };
  },

  async exportDeckMTGA(deckId: string) {
    const response = await api.get(`/decks/${deckId}/export/mtga`);
    return response.data;
  },

  async importDeckFromMTGA(decklistText: string, deckName?: string) {
    const response = await api.post('/decks/import/mtga', { decklistText, deckName });
    return response.data;
  },

  async duplicateDeck(deckId: string) {
    const response = await api.post(`/decks/${deckId}/duplicate`);
    return response.data;
  },
};
