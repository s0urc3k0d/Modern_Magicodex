import { useState, useEffect } from 'react';
import { FixedSizeList as VList } from 'react-window';
import type { ListChildComponentProps } from 'react-window';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Search, Plus, Minus, Star, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cardsService } from '../services/collection';
import { isExtraSafe, sortByCollector } from '../domain/cards/normalize';
import { collectionService } from '../services/collection';
import LoadingSpinner from './LoadingSpinner';
// import { ManaCost } from './ManaSymbol';
import toast from 'react-hot-toast';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddCardModal = ({ isOpen, onClose }: AddCardModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCards, setSelectedCards] = useState<any[]>([]);
  const queryClient = useQueryClient();

  // Bloquer le défilement de l'arrière-plan quand la modale est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup au démontage
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Recherche de cartes
  const { data: cardsData, isLoading: cardsLoading } = useQuery({
    queryKey: ['cards-search', searchQuery],
    queryFn: async () => {
      // Prefer FTS for plain text search
      const res = await cardsService.getCardsFts(searchQuery, 50);
      return { cards: res.cards } as any;
    },
    enabled: !!searchQuery && searchQuery.length > 1,
  });

  // Mutation pour ajouter les cartes à la collection
  const addCardsMutation = useMutation({
    mutationFn: async (cards: any[]) => {
      // Transform selected cards into bulk payload items
      const items = cards.map(c => ({
        cardId: c.cardId,
        quantity: c.isFoil ? 0 : c.quantity, // normal quantity
        quantityFoil: c.isFoil ? c.quantity : 0
      }));
      return collectionService.addCardsBulk(items, 'increment');
    },
    onSuccess: (result: any) => {
      const summary = result?.summary;
      toast.success(`Ajout terminé: ${summary?.created ?? 0} créées, ${summary?.updated ?? 0} mises à jour`);
      queryClient.invalidateQueries({ queryKey: ['collection'] });
      queryClient.invalidateQueries({ queryKey: ['collection-stats'] });
  queryClient.invalidateQueries({ predicate: (q: any) => Array.isArray(q.queryKey) && q.queryKey[0] === 'deck-owned' });
      setSelectedCards([]);
      onClose();
    },
    onError: (error: any) => {
      if (error?.response?.status === 429) {
        toast.error('Trop de requêtes: veuillez patienter quelques secondes.');
      } else if (error?.message === 'Network Error') {
        toast.error('Réseau indisponible ou serveur injoignable');
      } else {
        toast.error('Erreur lors de l\'ajout des cartes');
      }
    },
  });

  const handleAddCard = (card: any) => {
    const existingCard = selectedCards.find(c => c.cardId === card.id);
    if (existingCard) {
      setSelectedCards(selectedCards.map(c => 
        c.cardId === card.id 
          ? { ...c, quantity: c.quantity + 1 }
          : c
      ));
    } else {
      setSelectedCards([...selectedCards, { 
        cardId: card.id, 
        card, 
        quantity: 1, 
        isFoil: false 
      }]);
    }
  };

  const handleRemoveCard = (cardId: string) => {
    setSelectedCards(selectedCards.filter(c => c.cardId !== cardId));
  };

  const updateCardQuantity = (cardId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveCard(cardId);
    } else {
      setSelectedCards(selectedCards.map(c => 
        c.cardId === cardId 
          ? { ...c, quantity: newQuantity }
          : c
      ));
    }
  };

  const toggleFoil = (cardId: string) => {
    setSelectedCards(selectedCards.map(c => 
      c.cardId === cardId 
        ? { ...c, isFoil: !c.isFoil }
        : c
    ));
  };

  const handleSubmit = () => {
    if (selectedCards.length === 0) return;
    addCardsMutation.mutate(selectedCards);
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'common': return 'text-gray-400';
      case 'uncommon': return 'text-gray-300';
      case 'rare': return 'text-mtg-primary';
      case 'mythic': return 'text-mtg-secondary';
      default: return 'text-gray-400';
    }
  };

  const getRarityIcon = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'mythic': return <Star className="w-3 h-3 fill-current" />;
      default: return <div className="w-3 h-3 rounded-full border border-current" />;
    }
  };

  // Sort results by set, then standard vs extras (standard first), then collector number
  const sortedCards: any[] = (cardsData?.cards || []).slice().sort((a: any, b: any) => {
    const setA = (a.set?.code || a.set?.name || '').toString().toUpperCase();
    const setB = (b.set?.code || b.set?.name || '').toString().toUpperCase();
    const sc = setA.localeCompare(setB);
    if (sc !== 0) return sc;
    const xa = isExtraSafe(a) ? 1 : 0; // 0 standard, 1 extra
    const xb = isExtraSafe(b) ? 1 : 0;
    if (xa !== xb) return xa - xb;
    return (sortByCollector([a, b]) as any)[0] === a ? -1 : 1;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-mtg-surface rounded-xl border border-gray-700 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">
                Ajouter des cartes à votre collection
              </h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 min-h-0">
              {/* Panel de recherche */}
              <div className="flex-1 p-6 border-r border-gray-700 flex flex-col">
                <div className="mb-6 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Rechercher des cartes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-mtg-background border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-mtg-primary focus:outline-none transition-colors"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        aria-label="Effacer la recherche"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    Tapez au moins 2 caractères pour rechercher
                  </p>
                </div>

                {/* Résultats de recherche */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {cardsLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-16 bg-gray-800 animate-pulse rounded-lg" />
                      ))}
                    </div>
                  ) : sortedCards.length > 0 ? (
                    <VList
                      height={480}
                      itemCount={sortedCards.length}
                      itemSize={72}
                      width={"100%"}
                    >
                      {({ index, style }: ListChildComponentProps) => {
                        const card = sortedCards[index];
                        return (
                          <div style={style} key={card.id} className="px-0.5">
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-3 p-3 bg-mtg-background rounded-lg hover:bg-gray-700 transition-colors group h-full"
                            >
                              {(() => {
                                const imageUris = typeof card.imageUris === 'string' 
                                  ? JSON.parse(card.imageUris) 
                                  : card.imageUris;
                                return imageUris?.small ? (
                                  <img
                                    src={imageUris.small}
                                    alt={card.name}
                                    className="w-12 h-16 rounded object-cover"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <div className="w-12 h-16 rounded bg-gray-800" />
                                );
                              })()}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-white truncate">
                                  {card.nameFr || card.name}
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-400">
                                    {card.set?.nameFr || card.set?.name}
                                  </span>
                                  {isExtraSafe(card) && (
                                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-700 text-gray-300 uppercase tracking-wide">
                                      Extra
                                    </span>
                                  )}
                                  <div className={`flex items-center gap-1 ${getRarityColor(card.rarity)}`}>
                                    {getRarityIcon(card.rarity)}
                                    <span className="capitalize">{card.rarity}</span>
                                  </div>
                                </div>
                                {(card.typeLineFr || card.typeLine) && (
                                  <div className="text-xs text-gray-400 mt-1 truncate">
                                    {card.typeLineFr || card.typeLine}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleAddCard(card)}
                                className="p-2 bg-mtg-primary text-mtg-black rounded-lg hover:bg-opacity-90 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </motion.div>
                          </div>
                        );
                      }}
                    </VList>
                  ) : searchQuery.length > 2 ? (
                    <div className="text-center py-8 text-gray-400">
                      Aucune carte trouvée pour "{searchQuery}"
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      Commencez à taper pour rechercher des cartes
                    </div>
                  )}
                </div>
              </div>

              {/* Panel des cartes sélectionnées */}
              <div className="w-full lg:w-80 p-6 bg-mtg-background">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Cartes sélectionnées ({selectedCards.length})
                </h3>

                <div className="space-y-3 overflow-y-auto max-h-80 mb-6">
                  {selectedCards.map((selectedCard) => (
                    <motion.div
                      key={selectedCard.cardId}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 p-3 bg-mtg-surface rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {selectedCard.card.nameFr || selectedCard.card.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => toggleFoil(selectedCard.cardId)}
                            className={`p-1 rounded transition-colors ${
                              selectedCard.isFoil 
                                ? 'bg-mtg-primary text-mtg-black' 
                                : 'bg-gray-700 text-gray-400 hover:text-white'
                            }`}
                            title={selectedCard.isFoil ? 'Foil' : 'Normal'}
                          >
                            <Sparkles className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCardQuantity(selectedCard.cardId, selectedCard.quantity - 1)}
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-white font-medium min-w-[2rem] text-center">
                          {selectedCard.quantity}
                        </span>
                        <button
                          onClick={() => updateCardQuantity(selectedCard.cardId, selectedCard.quantity + 1)}
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {selectedCards.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      Aucune carte sélectionnée
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <button
                    onClick={handleSubmit}
                    disabled={selectedCards.length === 0 || addCardsMutation.isPending}
                    className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {addCardsMutation.isPending ? (
                      <>
                        <LoadingSpinner />
                        <span className="ml-2">Ajout en cours...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter à la collection ({selectedCards.reduce((sum, card) => sum + card.quantity, 0)})
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={onClose}
                    className="w-full btn-outline"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddCardModal;
