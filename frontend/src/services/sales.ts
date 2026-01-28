import api from '../lib/api';

export interface SaleItem {
  id: string;
  card: {
    id: string;
    scryfallId: string;
    name: string;
    nameFr?: string;
    collectorNumber: string;
    rarity: string;
    imageUris?: {
      small?: string;
      normal?: string;
      large?: string;
    };
    priceEur?: number;
    priceEurFoil?: number;
    set: {
      id: string;
      code: string;
      name: string;
      nameFr?: string;
      iconSvgUri?: string;
    };
  };
  quantity: number;
  condition: string;
  language: string;
  isFoil: boolean;
  isSigned: boolean;
  isAltered: boolean;
  askingPrice?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesStats {
  totalItems: number;
  totalCards: number;
  totalValue: number;
  withPrice: number;
  withoutPrice: number;
  byCondition: Record<string, number>;
  byLanguage: Record<string, number>;
}

export interface AddToSaleData {
  cardId: string;
  quantity?: number;
  quantityFoil?: number;
  condition?: string;
  language?: string;
  isSigned?: boolean;
  isAltered?: boolean;
  askingPrice?: number;
  askingPriceFoil?: number;
  notes?: string;
}

export interface UpdateSaleData {
  quantity?: number;
  quantityFoil?: number;
  condition?: string;
  language?: string;
  isSigned?: boolean;
  isAltered?: boolean;
  askingPrice?: number | null;
  askingPriceFoil?: number | null;
  notes?: string | null;
}

// Conditions Cardmarket avec labels
export const CARDMARKET_CONDITIONS = [
  { value: 'MT', label: 'Mint', short: 'MT' },
  { value: 'NM', label: 'Near Mint', short: 'NM' },
  { value: 'EX', label: 'Excellent', short: 'EX' },
  { value: 'GD', label: 'Good', short: 'GD' },
  { value: 'LP', label: 'Light Played', short: 'LP' },
  { value: 'PL', label: 'Played', short: 'PL' },
  { value: 'PO', label: 'Poor', short: 'PO' },
] as const;

// Langues supportées avec labels
export const LANGUAGES = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
  { value: 'it', label: 'Italiano', flag: '🇮🇹' },
  { value: 'pt', label: 'Português', flag: '🇵🇹' },
  { value: 'ja', label: '日本語', flag: '🇯🇵' },
  { value: 'ko', label: '한국어', flag: '🇰🇷' },
  { value: 'ru', label: 'Русский', flag: '🇷🇺' },
  { value: 'zhs', label: '简体中文', flag: '🇨🇳' },
  { value: 'zht', label: '繁體中文', flag: '🇹🇼' },
] as const;

class SalesService {
  /**
   * Récupérer la liste des cartes à vendre
   */
  async getSales(): Promise<{ items: SaleItem[]; stats: { totalItems: number; totalCards: number; totalValue: number } }> {
    const response = await api.get('/sales');
    return response.data;
  }

  /**
   * Récupérer les statistiques de vente
   */
  async getStats(): Promise<SalesStats> {
    const response = await api.get('/sales/stats');
    return response.data;
  }

  /**
   * Ajouter une carte à la liste de vente
   */
  async addToSale(data: AddToSaleData): Promise<{ message: string; item: SaleItem }> {
    const response = await api.post('/sales', data);
    return response.data;
  }

  /**
   * Ajouter plusieurs cartes à la liste de vente
   */
  async bulkAddToSale(items: AddToSaleData[]): Promise<{ message: string; created: number; updated: number }> {
    const response = await api.post('/sales/bulk', { items });
    return response.data;
  }

  /**
   * Mettre à jour un item de vente
   */
  async updateSale(id: string, data: UpdateSaleData): Promise<{ message: string; item: SaleItem }> {
    const response = await api.patch(`/sales/${id}`, data);
    return response.data;
  }

  /**
   * Supprimer un item de vente
   */
  async deleteSale(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/sales/${id}`);
    return response.data;
  }

  /**
   * Exporter au format CSV Cardmarket
   */
  async exportCardmarket(): Promise<Blob> {
    const response = await api.get('/sales/export/cardmarket', {
      responseType: 'blob',
    });
    return response.data;
  }

  /**
   * Télécharger le fichier CSV
   */
  async downloadCardmarketCsv(): Promise<void> {
    const blob = await this.exportCardmarket();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `magicodex-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

export const salesService = new SalesService();
