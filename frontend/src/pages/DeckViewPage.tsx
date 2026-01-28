import { useMemo, useState } from 'react';
import { FixedSizeList as VList } from 'react-window';
import type { ListChildComponentProps } from 'react-window';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, Edit, Copy, Download, Share,
  BarChart3, Target, Eye, Lock, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

import { decksService } from '../services/decks';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import ManaSymbol, { ManaCost } from '../components/ManaSymbol';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const DeckViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<'cards' | 'stats' | 'visual'>('cards');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'owned' | 'unowned'>('all');

  // Récupération du deck
  const { data: deck, isLoading, error } = useQuery({
    queryKey: ['deck', id],
    queryFn: () => decksService.getDeck(id!),
    enabled: !!id,
  });
  
  // Compute oracleIds present in this deck (stable reference for query key)
  const oracleIdsInDeck = useMemo(() => {
    const ids = [
      ...(deck?.mainboard?.map((dc: any) => dc.card?.oracleId).filter(Boolean) || []),
      ...(deck?.sideboard?.map((dc: any) => dc.card?.oracleId).filter(Boolean) || []),
      ...(deck?.maybeboard?.map((dc: any) => dc.card?.oracleId).filter(Boolean) || []),
    ] as string[];
    return Array.from(new Set(ids));
  }, [deck?.mainboard, deck?.sideboard, deck?.maybeboard]);

  // Fetch which deck cards are owned by the user (keyed by oracleIds so it refetches after edits)
  const { data: ownedMap } = useQuery({
    queryKey: ['deck-owned', id, oracleIdsInDeck],
    enabled: oracleIdsInDeck.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const params = new URLSearchParams({ oracleIds: oracleIdsInDeck.join(',') });
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/collection/cards?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const holdings = await res.json();
      const map: Record<string, { quantity: number; quantityFoil: number }> = {};
      holdings.forEach((uc: any) => { map[uc.oracleId] = { quantity: uc.quantity, quantityFoil: uc.quantityFoil }; });
      return map;
    }
  });

  // Ownership filtering helpers
  const filterByOwnership = (cards: any[]) => {
    if (!ownedMap || ownershipFilter === 'all') return cards;
    return cards.filter((dc: any) => {
      const key = dc.card?.oracleId as string | undefined;
      const ownedCount = key ? ((ownedMap[key]?.quantity || 0) + (ownedMap[key]?.quantityFoil || 0)) : 0;
      return ownershipFilter === 'owned' ? ownedCount > 0 : ownedCount === 0;
    });
  };

  const handleDuplicate = async () => {
    if (!id) return;
    try {
  const duplicated = await decksService.duplicateDeck(id);
  toast.success('Deck dupliqué');
  navigate(`/decks/builder/${duplicated.id}`);
    } catch (e) {
      toast.error('Échec de la duplication');
    }
  };

  const handleExport = async () => {
    if (!id) return;
    try {
      const res = await decksService.exportDeckMTGA(id);
      await navigator.clipboard.writeText(res.format || '');
      toast.success('Deck MTGA copié dans le presse-papiers');
    } catch (e) {
      toast.error("Échec de l'export MTGA");
    }
  };

  const getFormatColor = (format: string) => {
    const colorMap: Record<string, string> = {
      'Standard': 'bg-blue-500',
      'Pioneer': 'bg-purple-500',
      'Modern': 'bg-orange-500',
      'Legacy': 'bg-red-500',
      'Vintage': 'bg-yellow-500',
      'Commander': 'bg-green-500',
      'Historic': 'bg-indigo-500',
      'Brawl': 'bg-pink-500',
      'Alchemy': 'bg-teal-500'
    };
    return colorMap[format] || 'bg-gray-500';
  };

  const renderCardList = (cards: any[], title: string) => (
  <div className="card p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <Target className="w-5 h-5 mr-2" />
        {title} ({cards.reduce((sum: number, card: any) => sum + card.quantity, 0)} cartes)
      </h3>
      <div className="space-y-2">
        <VList height={400} itemCount={cards.length} itemSize={80} width={"100%"}>
          {({ index, style }: ListChildComponentProps) => {
            const deckCard = cards[index];
            return (
              <div style={style} key={`${deckCard.cardId}-${deckCard.board}`} className="px-0.5">
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 bg-mtg-surface rounded-lg hover:bg-opacity-80 transition-colors h-full"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <span className="text-sm font-medium text-mtg-accent w-8">
                      {deckCard.quantity}x
                    </span>
                    {deckCard.card.imageUris ? (
                      <img
                        src={typeof deckCard.card.imageUris === 'string' 
                          ? JSON.parse(deckCard.card.imageUris).small 
                          : deckCard.card.imageUris.small}
                        alt={deckCard.card.name}
                        className="w-12 h-16 object-cover rounded border border-gray-600"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-12 h-16 rounded bg-gray-700" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-white font-medium truncate">
                          {deckCard.card.nameFr || deckCard.card.name}
                        </span>
                        {deckCard.card.manaCost && (
                          <ManaCost manaCost={deckCard.card.manaCost} className="text-sm" />
                        )}
                        {ownedMap && deckCard.card?.oracleId && ownedMap[deckCard.card.oracleId] && (
                          <span className="px-1.5 py-0.5 rounded text-2xs font-semibold bg-mtg-green text-black">
                            Dans collection: {ownedMap[deckCard.card.oracleId].quantity + ownedMap[deckCard.card.oracleId].quantityFoil}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 truncate">
                        {deckCard.card.typeLineFr || deckCard.card.typeLine}
                      </div>
                      {deckCard.card.set && (
                        <div className="text-xs text-gray-500 mt-1">
                          {deckCard.card.set.name} ({deckCard.card.set.code.toUpperCase()})
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            );
          }}
        </VList>
      </div>
    </div>
  );

  const renderStats = () => {
    if (!deck?.stats) return null;

    const typeData = {
      labels: ['Créatures', 'Sorts', 'Artefacts', 'Enchantements', 'Planeswalkers', 'Terrains'],
      datasets: [{
        data: [
          deck.stats.typeDistribution.creatures || 0,
          (deck.stats.typeDistribution.instants || 0) + (deck.stats.typeDistribution.sorceries || 0),
          deck.stats.typeDistribution.artifacts || 0,
          deck.stats.typeDistribution.enchantments || 0,
          deck.stats.typeDistribution.planeswalkers || 0,
          deck.stats.typeDistribution.lands || 0,
        ],
        backgroundColor: [
          '#E49B0F', // Créatures - MTG Primary
          '#D3202A', // Sorts - MTG Secondary  
          '#8B5CF6', // Artefacts - Purple
          '#10B981', // Enchantements - Green
          '#F59E0B', // Planeswalkers - Amber
          '#6B7280', // Terrains - Gray
        ],
        borderWidth: 0,
      }]
    };
  
    const manaCurveData = {
      labels: ['0', '1', '2', '3', '4', '5', '6', '7+'],
      datasets: [{
        label: 'Nombre de cartes',
        data: deck.analytics?.manaCurve || [],
        backgroundColor: '#E49B0F',
        borderColor: '#D97706',
        borderWidth: 1,
      }]
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Répartition par type
          </h3>
          <div className="h-64">
            <Pie 
              data={typeData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    labels: {
                      color: '#fff'
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Courbe de mana
          </h3>
          <div className="h-64">
            <Bar 
              data={manaCurveData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  x: {
                    ticks: { color: '#fff' },
                    grid: { color: '#374151' }
                  },
                  y: {
                    ticks: { color: '#fff' },
                    grid: { color: '#374151' }
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-4">
            Statistiques du deck
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-mtg-primary">
                {deck.mainboardCount}
              </div>
              <div className="text-sm text-gray-400">Mainboard</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-mtg-accent">
                {deck.sideboardCount}
              </div>
              <div className="text-sm text-gray-400">Sideboard</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-mtg-secondary">
                {deck.analytics?.averageCmc?.toFixed(1) || '0.0'}
              </div>
              <div className="text-sm text-gray-400">CMC moyen</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-mtg-green">
                {deck.colors?.length || 0}
              </div>
              <div className="text-sm text-gray-400">Couleurs</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="text-center py-16">
        <div className="text-red-500 text-xl mb-4">
          Deck non trouvé
        </div>
        <Link to="/decks" className="btn-primary">
          Retour aux decks
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/decks')}
            className="btn-outline flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </button>
          
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{deck.name}</h1>
              <span className={`px-3 py-1 rounded-md text-sm font-medium text-white ${getFormatColor(deck.format)}`}>
                {deck.format}
              </span>
              {deck.archetype && (
                <span className="px-3 py-1 rounded-md text-sm font-medium bg-gray-700 text-gray-300">
                  {deck.archetype}
                </span>
              )}
              <span className="flex items-center text-sm text-gray-400">
                {deck.isPublic ? (
                  <>
                    <Globe className="w-4 h-4 mr-1" />
                    Public
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-1" />
                    Privé
                  </>
                )}
              </span>
            </div>
            {deck.colors && deck.colors.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                {(deck.colors || []).map((c: string) => (
                  <ManaSymbol key={deck.id + c} symbol={c} size="sm" />
                ))}
              </div>
            )}
            {deck.description && (
              <p className="text-gray-400">{deck.description}</p>
            )}
            <div className="text-sm text-gray-500 mt-1">
              Créé par {deck.user?.username} • Modifié {new Date(deck.updatedAt).toLocaleDateString('fr-FR')}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Link 
            to={`/decks/builder/${deck.id}`}
            className="btn-primary flex items-center"
          >
            <Edit className="w-4 h-4 mr-2" />
            Éditer
          </Link>
          <button className="btn-outline flex items-center" onClick={handleDuplicate}>
            <Copy className="w-4 h-4 mr-2" />
            Dupliquer
          </button>
          <button className="btn-outline flex items-center" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </button>
          <button className="btn-outline flex items-center">
            <Share className="w-4 h-4 mr-2" />
            Partager
          </button>
        </div>
      </div>

      {/* Navigation des vues */}
      <div className="flex space-x-1 bg-mtg-surface rounded-lg p-1">
        {[
          { key: 'cards', label: 'Liste des cartes', icon: Target },
          { key: 'stats', label: 'Statistiques', icon: BarChart3 },
          { key: 'visual', label: 'Visualisation', icon: Eye },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveView(key as any)}
            className={`flex-1 flex items-center justify-center py-3 px-4 rounded-md transition-colors ${
              activeView === key
                ? 'bg-mtg-primary text-black font-medium'
                : 'text-gray-400 hover:text-white hover:bg-mtg-background'
            }`}
          >
            <Icon className="w-4 h-4 mr-2" />
            {label}
          </button>
        ))}
      </div>

      {/* Contenu selon la vue active */}
      <AnimatePresence mode="wait">
        {activeView === 'cards' && (
          <motion.div
            key="cards"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-end">
              <label className="text-sm text-gray-400 mr-2">Filtrer:</label>
              <select
                value={ownershipFilter}
                onChange={(e) => setOwnershipFilter(e.target.value as any)}
                className="bg-mtg-background border border-gray-700 text-white text-sm rounded px-2 py-1"
              >
                <option value="all">Toutes</option>
                <option value="owned">Dans collection</option>
                <option value="unowned">Hors collection</option>
              </select>
            </div>
            {deck.mainboard && deck.mainboard.length > 0 && 
              renderCardList(filterByOwnership(deck.mainboard), 'Mainboard')
            }
            {deck.sideboard && deck.sideboard.length > 0 && 
              renderCardList(filterByOwnership(deck.sideboard), 'Sideboard')
            }
            {deck.maybeboard && deck.maybeboard.length > 0 && 
              renderCardList(filterByOwnership(deck.maybeboard), 'Maybeboard')
            }
            
            {(!deck.mainboard || deck.mainboard.length === 0) && (
              <div className="text-center py-16">
                <div className="text-gray-400 mb-4">Ce deck est vide</div>
                <Link 
                  to={`/decks/builder/${deck.id}`}
                  className="btn-primary"
                >
                  Ajouter des cartes
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {activeView === 'stats' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {renderStats()}
          </motion.div>
        )}

        {activeView === 'visual' && (
          <motion.div
            key="visual"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Aperçu visuel du deck</h3>
              <div className="flex items-center justify-end mb-4">
                <label className="text-sm text-gray-400 mr-2">Filtrer:</label>
                <select
                  value={ownershipFilter}
                  onChange={(e) => setOwnershipFilter(e.target.value as any)}
                  className="bg-mtg-background border border-gray-700 text-white text-sm rounded px-2 py-1"
                >
                  <option value="all">Toutes</option>
                  <option value="owned">Dans collection</option>
                  <option value="unowned">Hors collection</option>
                </select>
              </div>
              {deck.mainboard && deck.mainboard.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filterByOwnership(deck.mainboard).map((dc: any) => {
                    let img: string | undefined;
                    const iu = dc.card?.imageUris;
                    if (iu) {
                      if (typeof iu === 'string') {
                        try { img = JSON.parse(iu)?.normal || JSON.parse(iu)?.small; } catch {}
                      } else {
                        img = iu.normal || iu.small;
                      }
                    }
                    const ownedKey = dc.card?.oracleId as string | undefined;
                    const owned = ownedKey ? ownedMap && ownedMap[ownedKey] : undefined;
                    return (
                      <div key={`${dc.cardId}-${dc.board}`} className="relative group">
                        {img ? (
                          <img src={img} alt={dc.card?.name} className="w-full rounded-lg shadow-lg group-hover:scale-105 transition-transform" loading="lazy" />
                        ) : (
                          <div className="aspect-[2/3] w-full rounded-lg bg-mtg-surface border border-gray-700 flex items-center justify-center text-xs text-gray-500">
                            Pas d'image
                          </div>
                        )}
                        {/* Quantity badge */}
                        {dc.quantity > 1 && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-mtg-primary text-mtg-black text-xs font-bold rounded-full flex items-center justify-center">
                            {dc.quantity}
                          </div>
                        )}
                        {/* Owned marker */}
                        {owned && (owned.quantity + owned.quantityFoil) > 0 && (
                          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-mtg-green text-black text-2xs font-semibold shadow">
                            {owned.quantity + owned.quantityFoil}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400">Aucune carte dans le deck</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DeckViewPage;
