import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, Eye, Edit, Trash2, Copy, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { decksService } from '../services/decks';
import ManaSymbol from '../components/ManaSymbol';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const DecksPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const queryClient = useQueryClient();

  // Récupération des decks
  const { data: decksData, isLoading } = useQuery({
    queryKey: ['decks', searchQuery, selectedFormat],
    queryFn: () => decksService.getDecks(),
  });

  // Mutation pour supprimer un deck
  const deleteDeckMutation = useMutation({
    mutationFn: (deckId: string) => decksService.deleteDeck(deckId),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
  predicate: (query: any) => query.queryKey[0] === 'decks'
      });
      toast.success('Deck supprimé avec succès');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression du deck');
    },
  });

  // Fonction pour dupliquer un deck
  const duplicateDeck = async (deck: any) => {
    try {
  await decksService.duplicateDeck(deck.id);
      queryClient.invalidateQueries({ 
  predicate: (query: any) => query.queryKey[0] === 'decks'
      });
      toast.success(`Deck "${deck.name}" dupliqué`);
    } catch (error) {
      toast.error('Erreur lors de la duplication');
    }
  };

  // Fonction pour supprimer un deck avec confirmation
  const handleDeleteDeck = (deck: any) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le deck "${deck.name}" ?`)) {
      deleteDeckMutation.mutate(deck.id);
    }
  };

  const formats = [
    'Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 
    'Commander', 'Brawl', 'Historic', 'Alchemy'
  ];

  const archetypes = [
    'Aggro', 'Control', 'Midrange', 'Combo', 'Ramp'
  ];

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

  const getArchetypeIcon = () => {
    // Retourne différentes icônes selon l'archétype
    return <Layers className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Mes Decks</h1>
          <p className="text-gray-400">
            Gérez et organisez vos decks Magic: The Gathering
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            className="btn-outline flex items-center"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtres
          </button>
          <Link to="/decks/builder" className="btn-primary flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau deck
          </Link>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Rechercher dans vos decks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-mtg-background border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-mtg-primary focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Filtres avancés */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-gray-700"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Format
                  </label>
                  <select
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="w-full p-2 bg-mtg-background border border-gray-700 rounded-lg text-white focus:border-mtg-primary focus:outline-none"
                  >
                    <option value="">Tous les formats</option>
                    {formats.map((format) => (
                      <option key={format} value={format}>
                        {format}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Archétype
                  </label>
                  <select className="w-full p-2 bg-mtg-background border border-gray-700 rounded-lg text-white focus:border-mtg-primary focus:outline-none">
                    <option value="">Tous les archétypes</option>
                    {archetypes.map((archetype) => (
                      <option key={archetype} value={archetype}>
                        {archetype}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Liste des decks */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : decksData?.length > 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {decksData.map((deck: any) => (
            <motion.div
              key={deck.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02, y: -2 }}
              className="card p-6 group cursor-pointer"
            >
              {/* Header du deck */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium text-white ${getFormatColor(deck.format)}`}>
                      {deck.format}
                    </span>
                    {deck.archetype && (
                      <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-700 text-gray-300 flex items-center gap-1">
                        {getArchetypeIcon()}
                        {deck.archetype}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-mtg-primary transition-colors">
                    {deck.name}
                  </h3>
                  {deck.description && (
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                      {deck.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Couleurs du deck */}
              {deck.colors && deck.colors.length > 0 && (
                <div className="flex items-center gap-1 mb-4">
                  <span className="text-xs text-gray-400 mr-2">Couleurs:</span>
                  {deck.colors.map((color: string) => (
                    <ManaSymbol key={deck.id + color} symbol={color} size="sm" />
                  ))}
                </div>
              )}

              {/* Statistiques */}
              <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                <span>{deck.mainboardCount || 0} cartes</span>
                <span>{deck.sideboardCount || 0} sideboard</span>
                <span className={deck.isPublic ? 'text-mtg-green' : 'text-gray-500'}>
                  {deck.isPublic ? 'Public' : 'Privé'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                <div className="text-xs text-gray-500">
                  Modifié {new Date(deck.updatedAt).toLocaleDateString('fr-FR')}
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    to={`/decks/view/${deck.id}`}
                    className="p-1.5 text-gray-400 hover:text-mtg-accent transition-colors"
                    title="Voir le deck"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  <Link 
                    to={`/decks/builder/${deck.id}`}
                    className="p-1.5 text-gray-400 hover:text-mtg-primary transition-colors"
                    title="Éditer le deck"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                  <button 
                    onClick={() => duplicateDeck(deck)}
                    className="p-1.5 text-gray-400 hover:text-mtg-secondary transition-colors"
                    title="Dupliquer le deck"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteDeck(deck)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    title="Supprimer le deck"
                    disabled={deleteDeckMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-mtg-surface rounded-full flex items-center justify-center mx-auto mb-6">
            <Layers className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Aucun deck trouvé
          </h2>
          <p className="text-gray-400 mb-6">
            Créez votre premier deck pour commencer à construire vos stratégies.
          </p>
          <Link to="/decks/builder" className="btn-primary flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Créer mon premier deck
          </Link>
        </div>
      )}
    </div>
  );
};

export default DecksPage;
