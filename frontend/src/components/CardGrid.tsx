import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid, List, Filter, Search } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CardDisplay from './CardDisplay';
import LoadingSpinner from './LoadingSpinner';
import { collectionService, setsService } from '../services/collection';
import type { Card, UserCard } from '../types';
import { FixedSizeList as VList } from 'react-window';
import type { ListChildComponentProps } from 'react-window';
import toast from 'react-hot-toast';

interface CardGridProps {
  cards?: Card[];
  userCards?: UserCard[];
  forSaleData?: Record<string, { quantity: number; quantityFoil: number }>;
  loading?: boolean;
  viewMode?: 'grid' | 'list';
  showFilters?: boolean;
  onAddToCollection?: (cardId: string, quantity: number, foil?: boolean, language?: string) => void;
  onUpdateQuantity?: (cardId: string, newQuantity: number, newQuantityFoil: number, language?: string) => void;
  onAddToSale?: (cardId: string) => void;
  onOpenAddModal?: (card: Card) => void;
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  onFilterChange?: (filters: any) => void;
}

const CardGrid = ({
  cards = [],
  userCards = [],
  forSaleData = {},
  loading = false,
  viewMode = 'grid',
  showFilters = false,
  onAddToCollection,
  onUpdateQuantity,
  onAddToSale,
  onOpenAddModal,
  onViewModeChange,
  onFilterChange
}: CardGridProps) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRarity, setSelectedRarity] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSet, setSelectedSet] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(false);

  // Récupération des extensions (seulement si on n'a pas de userCards)
  const { data: setsData } = useQuery({
    queryKey: ['sets'],
    queryFn: () => setsService.getSets(1, 100),
    enabled: userCards.length === 0, // Ne charger que si on utilise des cartes génériques
  });

  // Créer un map des cartes utilisateur pour un accès rapide
  // Grouper par cardId pour supporter plusieurs langues
  const userCardMap = new Map<string, UserCard>();
  const userCardsByCardId = new Map<string, UserCard[]>();
  
  userCards.forEach(uc => {
    // Pour la compatibilité, garder une entrée par cardId (la première trouvée)
    if (!userCardMap.has(uc.cardId)) {
      userCardMap.set(uc.cardId, uc);
    }
    // Regrouper toutes les entrées par cardId (pour les différentes langues)
    const existing = userCardsByCardId.get(uc.cardId) || [];
    existing.push(uc);
    userCardsByCardId.set(uc.cardId, existing);
  });

  // Déterminer la liste des cartes à filtrer
  // Si on a des userCards, utiliser les cartes de la collection avec leurs relations
  // Sinon, utiliser les cartes passées directement
  // Pour éviter les doublons (même cardId avec différentes langues), utiliser un Set
  const allCards = userCards.length > 0 
    ? Array.from(new Map(userCards.map((uc: any) => [uc.cardId, uc.card])).values())
    : cards;

  // Extraire les extensions uniques de la collection utilisateur
  const uniqueSets = userCards.length > 0 
    ? Array.from(new Map(
        userCards
          .map((uc: any) => uc.card?.set)
          .filter(set => set) // Filtrer les sets null/undefined
          .map(set => [set.id, set]) // Créer des paires [id, set]
      ).values()) // Récupérer les valeurs uniques
    : setsData?.sets || [];

  // Filtrer les cartes
  const filteredCards = allCards.filter(card => {
    // Recherche par nom
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = (card.name?.toLowerCase() || '').includes(query) ||
                         (card.nameFr?.toLowerCase() || '').includes(query);
      const matchesType = (card.typeLine?.toLowerCase() || '').includes(query) ||
                         (card.typeLineFr?.toLowerCase() || '').includes(query);
      if (!matchesName && !matchesType) return false;
    }

    // Filtre par rareté
    if (selectedRarity && card.rarity !== selectedRarity) {
      return false;
    }

    // Filtre par extension
    if (selectedSet && card.set?.id !== selectedSet) {
      return false;
    }

    // Filtre par couleurs
    if (selectedColors.length > 0) {
      let cardColors: string[] = [];
      const raw = (card as any).colorIdentity;
      if (Array.isArray(raw)) {
        cardColors = raw;
      } else if (typeof raw === 'string') {
        let parsed: any;
        try { parsed = JSON.parse(raw); } catch {}
        if (Array.isArray(parsed)) cardColors = parsed as string[];
        else if (typeof parsed === 'string') cardColors = parsed.split('').filter(ch => 'WUBRG'.includes(ch));
        else if (!parsed) cardColors = raw.split('').filter(ch => 'WUBRG'.includes(ch));
      }
      cardColors = Array.from(new Set(cardColors));
      if (cardColors.length && !selectedColors.some(color => cardColors.includes(color))) return false;
    }

    // Filtre cartes possédées seulement
    if (ownedOnly) {
      const userCard = userCardMap.get(card.id);
      if (!userCard || (userCard.quantity <= 0 && userCard.quantityFoil <= 0)) {
        return false;
      }
    }

    return true;
  });

  const colors = [
    { symbol: 'W', name: 'Blanc', color: 'bg-yellow-100 border-yellow-300' },
    { symbol: 'U', name: 'Bleu', color: 'bg-blue-100 border-blue-300' },
    { symbol: 'B', name: 'Noir', color: 'bg-gray-100 border-gray-300' },
    { symbol: 'R', name: 'Rouge', color: 'bg-red-100 border-red-300' },
    { symbol: 'G', name: 'Vert', color: 'bg-green-100 border-green-300' }
  ];

  const rarities = [
    { value: 'common', name: 'Commune' },
    { value: 'uncommon', name: 'Inhabituelle' },
    { value: 'rare', name: 'Rare' },
    { value: 'mythic', name: 'Mythique' }
  ];

  const toggleColor = (colorSymbol: string) => {
    setSelectedColors(prev => 
      prev.includes(colorSymbol)
        ? prev.filter(c => c !== colorSymbol)
        : [...prev, colorSymbol]
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const listContainerRef = useRef<HTMLDivElement>(null);
  const listHeight = 600; // px
  const rowHeight = 84; // approx height of CardDisplay in list mode

  const Row = ({ index, style }: ListChildComponentProps) => {
    const card = filteredCards[index];
    return (
      <div style={style}>
        <CardDisplay
          key={card.id}
          card={card}
          userCard={userCardMap.get(card.id)}
          userCardsByLang={userCardsByCardId.get(card.id)}
          forSaleQuantity={forSaleData[card.id]}
          viewMode={viewMode}
          onAddToCollection={onAddToCollection}
          onUpdateQuantity={onUpdateQuantity}
          onAddToSale={onAddToSale}
          onOpenAddModal={onOpenAddModal}
          onToggleListItem={async (cardId, type) => {
            try {
              const existing = listsData?.find((li: any) => li.cardId === cardId && li.type === type);
              if (existing) {
                await collectionService.deleteListItem(existing.id);
                toast.success(type === 'WISHLIST' ? 'Retiré de la Wishlist' : 'Retiré de la Trade list');
              } else {
                await collectionService.upsertListItem(cardId, type, 1);
                toast.success(type === 'WISHLIST' ? 'Ajouté à la Wishlist' : 'Ajouté à la Trade list');
              }
              queryClient.invalidateQueries({ queryKey: ['lists'] });
            } catch (e) {
              toast.error('Action liste échouée');
            }
            return null;
          }}
        />
      </div>
    );
  };

  // Load list items for quick toggle state
  const { data: listsData } = useQuery({
    queryKey: ['lists'],
    queryFn: () => collectionService.getListItems()
  });

  return (
    <div className="space-y-6">
      {/* Barre d'outils */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Recherche */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Rechercher des cartes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>

        {/* Contrôles de vue */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange?.('grid')}
              className={`p-2 rounded ${
                viewMode === 'grid' 
                  ? 'bg-mtg-gold text-black' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewModeChange?.('list')}
              className={`p-2 rounded ${
                viewMode === 'list' 
                  ? 'bg-mtg-gold text-black' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => onFilterChange?.({ showFilters: !showFilters })}
            className={`btn-outline flex items-center gap-2 ${
              showFilters ? 'bg-mtg-gold text-black' : ''
            }`}
          >
            <Filter className="h-4 w-4" />
            Filtres
          </button>
        </div>
      </div>

      {/* Panneau de filtres */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Filtre par extension */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Extension
                </label>
                <select
                  value={selectedSet}
                  onChange={(e) => setSelectedSet(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Toutes les extensions</option>
                  {uniqueSets.map((set: any) => (
                    <option key={set.id} value={set.id}>
                      {set.nameFr || set.name} ({set.code.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtre par rareté */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rareté
                </label>
                <select
                  value={selectedRarity}
                  onChange={(e) => setSelectedRarity(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Toutes les raretés</option>
                  {rarities.map(rarity => (
                    <option key={rarity.value} value={rarity.value}>
                      {rarity.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtre par couleurs */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Couleurs
                </label>
                <div className="flex gap-2">
                  {colors.map(color => (
                    <button
                      key={color.symbol}
                      onClick={() => toggleColor(color.symbol)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                        selectedColors.includes(color.symbol)
                          ? `${color.color} ring-2 ring-mtg-gold`
                          : `${color.color} opacity-50 hover:opacity-100`
                      }`}
                      title={color.name}
                    >
                      {color.symbol}
                    </button>
                  ))}
                </div>
              </div>

              {/* Autres filtres */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Autres
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={ownedOnly}
                    onChange={(e) => setOwnedOnly(e.target.checked)}
                    className="checkbox"
                  />
                  <span className="text-sm text-gray-300">
                    Cartes possédées uniquement
                  </span>
                </label>
              </div>
            </div>

            {/* Bouton de réinitialisation */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedRarity('');
                  setSelectedSet('');
                  setSelectedColors([]);
                  setOwnedOnly(false);
                }}
                className="btn-outline text-sm"
              >
                Réinitialiser les filtres
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Statistiques */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>
          {filteredCards.length} carte{filteredCards.length !== 1 ? 's' : ''} affichée{filteredCards.length !== 1 ? 's' : ''}
          {filteredCards.length !== allCards.length && ` sur ${allCards.length} total`}
        </span>
        
        {userCards.length > 0 && (
          <span>
            {userCards.reduce((sum, uc) => sum + uc.quantity + uc.quantityFoil, 0)} carte{userCards.reduce((sum, uc) => sum + uc.quantity + uc.quantityFoil, 0) !== 1 ? 's' : ''} dans la collection
          </span>
        )}
      </div>

      {/* Grille de cartes */}
      {filteredCards.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Aucune carte trouvée</p>
            <p className="text-sm">
              Essayez de modifier vos critères de recherche ou filtres
            </p>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <motion.div
          layout
          className={'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4'}
        >
          <AnimatePresence>
            {filteredCards.map((card) => (
              <CardDisplay
                key={card.id}
                card={card}
                userCard={userCardMap.get(card.id)}
                userCardsByLang={userCardsByCardId.get(card.id)}
                forSaleQuantity={forSaleData[card.id]}
                viewMode={viewMode}
                onAddToCollection={onAddToCollection}
                onUpdateQuantity={onUpdateQuantity}
                onAddToSale={onAddToSale}
                onOpenAddModal={onOpenAddModal}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div ref={listContainerRef} className="rounded-lg border border-gray-700">
          <VList
            height={listHeight}
            itemCount={filteredCards.length}
            itemSize={rowHeight}
            width={'100%'}
          >
            {Row}
          </VList>
        </div>
      )}
    </div>
  );
};

export default CardGrid;
