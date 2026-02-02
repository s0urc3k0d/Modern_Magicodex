import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Grid, List, Package, Layers, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collectionService } from '../services/collection';
import { salesService } from '../services/sales';
import LoadingSpinner from '../components/LoadingSpinner';
import AddCardModal from '../components/AddCardModal';
import BulkAddBySetModal from '../components/BulkAddBySetModal';
import AddToSaleModal from '../components/AddToSaleModal';
import AddToCollectionModal from '../components/AddToCollectionModal';
import CardGrid from '../components/CardGrid';
import CollectionBySet from '../components/CollectionBySet';
import toast from 'react-hot-toast';
import type { Card, UserCard } from '../types';

const CollectionPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [groupBySet, setGroupBySet] = useState(true); // Nouveau: grouper par extension
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkSetModal, setShowBulkSetModal] = useState(false);
  const [saleModalData, setSaleModalData] = useState<{ card: Card; userCard: UserCard } | null>(null);
  const [addCollectionModalCard, setAddCollectionModalCard] = useState<Card | null>(null);
  // Advanced filters
  const [rarity, setRarity] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [typeContains, setTypeContains] = useState('');
  const [textContains, setTextContains] = useState('');
  const [textModeAnd, setTextModeAnd] = useState(true); // AND vs OR between words
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [sortBy, setSortBy] = useState<'releasedAt' | 'name' | 'collectorNumber' | 'price'>('releasedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [onlyOwned, setOnlyOwned] = useState<boolean>(false);
  const [onlyExtras, setOnlyExtras] = useState<boolean | undefined>(undefined);
  // Server-side pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(60);
  
  // When groupBySet is active, we need all cards - use a very high limit
  const effectiveLimit = groupBySet ? 10000 : limit;
  const effectivePage = groupBySet ? 1 : page;

  const queryClient = useQueryClient();

  // Récupération des statistiques de collection
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['collection-stats', 'set'], // Grouper par set pour avoir les extensions
    queryFn: () => collectionService.getCollectionStats('set'),
  });

  // Récupération de la collection page par page (serveur applique filtres + tri)
  const { data: collectionData, isLoading: collectionLoading } = useQuery<{ userCards: any[]; pagination?: { totalPages: number; totalItems?: number } }>({
    queryKey: ['collection', effectivePage, effectiveLimit, searchQuery, rarity, colors, typeContains, textContains, textModeAnd, priceMin, priceMax, sortBy, sortOrder, onlyOwned, onlyExtras, groupBySet],
    queryFn: async () => {
      const serverFilters = {
        colors: colors.length ? colors : undefined,
        rarity: rarity || undefined,
        typeContains: typeContains || undefined,
        text: textContains || undefined,
        textMode: textModeAnd ? 'and' as const : 'or' as const,
        minEur: priceMin ? Number(priceMin) : undefined,
        maxEur: priceMax ? Number(priceMax) : undefined,
        hasCard: onlyOwned || undefined,
        extras: typeof onlyExtras === 'boolean' ? onlyExtras : undefined,
        sort: sortBy,
        order: sortOrder,
      };
      return collectionService.getCollection(effectivePage, effectiveLimit, searchQuery, serverFilters);
    },
    placeholderData: (prev) => prev as any,
  });

  // Récupération des cartes en vente (pour afficher les badges)
  const { data: forSaleData } = useQuery({
    queryKey: ['sales-by-cards'],
    queryFn: () => salesService.getSalesByCards(),
  });

  // URL sync for filters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (searchQuery) params.set('q', searchQuery); else params.delete('q');
    if (rarity) params.set('rarity', rarity); else params.delete('rarity');
    if (colors.length) params.set('colors', colors.join(',')); else params.delete('colors');
    if (typeContains) params.set('type', typeContains); else params.delete('type');
    if (textContains) params.set('text', textContains); else params.delete('text');
    params.set('textMode', textModeAnd ? 'and' : 'or');
    if (priceMin) params.set('min', priceMin); else params.delete('min');
    if (priceMax) params.set('max', priceMax); else params.delete('max');
    if (onlyOwned) params.set('owned', '1'); else params.delete('owned');
    if (typeof onlyExtras === 'boolean') params.set('extras', onlyExtras ? '1' : '0'); else params.delete('extras');
    params.set('sort', sortBy);
    params.set('order', sortOrder);
    params.set('page', String(page));
    params.set('limit', String(limit));
    const url = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', url);
  }, [searchQuery, rarity, colors, typeContains, textContains, textModeAnd, priceMin, priceMax, onlyOwned, onlyExtras, sortBy, sortOrder, page, limit]);

  useEffect(() => {
    // Load from URL on mount
    const params = new URLSearchParams(window.location.search);
    setSearchQuery(params.get('q') || '');
    setRarity(params.get('rarity') || '');
    const c = params.get('colors');
    setColors(c ? c.split(',').filter(Boolean) : []);
    setTypeContains(params.get('type') || '');
    setTextContains(params.get('text') || '');
    setTextModeAnd((params.get('textMode') || 'and') === 'and');
    setPriceMin(params.get('min') || '');
    setPriceMax(params.get('max') || '');
    setOnlyOwned((params.get('owned') || '') === '1');
    const extrasParam = params.get('extras');
    setOnlyExtras(extrasParam === '1' ? true : extrasParam === '0' ? false : undefined);
    const s = (params.get('sort') as any) || 'releasedAt';
    const o = (params.get('order') as any) || (s === 'price' || s === 'releasedAt' ? 'desc' : 'asc');
    setSortBy(['releasedAt','name','collectorNumber','price'].includes(s) ? s : 'releasedAt');
    setSortOrder(o === 'asc' ? 'asc' : 'desc');
    const p = parseInt(params.get('page') || '1', 10); setPage(isNaN(p) ? 1 : Math.max(1, p));
    const l = parseInt(params.get('limit') || '60', 10); setLimit([20,40,60,100].includes(l) ? l : 60);
  }, []);

  // Reset page when filters/search change (except page & limit themselves)
  useEffect(() => {
    setPage(1);
  }, [searchQuery, rarity, colors, typeContains, textContains, textModeAnd, priceMin, priceMax, onlyOwned, onlyExtras, sortBy, sortOrder]);

  // Mutations pour gérer la collection
  const addToCollectionMutation = useMutation({
    mutationFn: ({ cardId, quantity, foil, language }: { cardId: string; quantity: number; foil?: boolean; language?: string }) =>
      collectionService.addCard(cardId, quantity, foil, language || 'fr'),
    onSuccess: () => {
      toast.success('Carte ajoutée à votre collection !');
      queryClient.invalidateQueries({ queryKey: ['collection'] });
      queryClient.invalidateQueries({ queryKey: ['collection-stats'] });
      queryClient.invalidateQueries({ predicate: (q: any) => Array.isArray(q.queryKey) && q.queryKey[0] === 'deck-owned' });
    },
    onError: () => {
      toast.error('Erreur lors de l\'ajout de la carte');
    },
  });

  // Mutation pour ajout avec détails (depuis modal)
  const addToCollectionWithDetailsMutation = useMutation({
    mutationFn: (data: { cardId: string; quantity: number; quantityFoil: number; language: string }) =>
      collectionService.addCardWithDetails(data.cardId, data),
    onSuccess: () => {
      toast.success('Carte ajoutée à votre collection !');
      queryClient.invalidateQueries({ queryKey: ['collection'] });
      queryClient.invalidateQueries({ queryKey: ['collection-stats'] });
      queryClient.invalidateQueries({ predicate: (q: any) => Array.isArray(q.queryKey) && q.queryKey[0] === 'deck-owned' });
    },
    onError: () => {
      toast.error('Erreur lors de l\'ajout de la carte');
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: ({ cardId, quantity, quantityFoil, language }: { 
      cardId: string; 
      quantity: number; 
      quantityFoil: number;
      language: string;
    }) => {
      return collectionService.updateCard(cardId, quantity, quantityFoil, language);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection'] });
      queryClient.invalidateQueries({ queryKey: ['collection-stats'] });
  queryClient.invalidateQueries({ predicate: (q: any) => Array.isArray(q.queryKey) && q.queryKey[0] === 'deck-owned' });
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    },
  });

  const handleAddToCollection = (cardId: string, quantity: number, foil = false, language = 'fr') => {
    addToCollectionMutation.mutate({ cardId, quantity, foil, language });
  };

  const handleUpdateQuantity = (cardId: string, newQuantity: number, newQuantityFoil: number, language = 'fr') => {
    updateQuantityMutation.mutate({ 
      cardId, 
      quantity: newQuantity,
      quantityFoil: newQuantityFoil,
      language 
    });
  };

  // Mutation pour ajouter une carte à la liste de vente
  const addToSaleMutation = useMutation({
    mutationFn: (data: {
      cardId: string;
      quantity: number;
      quantityFoil: number;
      condition: string;
      language: string;
      askingPrice?: number;
      askingPriceFoil?: number;
    }) => salesService.addToSale({
      cardId: data.cardId,
      quantity: data.quantity,
      quantityFoil: data.quantityFoil,
      condition: data.condition,
      language: data.language,
      askingPrice: data.askingPrice,
      askingPriceFoil: data.askingPriceFoil,
    }),
    onSuccess: () => {
      toast.success('Carte ajoutée à votre liste de vente !');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales-by-cards'] });
    },
    onError: () => {
      toast.error('Erreur lors de l\'ajout à la vente');
    },
  });

  // Ouvrir la modal de mise en vente
  const handleAddToSale = (cardId: string) => {
    const userCard = collectionData?.userCards?.find((uc: any) => uc.cardId === cardId);
    if (!userCard) {
      toast.error('Carte non trouvée dans votre collection');
      return;
    }
    setSaleModalData({ card: userCard.card, userCard });
  };

  // Confirmer la mise en vente depuis la modal
  const handleConfirmSale = (data: {
    cardId: string;
    quantity: number;
    quantityFoil: number;
    condition: string;
    language: string;
    askingPrice?: number;
    askingPriceFoil?: number;
  }) => {
    addToSaleMutation.mutate(data);
  };

  const isLoading = statsLoading || collectionLoading;

  // Server now handles filters and sorting; use results directly
  const filteredUserCards = useMemo(() => collectionData?.userCards || [], [collectionData?.userCards]);

  const exportCsv = async () => {
    const rows: string[] = [];
    const header = [
      'setCode','setName','cardId','name','nameFr','collectorNumber','rarity','quantity','quantityFoil','priceEur','priceEurFoil'
    ];
    rows.push(header.join(','));
    // Fetch all pages sequentially for full export (indépendant de la pagination affichée)
    const serverFilters = {
      colors: colors.length ? colors : undefined,
      rarity: rarity || undefined,
      typeContains: typeContains || undefined,
      text: textContains || undefined,
      textMode: textModeAnd ? 'and' as const : 'or' as const,
      minEur: priceMin ? Number(priceMin) : undefined,
      maxEur: priceMax ? Number(priceMax) : undefined,
      hasCard: onlyOwned || undefined,
      extras: typeof onlyExtras === 'boolean' ? onlyExtras : undefined,
      sort: sortBy,
      order: sortOrder,
    };
    let current = 1;
    const tempLimit = 100; // maximise pour réduire les requêtes
    let totalPagesLocal = 1;
    do {
      const resp = await collectionService.getCollection(current, tempLimit, searchQuery, serverFilters);
      totalPagesLocal = resp.pagination?.totalPages || 1;
      for (const uc of resp.userCards || []) {
        const c = uc.card || {};
        let prices: any = {};
        try { prices = c.prices ? JSON.parse(c.prices) : {}; } catch {}
        rows.push([
          (c.set?.code || '').toUpperCase(),
          JSON.stringify(c.set?.nameFr || c.set?.name || ''),
          c.id || '',
          JSON.stringify(c.name || ''),
          JSON.stringify(c.nameFr || ''),
          c.collectorNumber || '',
          c.rarity || '',
          String(uc.quantity ?? 0),
          String(uc.quantityFoil ?? 0),
          prices.eur ? String(prices.eur) : '',
          prices.eur_foil ? String(prices.eur_foil) : ''
        ].join(','));
      }
      current += 1;
    } while (current <= totalPagesLocal);
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'collection.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header avec statistiques */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Ma Collection</h1>
          <p className="text-gray-400">
            Gérez et explorez votre collection Magic: The Gathering
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            className="btn-primary flex items-center"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter des cartes
          </button>
          <button 
            className="btn-outline flex items-center"
            onClick={() => setShowBulkSetModal(true)}
            title="Ajout en masse par set"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter par set
          </button>
          <button 
            className="btn-outline flex items-center"
            onClick={exportCsv}
            title="Exporter la collection en CSV"
          >
            <Download className="w-4 h-4 mr-2" />
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Statistiques rapides */}
      {stats && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-mtg-primary mb-1">
              {stats.general?.uniqueCards?.toLocaleString() || 0}
            </div>
            <div className="text-sm text-gray-400">Cartes uniques</div>
          </div>
          
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-mtg-secondary mb-1">
              {((stats.general?.totalCards || 0) + (stats.general?.totalFoils || 0)).toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Cartes totales</div>
          </div>
          
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-mtg-accent mb-1">
              € {stats.general?.totalValue?.toLocaleString('fr-FR', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              }) || '0.00'}
            </div>
            <div className="text-sm text-gray-400">Valeur (EUR)</div>
          </div>
          
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-mtg-green mb-1">
              {stats.grouped?.length || 0}
            </div>
            <div className="text-sm text-gray-400">Extensions</div>
          </div>
        </motion.div>
      )}

      {/* Barre de recherche et contrôles */}
  <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Rechercher dans votre collection..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-mtg-background border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-mtg-primary focus:outline-none transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGroupBySet(!groupBySet)}
              className={`p-2 rounded-lg transition-colors ${
                groupBySet 
                  ? 'bg-mtg-primary text-mtg-black' 
                  : 'bg-mtg-background text-gray-400 hover:text-white'
              }`}
              title={groupBySet ? 'Affichage normal' : 'Grouper par extension'}
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-mtg-primary text-mtg-black' 
                  : 'bg-mtg-background text-gray-400 hover:text-white'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' 
                  ? 'bg-mtg-primary text-mtg-black' 
                  : 'bg-mtg-background text-gray-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Advanced filters panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Rareté</label>
            <select value={rarity} onChange={(e) => setRarity(e.target.value)} className="input w-full">
              <option value="">Toutes</option>
              <option value="common">Commune</option>
              <option value="uncommon">Inhabituelle</option>
              <option value="rare">Rare</option>
              <option value="mythic">Mythique</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Couleurs</label>
            <div className="flex gap-2">
              {['W','U','B','R','G'].map(sym => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setColors(prev => prev.includes(sym) ? prev.filter(c => c!==sym) : [...prev, sym])}
                  className={`w-8 h-8 rounded-full border border-gray-600 ${colors.includes(sym) ? 'bg-mtg-gold text-black' : 'bg-mtg-surface text-gray-300'}`}
                >{sym}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Type contient</label>
            <input value={typeContains} onChange={(e)=>setTypeContains(e.target.value)} className="input w-full" placeholder="ex: Creature" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Texte des règles</label>
            <div className="flex gap-2">
              <input value={textContains} onChange={(e)=>setTextContains(e.target.value)} className="input flex-1" placeholder="mots séparés par espaces" />
              <select value={textModeAnd? 'and':'or'} onChange={(e)=>setTextModeAnd(e.target.value==='and')} className="input w-24">
                <option value="and">AND</option>
                <option value="or">OR</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Prix EUR min</label>
            <input value={priceMin} onChange={(e)=>setPriceMin(e.target.value)} className="input w-full" placeholder="ex: 1.5" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Prix EUR max</label>
            <input value={priceMax} onChange={(e)=>setPriceMax(e.target.value)} className="input w-full" placeholder="ex: 10" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Trier par</label>
            <select value={sortBy} onChange={(e)=>setSortBy(e.target.value as any)} className="input w-full">
              <option value="releasedAt">Date de sortie</option>
              <option value="name">Nom</option>
              <option value="collectorNumber">Numéro collecteur</option>
              <option value="price">Prix (EUR)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Ordre</label>
            <select value={sortOrder} onChange={(e)=>setSortOrder(e.target.value as any)} className="input w-full">
              <option value="asc">Ascendant</option>
              <option value="desc">Descendant</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input id="ownedOnly" type="checkbox" checked={onlyOwned} onChange={(e)=>setOnlyOwned(e.target.checked)} />
            <label htmlFor="ownedOnly" className="text-sm text-gray-300">Afficher seulement les cartes possédées</label>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <select value={typeof onlyExtras === 'boolean' ? (onlyExtras ? 'only' : 'no') : 'all'} onChange={(e)=>{
              const v = e.target.value; setOnlyExtras(v==='only' ? true : v==='no' ? false : undefined);
            }} className="input w-full">
              <option value="all">Toutes les impressions</option>
              <option value="only">Extras/variantes uniquement</option>
              <option value="no">Exclure extras/variantes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contenu de la collection */}
      {/* Barre de pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1 || isLoading}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="btn-outline disabled:opacity-40"
          >Précédent</button>
          <button
            disabled={page >= (collectionData?.pagination?.totalPages || 1) || isLoading}
            onClick={() => setPage(p => p + 1)}
            className="btn-outline disabled:opacity-40"
          >Suivant</button>
          <span className="text-sm text-gray-400">
            Page {page} / {collectionData?.pagination?.totalPages || 1}{' '}
            {(collectionData?.pagination?.totalPages || 1) > 1 && (
              <span className="ml-2 text-xs text-gray-500">{collectionData?.pagination?.totalItems?.toLocaleString?.()} cartes totales</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-300">Cartes / page</label>
          <select
            value={limit}
            onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); }}
            className="input w-24"
          >
            {[20,40,60,100].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
  ) : (collectionData?.userCards?.length || 0) > 0 ? (
        groupBySet ? (
          <CollectionBySet
            userCards={filteredUserCards}
            viewMode={viewMode}
            onUpdateQuantity={handleUpdateQuantity}
            onAddToSale={handleAddToSale}
            onOpenAddModal={setAddCollectionModalCard}
            searchQuery={searchQuery}
            forSaleData={forSaleData || {}}
          />
        ) : (
          <CardGrid
            userCards={filteredUserCards}
            forSaleData={forSaleData || {}}
            viewMode={viewMode}
            showFilters={showFilters}
            onAddToCollection={handleAddToCollection}
            onUpdateQuantity={handleUpdateQuantity}
            onAddToSale={handleAddToSale}
            onOpenAddModal={setAddCollectionModalCard}
            onViewModeChange={setViewMode}
            onFilterChange={() => setShowFilters(!showFilters)}
            // CardGrid will handle wishlist/trade via its internal handler
          />
        )
      ) : (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-mtg-surface rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Votre collection est vide
          </h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Commencez à ajouter des cartes Magic: The Gathering à votre collection personnelle.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter vos premières cartes
          </button>
        </div>
      )}

      {/* Modal d'ajout de cartes */}
      <AddCardModal 
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
      <BulkAddBySetModal
        isOpen={showBulkSetModal}
        onClose={() => setShowBulkSetModal(false)}
      />

      {/* Modal d'ajout avec choix de langue */}
      <AnimatePresence>
        {addCollectionModalCard && (
          <AddToCollectionModal
            card={addCollectionModalCard}
            onClose={() => setAddCollectionModalCard(null)}
            onConfirm={(data) => {
              addToCollectionWithDetailsMutation.mutate(data);
              setAddCollectionModalCard(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Modal de mise en vente */}
      <AnimatePresence>
        {saleModalData && (
          <AddToSaleModal
            card={saleModalData.card}
            userCard={saleModalData.userCard}
            forSaleQuantity={forSaleData?.[saleModalData.card.id]}
            onClose={() => setSaleModalData(null)}
            onConfirm={handleConfirmSale}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollectionPage;
