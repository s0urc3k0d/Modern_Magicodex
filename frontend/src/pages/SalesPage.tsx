import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, Download, Trash2, Edit, 
  Package, Euro, AlertCircle, Search,
  ChevronDown, ChevronUp, Filter, X, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

import { 
  salesService, 
  CARDMARKET_CONDITIONS, 
  LANGUAGES,
} from '../services/sales';
import type { SaleItem, UpdateSaleData } from '../services/sales';
import LoadingSpinner from '../components/LoadingSpinner';

// Modal d'édition d'un item de vente
const EditSaleModal = ({ 
  item, 
  onClose, 
  onSave 
}: { 
  item: SaleItem; 
  onClose: () => void; 
  onSave: (id: string, data: UpdateSaleData) => void;
}) => {
  const [quantity, setQuantity] = useState(item.quantity);
  const [condition, setCondition] = useState(item.condition);
  const [language, setLanguage] = useState(item.language);
  const [isSigned, setIsSigned] = useState(item.isSigned);
  const [isAltered, setIsAltered] = useState(item.isAltered);
  const [askingPrice, setAskingPrice] = useState(item.askingPrice?.toString() || '');
  const [notes, setNotes] = useState(item.notes || '');

  const handleSave = () => {
    onSave(item.id, {
      quantity,
      condition,
      language,
      isSigned,
      isAltered,
      askingPrice: askingPrice ? parseFloat(askingPrice) : null,
      notes: notes || null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-mtg-surface rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-700"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Modifier l'article</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Carte preview */}
          <div className="flex gap-4 mb-6 p-4 bg-mtg-background rounded-lg">
            {item.card.imageUris?.small && (
              <img 
                src={item.card.imageUris.small} 
                alt={item.card.name}
                className="w-16 h-auto rounded"
              />
            )}
            <div>
              <h3 className="font-bold text-white">{item.card.nameFr || item.card.name}</h3>
              <p className="text-sm text-gray-400">
                {item.card.set.code.toUpperCase()} #{item.card.collectorNumber}
              </p>
              {item.card.priceEur && (
                <p className="text-sm text-mtg-gold mt-1">
                  Prix marché: {item.card.priceEur.toFixed(2)}€
                </p>
              )}
            </div>
          </div>

          {/* Formulaire */}
          <div className="space-y-4">
            {/* Quantité */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Quantité
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="input w-full"
              />
            </div>

            {/* Condition */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                État
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="input w-full"
              >
                {CARDMARKET_CONDITIONS.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.short} - {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Langue */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Langue
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="input w-full"
              >
                {LANGUAGES.map(l => (
                  <option key={l.value} value={l.value}>
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Checkboxes */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.isFoil}
                  disabled
                  className="w-4 h-4"
                />
                <span className="text-gray-300">Foil</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSigned}
                  onChange={(e) => setIsSigned(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-gray-300">Signée</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAltered}
                  onChange={(e) => setIsAltered(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-gray-300">Altérée</span>
              </label>
            </div>

            {/* Prix demandé */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Prix demandé (€)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={askingPrice}
                  onChange={(e) => setAskingPrice(e.target.value)}
                  placeholder="Ex: 1.50"
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    const marketPrice = item.isFoil 
                      ? (item.card.priceEurFoil || item.card.priceEur)
                      : item.card.priceEur;
                    if (marketPrice) {
                      setAskingPrice(marketPrice.toFixed(2));
                    }
                  }}
                  disabled={!item.card.priceEur && !item.card.priceEurFoil}
                  className="btn-outline px-3 flex items-center gap-1 whitespace-nowrap"
                  title="Utiliser le prix du marché"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sync marché
                </button>
              </div>
              {(item.isFoil ? item.card.priceEurFoil : item.card.priceEur) && (
                <p className="text-xs text-gray-500 mt-1">
                  Prix marché {item.isFoil ? 'foil' : ''}: {(item.isFoil ? (item.card.priceEurFoil || item.card.priceEur) : item.card.priceEur)?.toFixed(2)}€
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Notes / Commentaires
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Commentaires pour l'acheteur..."
                rows={3}
                className="input w-full resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="btn-secondary flex-1">
              Annuler
            </button>
            <button onClick={handleSave} className="btn-primary flex-1">
              Enregistrer
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Composant carte de vente
const SaleCard = ({ 
  item, 
  onEdit, 
  onDelete 
}: { 
  item: SaleItem; 
  onEdit: () => void; 
  onDelete: () => void;
}) => {
  const conditionLabel = CARDMARKET_CONDITIONS.find(c => c.value === item.condition)?.label || item.condition;
  const languageInfo = LANGUAGES.find(l => l.value === item.language);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-mtg-surface rounded-lg overflow-hidden border border-gray-700 hover:border-mtg-primary transition-colors"
    >
      <div className="flex">
        {/* Image */}
        <div className="w-24 flex-shrink-0">
          {item.card.imageUris?.small ? (
            <img 
              src={item.card.imageUris.small} 
              alt={item.card.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <Package className="w-8 h-8 text-gray-600" />
            </div>
          )}
        </div>

        {/* Infos */}
        <div className="flex-1 p-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-white text-sm">
                {item.card.nameFr || item.card.name}
                {item.isFoil && <span className="ml-2 text-xs text-yellow-400">✨ Foil</span>}
              </h3>
              <p className="text-xs text-gray-400">
                {item.card.set.code.toUpperCase()} #{item.card.collectorNumber}
              </p>
            </div>
            <div className="flex gap-1">
              <button 
                onClick={onEdit}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                title="Modifier"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button 
                onClick={onDelete}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Détails */}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
              x{item.quantity}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
              {conditionLabel}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
              {languageInfo?.flag} {languageInfo?.label}
            </span>
            {item.isSigned && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-900 text-purple-300">
                Signée
              </span>
            )}
            {item.isAltered && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-orange-900 text-orange-300">
                Altérée
              </span>
            )}
          </div>

          {/* Prix */}
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs text-gray-500">
              Marché: {(item.isFoil ? (item.card.priceEurFoil || item.card.priceEur) : item.card.priceEur)?.toFixed(2) || '?'}€
            </div>
            <div className="font-bold text-mtg-gold">
              {item.askingPrice ? `${item.askingPrice.toFixed(2)}€` : 'Prix non défini'}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Page principale
const SalesPage = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<SaleItem | null>(null);
  const [filterCondition, setFilterCondition] = useState<string>('');
  const [filterLanguage, setFilterLanguage] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Queries
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => salesService.getSales(),
  });

  const { data: stats } = useQuery({
    queryKey: ['sales-stats'],
    queryFn: () => salesService.getStats(),
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSaleData }) => 
      salesService.updateSale(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales-stats'] });
      toast.success('Article mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salesService.deleteSale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales-stats'] });
      toast.success('Article supprimé');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const syncPricesMutation = useMutation({
    mutationFn: () => salesService.syncMarketPrices(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales-stats'] });
      toast.success(`${data.updated} prix synchronisés`);
    },
    onError: () => toast.error('Erreur lors de la synchronisation'),
  });

  // Handlers
  const handleExport = async () => {
    try {
      await salesService.downloadCardmarketCsv();
      toast.success('Export téléchargé !');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Supprimer cet article de la liste de vente ?')) {
      deleteMutation.mutate(id);
    }
  };

  // Filtrage
  const filteredItems = salesData?.items.filter(item => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = item.card.name.toLowerCase().includes(query) ||
        item.card.nameFr?.toLowerCase().includes(query);
      const matchesSet = item.card.set.code.toLowerCase().includes(query) ||
        item.card.set.name.toLowerCase().includes(query);
      if (!matchesName && !matchesSet) return false;
    }
    if (filterCondition && item.condition !== filterCondition) return false;
    if (filterLanguage && item.language !== filterLanguage) return false;
    return true;
  }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-mtg-primary" />
            Mes Ventes
          </h1>
          <p className="text-gray-400 mt-1">
            Gérez vos cartes à vendre et exportez vers Cardmarket
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => syncPricesMutation.mutate()}
            disabled={!salesData?.items.length || syncPricesMutation.isPending}
            className="btn-outline flex items-center gap-2"
            title="Synchroniser tous les prix avec le marché"
          >
            <RefreshCw className={`w-5 h-5 ${syncPricesMutation.isPending ? 'animate-spin' : ''}`} />
            Sync prix marché
          </button>
          <button
            onClick={handleExport}
            disabled={!salesData?.items.length}
            className="btn-primary flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Exporter CSV Cardmarket
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-mtg-surface rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mtg-primary/20 rounded-lg">
              <Package className="w-6 h-6 text-mtg-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Articles</p>
              <p className="text-2xl font-bold text-white">{stats?.totalItems || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-mtg-surface rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mtg-primary/20 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-mtg-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Cartes totales</p>
              <p className="text-2xl font-bold text-white">{stats?.totalCards || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-mtg-surface rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mtg-gold/20 rounded-lg">
              <Euro className="w-6 h-6 text-mtg-gold" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Valeur totale</p>
              <p className="text-2xl font-bold text-mtg-gold">
                {(stats?.totalValue || 0).toFixed(2)}€
              </p>
            </div>
          </div>
        </div>
        <div className="bg-mtg-surface rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-600/20 rounded-lg">
              <AlertCircle className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Sans prix</p>
              <p className="text-2xl font-bold text-white">{stats?.withoutPrice || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-mtg-surface rounded-lg p-4 mb-6 border border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou set..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full pl-10"
            />
          </div>

          {/* Toggle filtres */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-outline flex items-center gap-2"
          >
            <Filter className="w-5 h-5" />
            Filtres
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Filtres avancés */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-700">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">État</label>
                  <select
                    value={filterCondition}
                    onChange={(e) => setFilterCondition(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Tous les états</option>
                    {CARDMARKET_CONDITIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Langue</label>
                  <select
                    value={filterLanguage}
                    onChange={(e) => setFilterLanguage(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Toutes les langues</option>
                    {LANGUAGES.map(l => (
                      <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setFilterCondition('');
                      setFilterLanguage('');
                      setSearchQuery('');
                    }}
                    className="btn-secondary w-full"
                  >
                    Réinitialiser
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Liste des articles */}
      {filteredItems.length === 0 ? (
        <div className="bg-mtg-surface rounded-lg p-12 text-center border border-gray-700">
          <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">
            {salesData?.items.length ? 'Aucun résultat' : 'Liste de vente vide'}
          </h3>
          <p className="text-gray-400 max-w-md mx-auto">
            {salesData?.items.length 
              ? 'Modifiez vos filtres pour voir plus de résultats.'
              : 'Ajoutez des cartes à vendre depuis votre collection en cliquant sur "Vendre" sur une carte.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredItems.map(item => (
              <SaleCard
                key={item.id}
                item={item}
                onEdit={() => setEditingItem(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal d'édition */}
      <AnimatePresence>
        {editingItem && (
          <EditSaleModal
            item={editingItem}
            onClose={() => setEditingItem(null)}
            onSave={(id, data) => updateMutation.mutate({ id, data })}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SalesPage;
