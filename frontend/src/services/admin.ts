import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Configuration axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Plus long timeout pour les opérations admin
});

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const adminService = {
  async getStats() {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  async getUsers(page = 1, limit = 20, search?: string) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (search) {
      params.append('search', search);
    }

    const response = await api.get(`/admin/users?${params}`);
    return response.data;
  },

  async updateUser(userId: string, userData: any) {
    const response = await api.put(`/admin/users/${userId}`, userData);
    return response.data;
  },

  async deleteUser(userId: string) {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },

  async getSyncLogs(page = 1, limit = 20) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await api.get(`/admin/sync/logs?${params}`);
    return response.data;
  },

  async triggerSync(options: { type: 'sets' | 'cards' | 'full' | 'french-translations' | 'french-sets', force?: boolean, language?: 'en' | 'fr', setCode?: string } = { type: 'full', force: false, language: 'fr' }) {
    const response = await api.post('/admin/sync/trigger', options);
    return response.data;
  },

  async getPerformanceMetrics() {
    const response = await api.get('/admin/performance');
    return response.data;
  },

  async getSystemHealth() {
    const response = await api.get('/admin/health');
    return response.data;
  },

  async cleanupOldData(daysToKeep = 30) {
    const response = await api.post('/admin/cleanup', { daysToKeep });
    return response.data;
  },

  // Nouvelles fonctions pour la synchronisation propre
  async cleanDatabase() {
    try {
      console.log('🧹 Début du nettoyage de la base de données...');
      const response = await api.post('/admin-clean/database/clean');
      console.log('✅ Nettoyage réussi:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur lors du nettoyage:', error);
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
      throw error;
    }
  },

  async syncSets(force = false) {
    const response = await api.post('/admin-clean/sync/sets', { force });
    return response.data;
  },

  async syncCards(batchSize = 100) {
    const response = await api.post('/admin-clean/sync/cards', { batchSize });
    return response.data;
  },

  async updateFrenchTranslations(batchSize = 50) {
    const response = await api.post('/admin-clean/sync/french-translations', { batchSize });
    return response.data;
  },

  async testSyncSets() {
    const response = await api.post('/admin-clean/sync/sets/test');
    return response.data;
  },

  async testSyncCards() {
    const response = await api.post('/admin-clean/sync/cards/test');
    return response.data;
  },

  async testUpdateFrenchTranslations() {
    const response = await api.post('/admin-clean/sync/french-translations/test');
    return response.data;
  },

  // ================================
  // NOUVEAU SERVICE UNIFIED
  // ================================

  async syncUnifiedSets(force = false) {
    const response = await api.post('/admin/sync-unified/sets', { force });
    return response.data;
  },

  async syncUnifiedCards(setCode?: string, force = false) {
    const response = await api.post('/admin/sync-unified/cards', { setCode, force });
    return response.data;
  },

  async syncUnifiedFull(setCode?: string, force = false) {
    const response = await api.post('/admin/sync-unified/full', { setCode, force });
    return response.data;
  },

  async syncUnifiedTest(setCode = 'dmu') {
    const response = await api.post('/admin/sync-unified/test', { setCode });
    return response.data;
  },

  // ================================
  // NOUVEAU SERVICE HYBRID (EN+FR en 1ère passe)
  // ================================

  async syncHybridSets(force = false) {
    const response = await api.post('/admin/sync-hybrid/sets', { force });
    return response.data;
  },

  async syncHybridCards(setCode: string, force = false) {
    const response = await api.post('/admin/sync-hybrid/cards', { setCode, force });
    return response.data;
  },

  async syncHybridFull(force = false) {
    const response = await api.post('/admin/sync-hybrid/full', { force });
    return response.data;
  },

  // ================================
  // DELTA EXTRAS
  // ================================
  async deltaExtras(setCode?: string) {
    const response = await api.post('/admin/scryfall/delta-extras', { setCode });
    return response.data;
  },
};
